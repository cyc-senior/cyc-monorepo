import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  MessageEvent,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  concatMap,
  defer,
  interval,
  map,
  merge,
  Observable,
  of,
  takeWhile,
} from 'rxjs'

import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { logEvent } from '../../common/logging/log-event'
import { inProject } from '../../common/scopes'
import { GenerationJobStatus, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { GenerationInput } from '../generation/design-prompts'
import { GenerationEvents } from '../generation/generation-events.service'
import { GenerationQueue } from '../generation/generation-queue.service'
import { LlmClient } from '../generation/llm.client'
import {
  CreateGenerationJobDto,
  GenerationJobDto,
} from './dto/generation-job.dto'
import { requireWritableRound } from './round-state'

const WITH_VARIANTS = {
  variants: { select: { id: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.GenerationJobInclude

type JobWithVariants = Prisma.GenerationJobGetPayload<{
  include: typeof WITH_VARIANTS
}>

const ACTIVE: GenerationJobStatus[] = ['QUEUED', 'RUNNING']
/** SSE event name for each final status. */
const FINAL_EVENT: Partial<Record<GenerationJobStatus, string>> = {
  SUCCEEDED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}
/** Keeps proxies from closing an idle stream. */
const HEARTBEAT_MS = 15_000
/** How long a client waits before reconnecting a dropped stream. */
const RECONNECT_MS = 3_000

@Injectable()
export class GenerationJobsService {
  private readonly logger = new Logger(GenerationJobsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: GenerationQueue,
    private readonly events: GenerationEvents,
    private readonly llm: LlmClient,
  ) {}

  async list(
    projectId: string,
    roundId: string,
    query: PaginationQueryDto,
  ): Promise<Page<GenerationJobDto>> {
    await this.prisma.designRound.findFirstOrThrow({
      where: { id: roundId, projectId },
    })

    return paginate(
      query,
      async (page) => {
        const jobs = await this.prisma.generationJob.findMany({
          where: { roundId },
          include: WITH_VARIANTS,
          orderBy: { createdAt: 'desc' },
          ...page,
        })

        return jobs.map(toDto)
      },
      () => this.prisma.generationJob.count({ where: { roundId } }),
    )
  }

  /**
   * Snapshots the project's design brief (and the chosen user stories) and
   * queues the job for the worker.
   *
   * @throws ConflictException for an approved or archived round.
   * @throws ServiceUnavailableException when generation is not configured or
   *   the queue cannot be reached (the job is then marked FAILED).
   */
  async create(
    projectId: string,
    roundId: string,
    userId: string,
    dto: CreateGenerationJobDto,
  ): Promise<GenerationJobDto> {
    await requireWritableRound(this.prisma, projectId, roundId)
    if (!this.llm.configured) {
      throw new ServiceUnavailableException(
        'Design generation is not configured on this server.',
      )
    }
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    })
    const stories = await this.stories(projectId, dto.storyIds)
    const input: GenerationInput = {
      project: { name: project.name, description: project.description },
      design: {
        designIntent: project.designIntent,
        uiLibrary: project.uiLibrary,
        targetPersona: project.targetPersona,
        designGuidelines: project.designGuidelines,
        brandIdentity: project.brandIdentity,
        toneOfVoice: project.toneOfVoice,
        designTokens: project.designTokens,
        designVersion: project.designVersion,
      },
      stories,
      prompt: dto.prompt ?? null,
    }

    const job = await this.prisma.generationJob.create({
      data: {
        roundId,
        requestedById: userId,
        uiLibrary: project.uiLibrary,
        prompt: dto.prompt,
        variantCount: dto.variantCount ?? 2,
        modelProvider: this.llm.provider,
        modelName: this.llm.model,
        inputSnapshot: input as unknown as Prisma.InputJsonObject,
      },
      include: WITH_VARIANTS,
    })
    try {
      await this.queue.enqueue(job.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: message, finishedAt: new Date() },
      })
      this.logger.error(
        logEvent('generation.enqueue_failed', { job: job.id, error: message }),
      )
      throw new ServiceUnavailableException(
        'Could not queue the job; try again shortly.',
      )
    }

    return toDto(job)
  }

  async get(projectId: string, id: string): Promise<GenerationJobDto> {
    return toDto(await this.find(projectId, id))
  }

  /**
   * Stops a job. A queued job is taken off the queue; a running one stops at
   * its next checkpoint (within seconds) and saves nothing.
   *
   * @throws ConflictException when the job has already finished.
   */
  async cancel(projectId: string, id: string): Promise<GenerationJobDto> {
    await this.find(projectId, id)
    const cancelled = await this.prisma.generationJob.updateMany({
      where: { id, status: { in: ACTIVE } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
    if (cancelled.count === 0) {
      throw new ConflictException('The job has already finished.')
    }
    try {
      await this.queue.withdraw(id)
    } catch {
      // Best effort: the worker skips a cancelled job anyway.
    }

    return this.get(projectId, id)
  }

  /**
   * Deletes a finished job; the variants it produced are kept.
   *
   * @throws ConflictException while it is queued or running.
   */
  async remove(projectId: string, id: string): Promise<void> {
    const job = await this.find(projectId, id)
    if (ACTIVE.includes(job.status)) {
      throw new ConflictException('Cancel the job before deleting it.')
    }
    await this.prisma.generationJob.delete({ where: { id } })
  }

  /**
   * Server-sent events for one job: `status` (QUEUED/RUNNING, sent first and
   * whenever it changes), `progress` while generating, then exactly one final
   * `completed`, `failed` or `cancelled` event, after which the stream ends.
   * `heartbeat` events keep idle connections open.
   *
   * Live events are subscribed to before the current state is read, so none
   * is lost in between; a client that reconnects simply gets the current state
   * again.
   */
  async stream(
    projectId: string,
    id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.find(projectId, id)
    let sequence = 0

    const live = this.events.forJob(id).pipe(
      concatMap((signal) =>
        signal.kind === 'progress'
          ? of<MessageEvent>({
              type: 'progress',
              data: { jobId: id, ...signal.progress },
            })
          : defer(() => this.snapshot(id)),
      ),
    )
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { jobId: id } })),
    )

    return merge(
      live,
      defer(() => this.snapshot(id)),
      heartbeat,
    ).pipe(
      takeWhile(
        (event) => !Object.values(FINAL_EVENT).includes(event.type),
        true,
      ),
      map((event) => ({
        ...event,
        id: String(++sequence),
        retry: sequence === 1 ? RECONNECT_MS : undefined,
      })),
    )
  }

  private async snapshot(id: string): Promise<MessageEvent> {
    const job = await this.prisma.generationJob.findUniqueOrThrow({
      where: { id },
      include: WITH_VARIANTS,
    })

    return {
      type: FINAL_EVENT[job.status] ?? 'status',
      data: {
        jobId: job.id,
        status: job.status,
        error: job.error,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        variantIds: job.variants.map((v) => v.id),
      },
    }
  }

  private find(projectId: string, id: string): Promise<JobWithVariants> {
    return this.prisma.generationJob.findFirstOrThrow({
      where: { id, ...inProject.job(projectId) },
      include: WITH_VARIANTS,
    })
  }

  private async stories(
    projectId: string,
    storyIds: string[] | undefined,
  ): Promise<GenerationInput['stories']> {
    if (!storyIds?.length) {
      return []
    }
    const unique = [...new Set(storyIds)]
    const stories = await this.prisma.userStory.findMany({
      where: { id: { in: unique }, projectId },
      select: {
        id: true,
        title: true,
        description: true,
        acceptanceCriteria: true,
        problemStatement: true,
      },
    })
    if (stories.length !== unique.length) {
      throw new BadRequestException(
        'storyIds must all be user stories of this project.',
      )
    }

    return stories
  }
}

function toDto({ variants, ...job }: JobWithVariants): GenerationJobDto {
  return { ...job, variantIds: variants.map((v) => v.id) }
}
