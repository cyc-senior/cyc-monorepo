import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, UnrecoverableError } from 'bullmq'

import { errorText, logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  PROMPT_DRAFT_QUEUE,
  PromptDraftJobData,
  PromptDraftProgress,
} from './generation.constants'
import { LlmNotConfiguredError } from './llm-not-configured.error'
import { PromptDrafter } from './prompt-drafter'

const PROGRESS_THROTTLE_MS = 400

/**
 * Runs structured prompt drafting jobs from the `prompt-draft` queue so
 * refreshing or closing the browser does not cancel an in-flight draft.
 */
@Processor(PROMPT_DRAFT_QUEUE, { autorun: false })
export class PromptDraftProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PromptDraftProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly drafter: PromptDrafter,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    super()
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (error) =>
      this.logger.error(
        logEvent('prompt_draft.worker_error', { error: errorText(error) }),
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
          logEvent('prompt_draft.worker_stopped', { error: errorText(error) }),
        ),
      )
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker.isRunning()) {
      await this.worker.close()
    }
  }

  async process(job: Job<PromptDraftJobData>): Promise<void> {
    const { projectId, storyId, personaId } = job.data

    if (!this.drafter.configured) {
      await this.markFailed(
        storyId,
        'LLM provider is not configured on the backend. Please verify LLM_BASE_URL and LLM_API_KEY.',
      )
      throw new UnrecoverableError('LLM provider is not configured.')
    }

    await this.prisma.userStory.updateMany({
      where: { id: storyId, projectId },
      data: { draftStatus: 'RUNNING', draftError: null },
    })

    const [story, intent, persona] = await Promise.all([
      this.prisma.userStory.findFirst({
        where: { id: storyId, projectId },
      }),
      this.prisma.designIntent.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
      }),
      personaId
        ? this.prisma.userPersona.findFirst({
            where: { id: personaId, projectId },
          })
        : this.prisma.userPersona.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
          }),
    ])

    if (!story) {
      throw new UnrecoverableError('User story not found.')
    }

    const reportProgress = (progress: PromptDraftProgress) => {
      void job.updateProgress(progress).catch(() => undefined)
    }

    reportProgress({
      status: 'Drafting your prompt with AI...',
      stage: 'drafting',
    })

    let lastSent = 0
    const throttled = (progress: PromptDraftProgress) => {
      const now = Date.now()
      if (now - lastSent < PROGRESS_THROTTLE_MS) {
        return
      }
      lastSent = now
      reportProgress(progress)
    }

    let lastThought = ''
    let thoughtStartedAt = 0
    let thoughtDurationSeconds: number | undefined

    try {
      const parsed = await this.drafter.draft(
        { story, intent, persona },
        {
          onThought: (thought) => {
            if (!thoughtStartedAt) {
              thoughtStartedAt = Date.now()
            }
            lastThought = thought
            throttled({
              status: 'Reasoning about prompt strategy...',
              stage: 'llm_streaming',
              thought,
              thoughtChars: thought.length,
            })
          },
          onDelta: (charsReceived) => {
            if (thoughtStartedAt && thoughtDurationSeconds === undefined) {
              thoughtDurationSeconds = Math.max(
                1,
                Math.round((Date.now() - thoughtStartedAt) / 1000),
              )
            }
            throttled({
              status: 'Drafting your prompt with AI...',
              stage: 'llm_streaming',
              charsReceived,
              ...(lastThought ? { thoughtChars: lastThought.length } : {}),
              ...(thoughtDurationSeconds === undefined
                ? {}
                : { thoughtDurationSeconds }),
            })
          },
        },
      )

      if (thoughtStartedAt && thoughtDurationSeconds === undefined) {
        thoughtDurationSeconds = Math.max(
          1,
          Math.round((Date.now() - thoughtStartedAt) / 1000),
        )
      }

      const savedDraft = {
        ...parsed,
        ...(persona?.id ? { personaId: persona.id } : {}),
        ...(lastThought ? { thoughtChars: lastThought.length } : {}),
        ...(thoughtDurationSeconds === undefined
          ? {}
          : { thoughtDurationSeconds }),
      }

      await this.prisma.userStory.update({
        where: { id: story.id },
        data: {
          draftPrompt: savedDraft as Prisma.InputJsonValue,
          draftStatus: 'SUCCEEDED',
          draftError: null,
        },
      })
      this.logger.log(logEvent('prompt_draft.succeeded', { story: storyId }))
    } catch (err: unknown) {
      const message = errorText(err)
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      if (err instanceof LlmNotConfiguredError || isFinalAttempt) {
        await this.markFailed(storyId, message)
      }
      if (err instanceof LlmNotConfiguredError) {
        throw new UnrecoverableError(message)
      }
      throw err
    }
  }

  private async markFailed(storyId: string, message: string): Promise<void> {
    await this.prisma.userStory
      .update({
        where: { id: storyId },
        data: { draftStatus: 'FAILED', draftError: message },
      })
      .catch(() => undefined)
  }
}
