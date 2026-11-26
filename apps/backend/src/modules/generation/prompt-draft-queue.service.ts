import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

import { errorText, logEvent } from '../../common/logging/log-event'
import {
  PROMPT_DRAFT_JOB_OPTIONS,
  PROMPT_DRAFT_QUEUE,
  PromptDraftJobData,
  promptDraftJobId,
  PromptDraftProgress,
} from './generation.constants'

const ENQUEUE_TIMEOUT_MS = 5_000

/** Producer side of the `prompt-draft` queue. */
@Injectable()
export class PromptDraftQueue {
  private readonly logger = new Logger(PromptDraftQueue.name)

  constructor(
    @InjectQueue(PROMPT_DRAFT_QUEUE)
    private readonly queue: Queue<PromptDraftJobData>,
  ) {
    queue.on('error', (error) =>
      this.logger.warn(
        logEvent('queue.error', { queue: queue.name, error: errorText(error) }),
      ),
    )
  }

  /**
   * Queues a prompt-drafting job for `data.storyId`. Uses a deterministic jobId
   * so concurrent requests never enqueue duplicates for the same story.
   */
  async enqueue(data: PromptDraftJobData, force = false): Promise<void> {
    const jobId = promptDraftJobId(data.storyId)
    if (force) {
      const existing = await this.queue.getJob(jobId).catch(() => undefined)
      if (
        existing &&
        ((await existing.isCompleted()) || (await existing.isFailed()))
      ) {
        await existing.remove().catch(() => undefined)
      }
    }

    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.queue.add('draft', data, { ...PROMPT_DRAFT_JOB_OPTIONS, jobId }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('The prompt-draft queue is unavailable.')),
            ENQUEUE_TIMEOUT_MS,
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
    this.logger.log(logEvent('prompt_draft.queued', { story: data.storyId }))
  }

  /** Latest progress reported by an active prompt-draft job in Redis, if any. */
  async latestProgress(storyId: string): Promise<PromptDraftProgress | null> {
    const job = await this.queue
      .getJob(promptDraftJobId(storyId))
      .catch(() => undefined)
    if (!job) {
      return null
    }
    const progress = job.progress
    if (progress && typeof progress === 'object') {
      return progress as PromptDraftProgress
    }
    return null
  }
}
