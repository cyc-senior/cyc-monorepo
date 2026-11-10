import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import { HttpCacheService } from '../../cache/http-cache.service'
import { sha256 } from '../../common/crypto'
import { logEvent } from '../../common/logging/log-event'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { FeedbackDto, TaskRunDto } from './dto/test-session.dto'
import {
  FinishTaskDto,
  InteractionEventInputDto,
  RecordConsentDto,
  RecordEventsDto,
  StartTaskDto,
  SubmitFeedbackDto,
  TesterConsentDto,
  TesterPrototypeDto,
  TesterSessionDto,
  WithdrawConsentDto,
} from './dto/tester.dto'
import { MAX_EVENT_METADATA_BYTES } from './testing.constants'
import { TesterContext } from './tester.types'

/** Events may be buffered on a device, but not dated in the future. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

/**
 * Everything a participant can do. The {@link TesterContext} comes from the
 * tester guard (database-verified); no id supplied by the client is trusted:
 * variants must belong to the session (and the participant's group), task runs
 * to the participant, and everything written is stamped with the context's
 * participant and session.
 */
@Injectable()
export class TesterService {
  private readonly logger = new Logger(TesterService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: HttpCacheService,
  ) {}

  // -------------------------------------------------------------------------
  // Session overview, consent, onboarding
  // -------------------------------------------------------------------------

  async session(ctx: TesterContext): Promise<TesterSessionDto> {
    const participant = await this.prisma.sessionParticipant.findUniqueOrThrow({
      where: { id: ctx.participantId },
      include: {
        session: {
          include: {
            variants: {
              include: { variant: { select: { name: true } } },
              orderBy: { label: 'asc' },
            },
            tasks: { orderBy: { position: 'asc' } },
          },
        },
        taskRuns: {
          select: { id: true, taskId: true, variantId: true, status: true },
        },
      },
    })
    const { session } = participant
    const consent = await this.consent(ctx)
    const variants = session.variants
      .filter((v) => this.allowedVariant(ctx, v.variantId))
      .map((v) => ({ id: v.variantId, label: v.label, name: v.variant.name }))
    // Tasks are the study material: shown only to someone who has consented.
    const tasks =
      consent.decision === 'GRANTED'
        ? session.tasks.map((task) => ({
            id: task.id,
            position: task.position,
            title: task.title,
            instructions: task.instructions,
            runs: participant.taskRuns
              .filter((run) => run.taskId === task.id)
              .map(({ id, variantId, status }) => ({ id, variantId, status })),
          }))
        : []

    return {
      title: session.title,
      description: session.description,
      status: session.status,
      expiresAt: session.expiresAt,
      participantStatus: participant.status,
      onboarded: participant.onboardedAt !== null,
      consent,
      variants,
      tasks,
    }
  }

  async consent(ctx: TesterContext): Promise<TesterConsentDto> {
    const session = await this.prisma.testSession.findUniqueOrThrow({
      where: { id: ctx.sessionId },
      select: { consentVersion: true, consentText: true },
    })
    const latest = await this.latestConsent(ctx)

    return {
      version: session.consentVersion,
      text: session.consentText,
      decision: latest?.decision ?? null,
      decidedAt: latest?.createdAt ?? null,
    }
  }

  /**
   * Records the participant's decision for THIS session and the notice
   * version they were shown. Append-only; a later decision supersedes it.
   *
   * @throws ConflictException when the notice changed since it was loaded.
   */
  async recordConsent(
    ctx: TesterContext,
    dto: RecordConsentDto,
  ): Promise<TesterConsentDto> {
    const session = await this.sessionNotice(ctx, dto.consentVersion)
    await this.prisma.consentRecord.create({
      data: {
        sessionId: ctx.sessionId,
        participantId: ctx.participantId,
        consentVersion: session.consentVersion,
        textHash: sha256(session.consentText),
        decision: dto.decision,
      },
    })
    this.logger.log(
      logEvent('testing.consent', {
        participant: ctx.participantId,
        session: ctx.sessionId,
        decision: dto.decision,
      }),
    )

    return this.consent(ctx)
  }

  /**
   * Withdraws consent: the participant's access ends right away. Their data is
   * kept until the design team deletes it on request (see the PDPA notice).
   */
  async withdrawConsent(
    ctx: TesterContext,
    dto: WithdrawConsentDto,
  ): Promise<void> {
    const session = await this.sessionNotice(ctx, dto.consentVersion)
    await this.prisma.$transaction(async (tx) => {
      await tx.consentRecord.create({
        data: {
          sessionId: ctx.sessionId,
          participantId: ctx.participantId,
          consentVersion: session.consentVersion,
          textHash: sha256(session.consentText),
          decision: 'WITHDRAWN',
        },
      })
      await tx.sessionParticipant.update({
        where: { id: ctx.participantId },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      })
    })
    await this.cache.invalidate(ctx.projectId)
    this.logger.log(
      logEvent('testing.consent', {
        participant: ctx.participantId,
        session: ctx.sessionId,
        decision: 'WITHDRAWN',
      }),
    )
  }

  async completeOnboarding(ctx: TesterContext): Promise<void> {
    await this.requireConsent(ctx)
    await this.prisma.sessionParticipant.updateMany({
      where: { id: ctx.participantId, onboardedAt: null },
      data: { onboardedAt: new Date() },
    })
  }

  /** Marks the participant done. */
  async complete(ctx: TesterContext): Promise<void> {
    await this.requireConsent(ctx)
    await this.prisma.sessionParticipant.updateMany({
      where: { id: ctx.participantId, status: 'JOINED' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    await this.cache.invalidate(ctx.projectId)
  }

  // -------------------------------------------------------------------------
  // Prototype, tasks
  // -------------------------------------------------------------------------

  /** The design to render; only variants of the participant's group, after consent. */
  async prototype(
    ctx: TesterContext,
    variantId: string,
  ): Promise<TesterPrototypeDto> {
    await this.requireConsent(ctx)
    const link = await this.sessionVariant(ctx, variantId)
    const variant = await this.prisma.uIVariant.findUniqueOrThrow({
      where: { id: link.variantId },
      select: {
        id: true,
        name: true,
        uiLibrary: true,
        html: true,
        design: true,
      },
    })

    return {
      id: variant.id,
      label: link.label,
      name: variant.name,
      uiLibrary: variant.uiLibrary,
      html: variant.html,
      design: variant.design as Record<string, unknown> | null,
    }
  }

  async startTask(
    ctx: TesterContext,
    taskId: string,
    dto: StartTaskDto,
  ): Promise<TaskRunDto> {
    await this.requireConsent(ctx)
    await this.requireOnboarding(ctx)
    const task = await this.prisma.testTask.findFirst({
      where: { id: taskId, sessionId: ctx.sessionId },
      select: { id: true },
    })
    if (!task) {
      throw new NotFoundException('Task not found.')
    }
    const variantId = await this.variantFor(ctx, dto.variantId)
    const key = {
      taskId_participantId_variantId: {
        taskId,
        participantId: ctx.participantId,
        variantId,
      },
    }

    const existing = await this.prisma.taskRun.findUnique({ where: key })
    if (existing) {
      return this.resumed(existing)
    }
    try {
      return await this.prisma.taskRun.create({
        data: {
          sessionId: ctx.sessionId,
          taskId,
          participantId: ctx.participantId,
          variantId,
        },
      })
    } catch (error) {
      // Two starts raced: both get the same run.
      const raced = await this.prisma.taskRun.findUnique({ where: key })
      if (raced) {
        return this.resumed(raced)
      }
      throw error
    }
  }

  async finishTask(
    ctx: TesterContext,
    runId: string,
    dto: FinishTaskDto,
  ): Promise<TaskRunDto> {
    await this.requireConsent(ctx)
    const run = await this.prisma.taskRun.findFirst({
      where: {
        id: runId,
        participantId: ctx.participantId,
        sessionId: ctx.sessionId,
      },
    })
    if (!run) {
      throw new NotFoundException('Task run not found.')
    }
    const now = new Date()
    const finished = await this.prisma.taskRun.updateMany({
      where: { id: runId, status: 'IN_PROGRESS' },
      data: {
        status: dto.status,
        finishedAt: now,
        durationMs: now.getTime() - run.startedAt.getTime(),
      },
    })
    if (finished.count === 0) {
      throw new ConflictException('This task has already been finished.')
    }
    await this.cache.invalidate(ctx.projectId)

    return this.prisma.taskRun.findUniqueOrThrow({ where: { id: runId } })
  }

  // -------------------------------------------------------------------------
  // Interaction events and feedback
  // -------------------------------------------------------------------------

  /** Stores a batch of interaction events (all or none). */
  async recordEvents(
    ctx: TesterContext,
    dto: RecordEventsDto,
  ): Promise<{ accepted: number }> {
    await this.requireConsent(ctx)
    const latest = Date.now() + MAX_CLOCK_SKEW_MS
    const runIds = [
      ...new Set(
        dto.events.map((e) => e.taskRunId).filter((id): id is string => !!id),
      ),
    ]
    await this.assertOwnRuns(ctx, runIds)
    const variantIds = new Set<string>()
    for (const event of dto.events) {
      if (event.occurredAt.getTime() > latest) {
        throw new BadRequestException('occurredAt cannot be in the future.')
      }
      this.assertMetadata(event)
      if (!variantIds.has(event.variantId)) {
        await this.sessionVariant(ctx, event.variantId)
        variantIds.add(event.variantId)
      }
    }

    await this.prisma.interactionEvent.createMany({
      data: dto.events.map((event) => ({
        sessionId: ctx.sessionId,
        participantId: ctx.participantId,
        variantId: event.variantId,
        taskRunId: event.taskRunId,
        type: event.type,
        screenId: event.screenId,
        nodeId: event.nodeId,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonObject,
        occurredAt: event.occurredAt,
      })),
    })

    return { accepted: dto.events.length }
  }

  /**
   * Stores raw feedback. It is written once and never edited (a database
   * trigger enforces it); analysis never touches it.
   */
  async submitFeedback(
    ctx: TesterContext,
    dto: SubmitFeedbackDto,
  ): Promise<FeedbackDto> {
    await this.requireConsent(ctx)
    await this.sessionVariant(ctx, dto.variantId)
    if (dto.taskRunId) {
      await this.assertOwnRuns(ctx, [dto.taskRunId])
    }
    const skipped = dto.skipped === true

    const feedback = await this.prisma.feedback.create({
      data: {
        sessionId: ctx.sessionId,
        participantId: ctx.participantId,
        variantId: dto.variantId,
        taskRunId: dto.taskRunId,
        scope: dto.scope,
        screenId: dto.screenId,
        nodeId: dto.scope === 'COMPONENT' ? dto.nodeId : undefined,
        rating: dto.rating,
        comment: skipped ? null : dto.comment?.trim(),
        skipped,
      },
    })
    await this.cache.invalidate(ctx.projectId)

    return feedback
  }

  /** The participant's own submissions. */
  async ownFeedback(ctx: TesterContext): Promise<FeedbackDto[]> {
    await this.requireConsent(ctx)

    return this.prisma.feedback.findMany({
      where: { sessionId: ctx.sessionId, participantId: ctx.participantId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
  }

  // -------------------------------------------------------------------------
  // Guards on the participant's own state
  // -------------------------------------------------------------------------

  private latestConsent(ctx: TesterContext) {
    return this.prisma.consentRecord.findFirst({
      where: {
        sessionId: ctx.sessionId,
        participantId: ctx.participantId,
        consentVersion: ctx.consentVersion,
      },
      orderBy: { createdAt: 'desc' },
      select: { decision: true, createdAt: true },
    })
  }

  /** @throws ForbiddenException unless this participant consented to THIS session's notice. */
  private async requireConsent(ctx: TesterContext): Promise<void> {
    const latest = await this.latestConsent(ctx)
    if (latest?.decision !== 'GRANTED') {
      throw new ForbiddenException(
        'You need to accept the consent notice before taking part.',
      )
    }
  }

  private async requireOnboarding(ctx: TesterContext): Promise<void> {
    const participant = await this.prisma.sessionParticipant.findUniqueOrThrow({
      where: { id: ctx.participantId },
      select: { onboardedAt: true },
    })
    if (!participant.onboardedAt) {
      throw new ForbiddenException('Complete the onboarding first.')
    }
  }

  private async sessionNotice(ctx: TesterContext, version: string) {
    const session = await this.prisma.testSession.findUniqueOrThrow({
      where: { id: ctx.sessionId },
      select: { consentVersion: true, consentText: true },
    })
    if (session.consentVersion !== version) {
      throw new ConflictException(
        'The consent notice has changed; reload it and decide again.',
      )
    }

    return session
  }

  // -------------------------------------------------------------------------
  // Id checks: nothing the client names is trusted
  // -------------------------------------------------------------------------

  /** Whether the participant's group includes the variant. */
  private allowedVariant(ctx: TesterContext, variantId: string): boolean {
    return !ctx.assignedVariantId || ctx.assignedVariantId === variantId
  }

  /** The variant of THIS session that the participant is allowed to see, or 404. */
  private async sessionVariant(ctx: TesterContext, variantId: string) {
    const link = this.allowedVariant(ctx, variantId)
      ? await this.prisma.sessionVariant.findUnique({
          where: {
            sessionId_variantId: { sessionId: ctx.sessionId, variantId },
          },
        })
      : null
    if (!link) {
      throw new NotFoundException('Prototype not found.')
    }

    return link
  }

  /** Assigned group, or the variant the participant picked (comparative test). */
  private async variantFor(
    ctx: TesterContext,
    requested: string | undefined,
  ): Promise<string> {
    if (ctx.assignedVariantId) {
      return ctx.assignedVariantId
    }
    if (!requested) {
      throw new BadRequestException(
        'variantId is required: say which prototype you are testing.',
      )
    }

    return (await this.sessionVariant(ctx, requested)).variantId
  }

  private async assertOwnRuns(
    ctx: TesterContext,
    runIds: string[],
  ): Promise<void> {
    if (runIds.length === 0) {
      return
    }
    const found = await this.prisma.taskRun.count({
      where: {
        id: { in: runIds },
        participantId: ctx.participantId,
        sessionId: ctx.sessionId,
      },
    })
    if (found !== runIds.length) {
      throw new NotFoundException('Task run not found.')
    }
  }

  private assertMetadata(event: InteractionEventInputDto): void {
    if (
      event.metadata &&
      Buffer.byteLength(JSON.stringify(event.metadata)) >
        MAX_EVENT_METADATA_BYTES
    ) {
      throw new BadRequestException(
        `Event metadata can be at most ${MAX_EVENT_METADATA_BYTES} bytes.`,
      )
    }
  }

  /** Starting a task again resumes it; a finished one stays finished. */
  private resumed(run: TaskRunDto): TaskRunDto {
    if (run.status !== 'IN_PROGRESS') {
      throw new ConflictException('You have already finished this task.')
    }

    return run
  }
}
