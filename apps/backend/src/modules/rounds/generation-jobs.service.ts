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
import {
  GENERATION_INPUT_FORMAT,
  GenerationInput,
  PersonaInput,
} from '../generation/design-prompts'
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
/** Personas put in one prompt (the persona artifact comes on top). */
const MAX_PROMPT_PERSONAS = 5
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
   * Snapshots everything the design prompt template uses — the project
   * (name, client/product, description, platforms), its design intent, the
   * user personas, the chosen user stories and the designer's prompt — and
   * queues the job. The worker first saves a persona artifact from the prompt,
   * then generates the HTML designs.
   *
   * @throws ConflictException for an approved or archived round, or a
   *   project whose design intent is not defined yet.
   * @throws BadRequestException for personas, stories or a base variant
   *   outside the project.
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
    const existing = await this.byIdempotencyKey(roundId, dto.idempotencyKey)
    if (existing) {
      return existing
    }
    if (!this.llm.configured) {
      throw new ServiceUnavailableException(
        'Design generation is not configured on this server.',
      )
    }
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { designIntent: true },
    })
    const intent = project.designIntent
    if (!intent) {
      throw new ConflictException(
        'Define the project’s design intent (PUT /projects/{projectId}/design-intent) before generating designs.',
      )
    }
    const stories = await this.stories(projectId, dto.storyIds)
    const personas = await this.personas(projectId, dto.personaIds)
    const baseDesign = await this.baseDesign(projectId, dto.baseVariantId)
    const feedbackThemes = await this.feedbackThemes(roundId)
    const input: GenerationInput = {
      format: GENERATION_INPUT_FORMAT,
      project: {
        name: project.name,
        clientOrProduct: project.clientOrProduct,
        description: project.description,
        platforms: project.platforms,
      },
      intent: {
        statement: intent.statement,
        designSystem: intent.designSystem,
        designStandards: intent.designStandards,
        designGuidelines: intent.designGuidelines,
        colors: {
          primary: intent.primaryColor,
          secondary: intent.secondaryColor,
          accent: intent.accentColor,
        },
        brandGuidelines: intent.brandGuidelines,
        toneOfVoice: intent.toneOfVoice,
        version: intent.version,
      },
      personas,
      stories,
      prompt: dto.prompt,
      synthesizePersona: dto.synthesizePersona ?? true,
      baseDesign,
      feedbackThemes,
    }

    let job: JobWithVariants
    try {
      job = await this.prisma.generationJob.create({
        data: {
          roundId,
          requestedById: userId,
          uiLibrary: intent.designSystem,
          prompt: dto.prompt,
          baseVariantId: dto.baseVariantId,
          idempotencyKey: dto.idempotencyKey,
          variantCount: dto.variantCount ?? 2,
          modelProvider: this.llm.provider,
          modelName: this.llm.model,
          inputSnapshot: input as unknown as Prisma.InputJsonObject,
        },
        include: WITH_VARIANTS,
      })
    } catch (error) {
      // Two identical requests raced past the lookup: the loser gets the winner's job.
      const raced = await this.byIdempotencyKey(roundId, dto.idempotencyKey)
      if (raced) {
        return raced
      }
      throw error
    }
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

  /** The job an earlier request with the same idempotency key created. */
  private async byIdempotencyKey(
    roundId: string,
    key: string | undefined,
  ): Promise<GenerationJobDto | null> {
    if (!key) {
      return null
    }
    const job = await this.prisma.generationJob.findUnique({
      where: { roundId_idempotencyKey: { roundId, idempotencyKey: key } },
      include: WITH_VARIANTS,
    })

    return job ? toDto(job) : null
  }

  /** The variant to refine, looked up through the project (never by bare id). */
  private async baseDesign(
    projectId: string,
    baseVariantId: string | undefined,
  ): Promise<GenerationInput['baseDesign']> {
    if (!baseVariantId) {
      return null
    }
    const variant = await this.prisma.uIVariant.findFirst({
      where: { id: baseVariantId, ...inProject.variant(projectId) },
      select: { id: true, name: true, html: true, status: true },
    })
    if (!variant || variant.status === 'ARCHIVED') {
      throw new BadRequestException(
        'baseVariantId must be a non-archived variant of this project.',
      )
    }
    if (!variant.html) {
      throw new BadRequestException(
        'baseVariantId is a legacy JSON design; only HTML designs can be refined.',
      )
    }

    return { variantId: variant.id, name: variant.name, html: variant.html }
  }

  /**
   * The personas the design is for: the ones the designer picked (any origin,
   * all of this project), or else every persona written by a designer
   * (earlier AI artifacts are only used when picked).
   */
  private async personas(
    projectId: string,
    personaIds: string[] | undefined,
  ): Promise<PersonaInput[]> {
    const unique = personaIds ? [...new Set(personaIds)] : undefined
    const rows = await this.prisma.userPersona.findMany({
      where: unique
        ? { projectId, id: { in: unique } }
        : { projectId, origin: 'MANUAL' },
      select: {
        name: true,
        age: true,
        shortDescription: true,
        behavioralConsiderations: true,
        frustrations: true,
        goals: true,
        tasks: true,
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_PROMPT_PERSONAS,
    })
    if (unique && rows.length !== unique.length) {
      throw new BadRequestException(
        'personaIds must all be user personas of this project.',
      )
    }

    return rows
  }

  /** Reviewed themes the round was opened to address (see the iteration endpoint). */
  private async feedbackThemes(
    roundId: string,
  ): Promise<GenerationInput['feedbackThemes']> {
    const links = await this.prisma.roundFeedbackLink.findMany({
      where: { roundId },
      select: {
        theme: {
          select: {
            title: true,
            summary: true,
            category: true,
            severity: true,
            designerNote: true,
          },
        },
      },
      take: 50,
    })

    return links.map(({ theme }) => theme)
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
