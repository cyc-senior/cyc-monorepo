import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, UnrecoverableError } from 'bullmq'

import { HttpCacheService } from '../../cache/http-cache.service'
import { errorText, logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessService } from '../access/access.service'
import { can, Permission } from '../access/permissions'
import { LlmNotConfiguredError } from '../generation/llm-not-configured.error'
import {
  AI_TASK_QUEUE,
  AI_TASK_TIMEOUT_MS,
  AiProgress,
  AiTaskJobData,
  AiTaskKind,
} from './ai.constants'
import { AiTaskQueue } from './ai-task.queue'
import { AnalysisInputItem, FeedbackAnalyzer } from './feedback-analyzer'
import { StoryDraftInput, StoryDrafter } from './story-drafter'

/** While running, check this often whether the task was cancelled. */
const CANCEL_POLL_MS = 3_000
/** Streamed progress is relayed at most this often. */
const PROGRESS_THROTTLE_MS = 1_000

/**
 * Runs `ai-tasks` jobs: feedback analysis and story drafting. As with design
 * generation, the database row is the source of truth; the job only carries
 * the row id. Before doing anything the worker checks that the person who
 * asked still holds the permission, reads every input from the row's own
 * project (never from the job), validates the model's answer, and saves it in
 * one transaction guarded by the row's status — so a retried or duplicated job
 * cannot save twice, and nothing the AI produces is ever approved or applied
 * on its own: it lands as a proposal for a designer to review.
 */
@Processor(AI_TASK_QUEUE, { autorun: false })
export class AiTaskProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AiTaskProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyzer: FeedbackAnalyzer,
    private readonly drafter: StoryDrafter,
    private readonly cache: HttpCacheService,
    private readonly queue: AiTaskQueue,
    private readonly access: AccessService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    super()
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (error) =>
      this.logger.error(
        logEvent('ai.worker_error', { error: errorText(error) }),
      ),
    )
    if (!this.config.get('GENERATION_WORKER', { infer: true })) {
      return
    }
    this.worker.concurrency = this.config.get('GENERATION_CONCURRENCY', {
      infer: true,
    })
    this.worker
      .run()
      .catch((error: Error) =>
        this.logger.error(
          logEvent('ai.worker_stopped', { error: errorText(error) }),
        ),
      )
    this.logger.log(
      logEvent('ai.worker_started', { concurrency: this.worker.concurrency }),
    )
    void this.recoverOrphans()
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker.isRunning()) {
      this.logger.log(logEvent('ai.worker_draining'))
      await this.worker.close()
    }
  }

  async process(job: Job<AiTaskJobData>): Promise<void> {
    switch (job.data.kind) {
      case 'feedback-analysis':
        return this.runAnalysis(job)
      case 'story-generation':
        return this.runStories(job)
      default:
        throw new UnrecoverableError('Unknown task kind.')
    }
  }

  // -------------------------------------------------------------------------
  // Feedback analysis
  // -------------------------------------------------------------------------

  private async runAnalysis(job: Job<AiTaskJobData>): Promise<void> {
    const id = job.data.id
    const row = await this.prisma.feedbackAnalysis.findUnique({ where: { id } })
    if (!row) {
      throw new UnrecoverableError('The analysis no longer exists.')
    }
    const { projectId } = row
    if (
      !(await this.mayRun(
        row.requestedById,
        projectId,
        Permission.AnalysisWrite,
      ))
    ) {
      await this.prisma.feedbackAnalysis.updateMany({
        where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: 'CANCELLED',
          error: 'The requester no longer has access to run analyses.',
          finishedAt: new Date(),
        },
      })
      await this.cache.invalidate(projectId)
      this.logger.warn(logEvent('analysis.requester_unauthorized', { id }))

      return
    }
    const claimed = await this.prisma.feedbackAnalysis.updateMany({
      where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'RUNNING',
        startedAt: row.startedAt ?? new Date(),
        error: null,
      },
    })
    if (claimed.count === 0) {
      return // cancelled (or finished) before it ran
    }
    await this.cache.invalidate(projectId)
    this.logger.log(
      logEvent('analysis.started', { id, attempt: job.attemptsMade + 1 }),
    )

    const control = this.control(job, () =>
      this.isCancelled('feedbackAnalysis', id),
    )
    try {
      await job.updateProgress({ stage: 'loading' } satisfies AiProgress)
      const items = await this.loadFeedback(row)
      if (items.length === 0) {
        throw new UnrecoverableError(
          'There is no usable feedback left to analyse (it may have been withdrawn).',
        )
      }
      const analysis = await this.analyzer.analyze(items, {
        signal: control.signal,
        progress: control.progress,
      })
      await job.updateProgress({ stage: 'saving' } satisfies AiProgress)

      await this.prisma.$transaction(async (tx) => {
        const done = await tx.feedbackAnalysis.updateMany({
          where: { id, status: 'RUNNING' },
          data: {
            status: 'READY',
            aiSummary: analysis.summary,
            summary: analysis.summary,
            aiInsights: analysis.insights,
            insights: analysis.insights,
            outputMetadata: {
              usage: analysis.usage,
              themes: analysis.themes.length,
              feedback: items.length,
              unassigned: analysis.unassigned,
            },
            finishedAt: new Date(),
            error: null,
          },
        })
        if (done.count === 0) {
          throw new UnrecoverableError('Cancelled.')
        }
        if ((await tx.feedbackTheme.count({ where: { analysisId: id } })) > 0) {
          return // a previous attempt already saved them
        }
        for (const theme of analysis.themes) {
          const created = await tx.feedbackTheme.create({
            data: {
              analysisId: id,
              origin: 'AI',
              status: 'PROPOSED',
              aiTitle: theme.title,
              aiSummary: theme.summary,
              aiCategory: theme.category,
              aiSeverity: theme.severity,
              title: theme.title,
              summary: theme.summary,
              category: theme.category,
              severity: theme.severity,
              labels: theme.labels,
            },
            select: { id: true },
          })
          await tx.themeFeedback.createMany({
            data: theme.feedbackIds.map((feedbackId) => ({
              themeId: created.id,
              feedbackId,
            })),
          })
        }
      })
      await this.cache.invalidate(projectId)
      this.logger.log(
        logEvent('analysis.succeeded', {
          id,
          themes: analysis.themes.length,
          promptTokens: analysis.usage.promptTokens,
          completionTokens: analysis.usage.completionTokens,
        }),
      )
    } catch (error) {
      await this.fail(
        'feedbackAnalysis',
        job,
        projectId,
        error,
        control.cancelled(),
      )
      throw this.thrown(error, control.cancelled())
    } finally {
      control.stop()
    }
  }

  /**
   * The raw feedback of the analysis, re-read from the analysis's OWN project
   * (the ids on the row are only a snapshot; anything outside the project, with
   * no text, or from a participant who withdrew is left out). Participant
   * identity is never selected.
   */
  private async loadFeedback(row: {
    id: string
    projectId: string
    inputFeedbackIds: Prisma.JsonValue
  }): Promise<AnalysisInputItem[]> {
    const ids = (row.inputFeedbackIds as string[]) ?? []
    const feedback = await this.prisma.feedback.findMany({
      where: {
        id: { in: ids },
        skipped: false,
        comment: { not: null },
        session: { projectId: row.projectId },
        participant: { status: { not: 'WITHDRAWN' } },
      },
      select: {
        id: true,
        scope: true,
        screenId: true,
        nodeId: true,
        rating: true,
        comment: true,
        variant: { select: { label: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return feedback.map((f) => ({
      id: f.id,
      scope: f.scope,
      variantLabel: f.variant.label,
      screenId: f.screenId,
      nodeId: f.nodeId,
      rating: f.rating,
      comment: f.comment ?? '',
    }))
  }

  // -------------------------------------------------------------------------
  // Story drafting
  // -------------------------------------------------------------------------

  private async runStories(job: Job<AiTaskJobData>): Promise<void> {
    const id = job.data.id
    const row = await this.prisma.storyGeneration.findUnique({
      where: { id },
      include: { project: { select: { name: true, description: true } } },
    })
    if (!row) {
      throw new UnrecoverableError('The story generation no longer exists.')
    }
    const { projectId } = row
    if (
      !(await this.mayRun(row.requestedById, projectId, Permission.DesignWrite))
    ) {
      await this.prisma.storyGeneration.updateMany({
        where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: 'CANCELLED',
          error: 'The requester no longer has access to write designs.',
          finishedAt: new Date(),
        },
      })
      await this.cache.invalidate(projectId)

      return
    }
    const claimed = await this.prisma.storyGeneration.updateMany({
      where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'RUNNING',
        startedAt: row.startedAt ?? new Date(),
        error: null,
      },
    })
    if (claimed.count === 0) {
      return
    }
    await this.cache.invalidate(projectId)
    this.logger.log(
      logEvent('stories.started', { id, attempt: job.attemptsMade + 1 }),
    )

    const control = this.control(job, () =>
      this.isCancelled('storyGeneration', id),
    )
    try {
      const input = row.inputSnapshot as unknown as StoryDraftInput
      const drafted = await this.drafter.draft(
        { ...input, count: row.count },
        { signal: control.signal, progress: control.progress },
      )
      await job.updateProgress({ stage: 'saving' } satisfies AiProgress)

      await this.prisma.$transaction(async (tx) => {
        const done = await tx.storyGeneration.updateMany({
          where: { id, status: 'RUNNING' },
          data: {
            status: 'SUCCEEDED',
            finishedAt: new Date(),
            outputMetadata: {
              usage: drafted.usage,
              stories: drafted.stories.length,
            },
          },
        })
        if (done.count === 0) {
          throw new UnrecoverableError('Cancelled.')
        }
        if ((await tx.userStory.count({ where: { generationId: id } })) > 0) {
          return // a previous attempt already saved them
        }
        await tx.userStory.createMany({
          data: drafted.stories.map((story) => ({
            projectId,
            generationId: id,
            origin: 'AI' as const,
            // A draft: a designer reviews it and marks it READY.
            status: 'DRAFT' as const,
            ...story,
          })),
        })
      })
      await this.cache.invalidate(projectId)
      this.logger.log(
        logEvent('stories.succeeded', { id, stories: drafted.stories.length }),
      )
    } catch (error) {
      await this.fail(
        'storyGeneration',
        job,
        projectId,
        error,
        control.cancelled(),
      )
      throw this.thrown(error, control.cancelled())
    } finally {
      control.stop()
    }
  }

  // -------------------------------------------------------------------------
  // Shared
  // -------------------------------------------------------------------------

  /** A queued task runs with its requester's rights *now*, not when it was queued. */
  private async mayRun(
    requesterId: string | null,
    projectId: string,
    permission: Permission,
  ): Promise<boolean> {
    if (!requesterId) {
      return false
    }
    const access = await this.access.forProject(requesterId, projectId)

    return access !== null && can(access.role, permission)
  }

  /** Abort signal (cancel poll + hard timeout) and throttled progress reporting. */
  private control(
    job: Job<AiTaskJobData>,
    isCancelled: () => Promise<boolean>,
  ) {
    const abort = new AbortController()
    const watcher = setInterval(() => {
      void isCancelled().then((cancelled) => cancelled && abort.abort())
    }, CANCEL_POLL_MS)
    const timeout = AbortSignal.timeout(AI_TASK_TIMEOUT_MS)
    let lastSent = 0

    return {
      signal: AbortSignal.any([abort.signal, timeout]),
      progress: (progress: AiProgress) => {
        const now = Date.now()
        if (
          progress.receivedChars !== undefined &&
          now - lastSent < PROGRESS_THROTTLE_MS
        ) {
          return
        }
        lastSent = now
        void job.updateProgress(progress).catch(() => undefined)
      },
      /** Cancelled by a person (a timeout is a transient failure, not a cancellation). */
      cancelled: () => abort.signal.aborted,
      stop: () => clearInterval(watcher),
    }
  }

  private async isCancelled(
    table: 'feedbackAnalysis' | 'storyGeneration',
    id: string,
  ): Promise<boolean> {
    const delegate = this.prisma[table] as unknown as {
      findUnique: (args: unknown) => Promise<{ status: string } | null>
    }
    const row = await delegate
      .findUnique({ where: { id }, select: { status: true } })
      .catch(() => null)

    return row?.status === 'CANCELLED'
  }

  /** Records a failure: final ones (no retry left) mark the row FAILED. */
  private async fail(
    table: 'feedbackAnalysis' | 'storyGeneration',
    job: Job<AiTaskJobData>,
    projectId: string,
    error: unknown,
    cancelled: boolean,
  ): Promise<void> {
    const id = job.data.id
    const message = error instanceof Error ? error.message : String(error)
    const final =
      cancelled ||
      error instanceof UnrecoverableError ||
      error instanceof LlmNotConfiguredError ||
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
    this.logger.warn(
      logEvent('ai.task_failed', {
        kind: job.data.kind satisfies AiTaskKind,
        id,
        final,
        error: message,
      }),
    )
    // Only a RUNNING row is ours to change; a cancelled one stays cancelled.
    const delegate = this.prisma[table] as unknown as {
      updateMany: (args: unknown) => Promise<unknown>
    }
    await delegate.updateMany({
      where: { id, status: 'RUNNING' },
      data: final
        ? { status: 'FAILED', error: message, finishedAt: new Date() }
        : { status: 'QUEUED', error: `Retrying after: ${message}` },
    })
    await this.cache.invalidate(projectId)
  }

  private thrown(error: unknown, cancelled: boolean): unknown {
    return error instanceof LlmNotConfiguredError || cancelled
      ? new UnrecoverableError((error as Error).message)
      : error
  }

  /**
   * Reconciles the database with the queue on start: an active row whose queue
   * entry is gone (e.g. Redis was flushed) is queued again; one the queue has
   * already settled without the database knowing is marked FAILED.
   */
  private async recoverOrphans(): Promise<void> {
    try {
      const [analyses, stories] = await Promise.all([
        this.prisma.feedbackAnalysis.findMany({
          where: { status: { in: ['QUEUED', 'RUNNING'] } },
          select: { id: true, projectId: true },
          take: 500,
        }),
        this.prisma.storyGeneration.findMany({
          where: { status: { in: ['QUEUED', 'RUNNING'] } },
          select: { id: true, projectId: true },
          take: 500,
        }),
      ])
      const pending = [
        ...analyses.map((r) => ({ ...r, kind: 'feedback-analysis' as const })),
        ...stories.map((r) => ({ ...r, kind: 'story-generation' as const })),
      ]
      for (const { id, projectId, kind } of pending) {
        const state = await this.queue.state(id)
        if (state === 'missing') {
          await this.queue.enqueue(kind, id)
          this.logger.warn(logEvent('ai.requeued', { kind, id }))
        } else if (state === 'completed' || state === 'failed') {
          const data = {
            status: 'FAILED' as const,
            error: 'The queue lost track of this job; run it again.',
            finishedAt: new Date(),
          }
          const where = {
            id,
            status: { in: ['QUEUED' as const, 'RUNNING' as const] },
          }
          if (kind === 'feedback-analysis') {
            await this.prisma.feedbackAnalysis.updateMany({ where, data })
          } else {
            await this.prisma.storyGeneration.updateMany({ where, data })
          }
          await this.cache.invalidate(projectId)
          this.logger.warn(logEvent('ai.orphaned', { kind, id, state }))
        }
      }
    } catch (error) {
      this.logger.error(
        logEvent('ai.recovery_failed', { error: errorText(error) }),
      )
    }
  }
}
