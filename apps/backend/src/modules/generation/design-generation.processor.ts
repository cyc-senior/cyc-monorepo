import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, UnrecoverableError } from 'bullmq'

import { HttpCacheService } from '../../cache/http-cache.service'
import { errorText, logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  GeneratedDesign,
  toGeneratedDesign,
} from '../design/document/design-document'
import { UI_KITS } from '../design/document/ui-kits'
import { DesignGenerator, VariantResult } from './design-generator.service'
import { GenerationInput } from './design-prompts'
import {
  DESIGN_GENERATION_QUEUE,
  DesignGenerationJobData,
  GenerationProgress,
} from './generation.constants'
import { GenerationQueue } from './generation-queue.service'
import { LlmNotConfiguredError } from './llm-not-configured.error'

export interface DesignGenerationResult {
  variantIds: string[]
  failedVariants: number
}

/** While generating, check this often whether the job was cancelled. */
const CANCEL_POLL_MS = 3_000
/** Streamed progress is relayed at most this often. */
const PROGRESS_THROTTLE_MS = 1_000
const VARIANT_LABELS = 'ABCDEFGH'

/**
 * Runs design generation jobs from the `design-generation` queue. The
 * database row is the source of truth for status; BullMQ provides retries
 * with backoff, stalled-job recovery and cross-process events (SSE).
 *
 * Variants are written in one transaction at the end, so a retried attempt
 * never duplicates them, and only if the job was not cancelled meanwhile.
 */
@Processor(DESIGN_GENERATION_QUEUE, { autorun: false })
export class DesignGenerationProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DesignGenerationProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: DesignGenerator,
    private readonly cache: HttpCacheService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly queue: GenerationQueue,
  ) {
    super()
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (error) =>
      this.logger.error(
        logEvent('generation.worker_error', { error: errorText(error) }),
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
          logEvent('generation.worker_stopped', { error: errorText(error) }),
        ),
      )
    this.logger.log(
      logEvent('generation.worker_started', {
        concurrency: this.worker.concurrency,
      }),
    )
    void this.recoverOrphans()
  }

  /**
   * Stops taking jobs as soon as shutdown starts (before the database and the
   * cache go away) and waits for the running ones to finish. A process killed
   * meanwhile leaves them stalled; BullMQ then hands them to another worker.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.worker.isRunning()) {
      this.logger.log(logEvent('generation.worker_draining'))
      await this.worker.close()
    }
  }

  /**
   * Reconciles the database with the queue on start: an active job whose queue
   * entry is gone (e.g. Redis was flushed) is queued again; one the queue has
   * already settled without the database knowing is marked FAILED.
   */
  private async recoverOrphans(): Promise<void> {
    try {
      const jobs = await this.prisma.generationJob.findMany({
        where: { status: { in: ['QUEUED', 'RUNNING'] } },
        select: { id: true, round: { select: { projectId: true } } },
        take: 500,
      })
      for (const { id, round } of jobs) {
        const state = await this.queue.state(id)
        if (state === 'missing') {
          await this.queue.enqueue(id)
          this.logger.warn(logEvent('generation.requeued', { job: id }))
        } else if (state === 'completed' || state === 'failed') {
          await this.prisma.generationJob.updateMany({
            where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
            data: {
              status: 'FAILED',
              error: 'The queue lost track of this job; generate again.',
              finishedAt: new Date(),
            },
          })
          await this.cache.invalidate(round.projectId)
          this.logger.warn(logEvent('generation.orphaned', { job: id, state }))
        }
      }
    } catch (error) {
      this.logger.error(
        logEvent('generation.recovery_failed', {
          error: (error as Error).message,
        }),
      )
    }
  }

  async process(
    job: Job<DesignGenerationJobData>,
  ): Promise<DesignGenerationResult> {
    const id = job.data.generationJobId
    const row = await this.prisma.generationJob.findUnique({
      where: { id },
      include: { round: { select: { projectId: true } } },
    })
    if (!row) {
      throw new UnrecoverableError('Generation job no longer exists.')
    }
    const { projectId } = row.round
    const claimed = await this.prisma.generationJob.updateMany({
      where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'RUNNING',
        startedAt: row.startedAt ?? new Date(),
        error: null,
      },
    })
    if (claimed.count === 0) {
      // Cancelled (or already finished) before it ran.
      return { variantIds: [], failedVariants: 0 }
    }
    await this.cache.invalidate(projectId)
    this.logger.log(
      logEvent('generation.started', {
        job: id,
        attempt: job.attemptsMade + 1,
      }),
    )

    const abort = new AbortController()
    const watcher = setInterval(
      () => void this.abortIfCancelled(id, abort),
      CANCEL_POLL_MS,
    )
    try {
      const results = await this.generateAll(
        job,
        row.uiLibrary,
        row.variantCount,
        row.inputSnapshot,
        abort.signal,
      )
      await job.updateProgress({
        stage: 'saving',
        of: row.variantCount,
      } satisfies GenerationProgress)

      return await this.save(id, projectId, row.roundId, results)
    } catch (error) {
      await this.fail(job, projectId, error, abort.signal.aborted)
      throw error instanceof LlmNotConfiguredError || abort.signal.aborted
        ? new UnrecoverableError((error as Error).message)
        : error
    } finally {
      clearInterval(watcher)
    }
  }

  private async generateAll(
    job: Job<DesignGenerationJobData>,
    library: keyof typeof UI_KITS,
    total: number,
    snapshot: Prisma.JsonValue,
    signal: AbortSignal,
  ): Promise<VariantResult[]> {
    const kit = UI_KITS[library]
    const input = snapshot as unknown as GenerationInput
    const results: VariantResult[] = []
    const previous: GeneratedDesign[] = []
    await job.updateProgress({
      stage: 'started',
      of: total,
    } satisfies GenerationProgress)

    for (let index = 1; index <= total; index++) {
      let lastSent = 0
      const result = await this.generator.generate(
        { kit, input, index, total, previous },
        {
          signal,
          progress: (progress) => {
            const now = Date.now()
            if (
              progress.receivedChars !== undefined &&
              now - lastSent < PROGRESS_THROTTLE_MS
            ) {
              return
            }
            lastSent = now
            void job
              .updateProgress({
                ...progress,
                variant: index,
                of: total,
              } satisfies GenerationProgress)
              .catch(() => undefined)
          },
        },
      )
      results.push(result)
      if (result.passed) {
        previous.push(toGeneratedDesign(result.document))
      }
    }

    return results
  }

  private async save(
    id: string,
    projectId: string,
    roundId: string,
    results: VariantResult[],
  ): Promise<DesignGenerationResult> {
    const usage = results.reduce(
      (sum, r) => ({
        promptTokens: sum.promptTokens + r.usage.promptTokens,
        completionTokens: sum.completionTokens + r.usage.completionTokens,
      }),
      { promptTokens: 0, completionTokens: 0 },
    )
    const summary = results.map((r, i) => ({
      variant: i + 1,
      passed: r.passed,
      attempts: r.attempts,
      ...('issues' in r
        ? { issues: r.issues.slice(0, 20) }
        : { autoFixed: r.autoFixed, warnings: r.accessibility.warnings }),
    }))
    const passed = results.filter(
      (r): r is Extract<VariantResult, { passed: true }> => r.passed,
    )
    if (passed.length === 0) {
      // Keep the per-variant issues; fail() then marks the job FAILED.
      await this.prisma.generationJob.update({
        where: { id },
        data: {
          outputMetadata: {
            usage,
            variants: summary,
          } as Prisma.InputJsonObject,
        },
      })
      throw new UnrecoverableError(
        `No design passed the UI kit and WCAG 2.0 checks: ${firstIssues(results)}`,
      )
    }

    const variantIds = await this.prisma.$transaction(async (tx) => {
      const done = await tx.generationJob.updateMany({
        where: { id, status: 'RUNNING' },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          outputMetadata: {
            usage,
            variants: summary,
          } as Prisma.InputJsonObject,
        },
      })
      if (done.count === 0) {
        throw new UnrecoverableError('Cancelled.')
      }
      const job = await tx.generationJob.findUniqueOrThrow({
        where: { id },
        select: { inputSnapshot: true },
      })
      const storyIds = (
        job.inputSnapshot as unknown as GenerationInput
      ).stories.map((s) => s.id)
      const existing = await tx.userStory.findMany({
        where: { id: { in: storyIds }, projectId },
        select: { id: true },
      })
      const ids: string[] = []
      for (const [i, result] of passed.entries()) {
        const variant = await tx.uIVariant.create({
          data: {
            roundId,
            generationJobId: id,
            name: result.document.name,
            label: VARIANT_LABELS[i],
            uiLibrary: result.document.uiLibrary,
            design: result.document as unknown as Prisma.InputJsonObject,
            accessibility:
              result.accessibility as unknown as Prisma.InputJsonObject,
            status: 'READY',
            stories: { connect: existing },
          },
          select: { id: true },
        })
        ids.push(variant.id)
      }

      return ids
    })
    await this.cache.invalidate(projectId)
    this.logger.log(
      logEvent('generation.succeeded', {
        job: id,
        variants: variantIds.length,
        failed: results.length - passed.length,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      }),
    )

    return { variantIds, failedVariants: results.length - passed.length }
  }

  /** Records a failure: final ones (no retry left) mark the job FAILED. */
  private async fail(
    job: Job<DesignGenerationJobData>,
    projectId: string,
    error: unknown,
    cancelled: boolean,
  ): Promise<void> {
    const id = job.data.generationJobId
    const message = error instanceof Error ? error.message : String(error)
    const final =
      cancelled ||
      error instanceof UnrecoverableError ||
      error instanceof LlmNotConfiguredError ||
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
    if (cancelled) {
      this.logger.log(logEvent('generation.cancelled', { job: id }))
    } else {
      this.logger.warn(
        logEvent('generation.failed', { job: id, final, error: message }),
      )
    }
    // Only a RUNNING job is ours to change; a cancelled one stays cancelled.
    await this.prisma.generationJob.updateMany({
      where: { id, status: 'RUNNING' },
      data: final
        ? { status: 'FAILED', error: message, finishedAt: new Date() }
        : { status: 'QUEUED', error: `Retrying after: ${message}` },
    })
    await this.cache.invalidate(projectId)
  }

  private async abortIfCancelled(
    id: string,
    abort: AbortController,
  ): Promise<void> {
    const row = await this.prisma.generationJob
      .findUnique({ where: { id }, select: { status: true } })
      .catch(() => null)
    if (row?.status === 'CANCELLED') {
      abort.abort()
    }
  }
}

function firstIssues(results: VariantResult[]): string {
  const issues = results
    .flatMap((r) => ('issues' in r ? r.issues : []))
    .slice(0, 3)

  return issues
    .map((i) => (i.criterion ? `WCAG ${i.criterion}: ` : '') + i.message)
    .join('; ')
}
