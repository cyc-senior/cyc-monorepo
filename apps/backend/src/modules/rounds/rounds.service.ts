import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  concatMap,
  defer,
  from,
  interval,
  map,
  merge,
  Observable,
  of,
  takeWhile,
} from 'rxjs'

import { recordDecision } from '../../common/decisions'
import { lockKey } from '../../common/db-lock'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { PromptDraftEvents } from '../generation/prompt-draft-events.service'
import { PromptDraftQueue } from '../generation/prompt-draft-queue.service'
import { PromptDrafter } from '../generation/prompt-drafter'
import {
  CreateDesignRoundDto,
  DesignRoundDto,
  DesignRoundQueryDto,
  UpdateDesignRoundDto,
} from './dto/design-round.dto'
import { createNextRound } from './round-state'

@Injectable()
export class RoundsService {
  private readonly logger = new Logger(RoundsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly drafter: PromptDrafter,
    private readonly draftQueue: PromptDraftQueue,
    private readonly draftEvents: PromptDraftEvents,
  ) {}

  list(
    projectId: string,
    query: DesignRoundQueryDto,
  ): Promise<Page<DesignRoundDto>> {
    const where: Prisma.DesignRoundWhereInput = {
      projectId,
      status: query.status,
      // Rounds of a deleted story leave the design pages with it.
      OR: [{ storyId: null }, { story: { deletedAt: null } }],
    }

    return paginate(
      query,
      (page) =>
        this.prisma.designRound.findMany({
          where,
          orderBy: { roundNumber: 'desc' },
          ...page,
        }),
      () => this.prisma.designRound.count({ where }),
    )
  }

  /** Creates the next round; numbers are sequential per project. */
  async create(
    projectId: string,
    dto: CreateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    if (dto.parentRoundId) {
      await this.get(projectId, dto.parentRoundId)
    }
    if (
      dto.storyId &&
      !(await this.prisma.userStory.findFirst({
        where: { id: dto.storyId, projectId, deletedAt: null },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException(
        'storyId must be a user story of this project.',
      )
    }

    return this.prisma.$transaction((tx) =>
      createNextRound(tx, projectId, {
        title: dto.title,
        parentRoundId: dto.parentRoundId,
        storyId: dto.storyId ?? undefined,
      }),
    )
  }

  get(projectId: string, id: string): Promise<DesignRoundDto> {
    return this.prisma.designRound.findFirstOrThrow({
      where: { id, projectId },
    })
  }

  /**
   * Updates title, parent or status.
   *
   * @throws BadRequestException when asked to set APPROVED, or a parent that is
   *   not an earlier round of the project.
   * @throws ConflictException when the round is approved (frozen apart from
   *   archiving).
   */
  async update(
    projectId: string,
    id: string,
    dto: UpdateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    const round = await this.get(projectId, id)

    if (dto.status === 'APPROVED') {
      throw new BadRequestException(
        'Use the approve endpoint to approve a round.',
      )
    }
    const approved = round.status === 'APPROVED' || round.approvedAt !== null
    if (approved && !this.isArchiveOnly(dto)) {
      throw new ConflictException(
        'An approved round is frozen; it can only be archived.',
      )
    }
    if (dto.parentRoundId) {
      const parent = await this.get(projectId, dto.parentRoundId)
      if (parent.roundNumber >= round.roundNumber) {
        throw new BadRequestException(
          'The parent must be an earlier round of the project.',
        )
      }
    }

    return this.prisma.designRound.update({ where: { id }, data: dto })
  }

  /**
   * Approves the round once; it is frozen afterwards and becomes visible to
   * stakeholders (client, developer, project manager). The approval is
   * recorded in the decision history in the same transaction.
   *
   * @throws ConflictException when already approved/archived, or while a test
   *   session of the round is still running.
   */
  async approve(
    projectId: string,
    id: string,
    userId: string,
  ): Promise<DesignRoundDto> {
    await this.get(projectId, id)

    await this.prisma.$transaction(async (tx) => {
      const running = await tx.testSession.count({
        where: { roundId: id, status: 'ACTIVE' },
      })
      if (running > 0) {
        throw new ConflictException(
          'End the round’s running test sessions before approving it.',
        )
      }
      // Conditional update: two concurrent approvals cannot both succeed.
      const claimed = await tx.designRound.updateMany({
        where: { id, projectId, status: { notIn: ['APPROVED', 'ARCHIVED'] } },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      })
      if (claimed.count === 0) {
        throw new ConflictException(
          'The round is already approved or archived.',
        )
      }
      await recordDecision(tx, {
        projectId,
        roundId: id,
        type: 'ROUND_APPROVED',
        decidedById: userId,
      })
    })

    return this.get(projectId, id)
  }

  /**
   * Deletes the round with its jobs and variants.
   *
   * @throws ConflictException for an approved round, one with test sessions,
   *   or the project's last one.
   */
  async remove(projectId: string, id: string): Promise<void> {
    const round = await this.get(projectId, id)
    if (round.approvedAt) {
      throw new ConflictException('An approved round cannot be deleted.')
    }
    const sessions = await this.prisma.testSession.count({
      where: { roundId: id },
    })
    if (sessions > 0) {
      // Test results are research data; archive the round instead.
      throw new ConflictException(
        'A round with test sessions cannot be deleted; archive it instead.',
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `project-rounds:${projectId}`)
      if ((await tx.designRound.count({ where: { projectId } })) <= 1) {
        throw new ConflictException('A project must keep at least one round.')
      }
      await tx.designRound.delete({ where: { id } })
    })
  }

  private isArchiveOnly(dto: UpdateDesignRoundDto): boolean {
    const fields = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    )

    return fields.length === 1 && dto.status === 'ARCHIVED'
  }

  /**
   * Starts or returns the status of background prompt drafting for a story.
   * Refreshing the browser does not cancel or duplicate the job.
   */
  async startDraftPrompt(
    projectId: string,
    storyId: string,
    personaId?: string,
    refresh = false,
  ): Promise<{
    status: string
    prompt?: Record<string, unknown>
    error?: string | null
  }> {
    const [story, persona] = await Promise.all([
      this.prisma.userStory.findFirst({
        where: { id: storyId, projectId, deletedAt: null },
      }),
      personaId
        ? this.prisma.userPersona.findFirst({
            where: { id: personaId, projectId },
          })
        : Promise.resolve(null),
    ])

    if (!story) {
      throw new NotFoundException('User story not found.')
    }
    if (personaId && !persona) {
      throw new BadRequestException(
        'personaId must be a persona of this project.',
      )
    }

    if (
      !refresh &&
      story.draftPrompt &&
      typeof story.draftPrompt === 'object' &&
      !Array.isArray(story.draftPrompt)
    ) {
      return {
        status: 'SUCCEEDED',
        prompt: story.draftPrompt as Record<string, unknown>,
      }
    }

    if (
      !refresh &&
      (story.draftStatus === 'QUEUED' || story.draftStatus === 'RUNNING')
    ) {
      return { status: story.draftStatus }
    }

    if (!this.drafter.configured) {
      throw new BadRequestException(
        'LLM provider is not configured on the backend. Please verify LLM_BASE_URL and LLM_API_KEY.',
      )
    }

    await this.prisma.userStory.update({
      where: { id: story.id },
      data: { draftStatus: 'QUEUED', draftError: null },
    })

    try {
      await this.draftQueue.enqueue(
        { projectId, storyId, ...(personaId ? { personaId } : {}) },
        refresh,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.prisma.userStory.update({
        where: { id: story.id },
        data: { draftStatus: 'FAILED', draftError: message },
      })
      throw new ServiceUnavailableException(
        'Could not queue prompt drafting; try again shortly.',
      )
    }

    return { status: 'QUEUED' }
  }

  /**
   * Streams the drafting of a story's structured A/B prompt by attaching to
   * the background BullMQ job (or starting it if idle). Client disconnect does
   * not abort the worker.
   */
  streamDraftPrompt(
    projectId: string,
    storyId: string,
    personaId?: string,
    refresh = false,
  ): Observable<MessageEvent> {
    const HEARTBEAT_MS = 15_000

    const live = this.draftEvents.forStory(storyId).pipe(
      concatMap((signal) => {
        if (signal.kind === 'progress') {
          return of<MessageEvent>({ data: signal.progress })
        }
        return defer(() => this.draftSnapshot(projectId, storyId))
      }),
    )

    const initial = defer(async () => {
      const started = await this.startDraftPrompt(
        projectId,
        storyId,
        personaId,
        refresh,
      )
      if (started.status === 'SUCCEEDED' && started.prompt) {
        return [this.completedEvent(started.prompt)]
      }

      const events: MessageEvent[] = [
        {
          data: {
            status: 'Drafting your prompt with AI...',
            stage: 'loading_inputs',
          },
        },
      ]
      const progress = await this.draftQueue.latestProgress(storyId)
      if (progress) {
        events.push({ data: progress })
      }
      return events
    }).pipe(concatMap((events) => from(events)))

    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { storyId } })),
    )

    return merge(live, initial, heartbeat).pipe(
      takeWhile((event) => {
        if (event.type === 'error') {
          return false
        }
        const data = event.data as Record<string, unknown> | undefined
        return data?.stage !== 'completed'
      }, true),
    )
  }

  private async draftSnapshot(
    projectId: string,
    storyId: string,
  ): Promise<MessageEvent> {
    const story = await this.prisma.userStory.findFirst({
      where: { id: storyId, projectId, deletedAt: null },
    })
    if (!story) {
      return { type: 'error', data: 'User story not found.' }
    }
    if (
      story.draftStatus === 'SUCCEEDED' &&
      story.draftPrompt &&
      typeof story.draftPrompt === 'object' &&
      !Array.isArray(story.draftPrompt)
    ) {
      return this.completedEvent(story.draftPrompt as Record<string, unknown>)
    }
    if (story.draftStatus === 'FAILED') {
      return {
        type: 'error',
        data: story.draftError ?? 'Drafting the prompt failed.',
      }
    }
    return {
      data: {
        status: 'Drafting your prompt with AI...',
        stage: 'drafting',
      },
    }
  }

  private completedEvent(prompt: Record<string, unknown>): MessageEvent {
    return {
      data: {
        status: 'Drafting complete',
        stage: 'completed',
        prompt,
        ...(typeof prompt.thoughtChars === 'number'
          ? { thoughtChars: prompt.thoughtChars }
          : {}),
        ...(typeof prompt.thoughtDurationSeconds === 'number'
          ? { thoughtDurationSeconds: prompt.thoughtDurationSeconds }
          : {}),
      },
    }
  }
}
