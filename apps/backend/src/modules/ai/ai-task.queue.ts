import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

import { errorText, logEvent } from '../../common/logging/log-event'
import {
  AI_JOB_OPTIONS,
  AI_TASK_QUEUE,
  AiTaskJobData,
  AiTaskKind,
} from './ai.constants'

/** A request must not hang on a Redis outage. */
const ENQUEUE_TIMEOUT_MS = 5_000

/** Producer side of the `ai-tasks` queue. */
@Injectable()
export class AiTaskQueue {
  private readonly logger = new Logger(AiTaskQueue.name)

  constructor(
    @InjectQueue(AI_TASK_QUEUE) private readonly queue: Queue<AiTaskJobData>,
  ) {
    // An unhandled `error` event would crash the process on a Redis outage.
    queue.on('error', (error) =>
      this.logger.warn(
        logEvent('queue.error', { queue: queue.name, error: errorText(error) }),
      ),
    )
  }

  /** Queues a task. The BullMQ job id is the row id, so enqueueing twice is harmless. */
  async enqueue(kind: AiTaskKind, id: string): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.queue.add(kind, { kind, id }, { ...AI_JOB_OPTIONS, jobId: id }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('The job queue is unavailable.')),
            ENQUEUE_TIMEOUT_MS,
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
    this.logger.log(logEvent('ai.queued', { kind, id }))
  }

  /** BullMQ state of a job, or `missing`. */
  async state(id: string): Promise<string> {
    const job = await this.queue.getJob(id)

    return job ? job.getState() : 'missing'
  }

  /** Takes a task that has not started off the queue. */
  async withdraw(id: string): Promise<void> {
    const job = await this.queue.getJob(id)
    if (job && ((await job.isWaiting()) || (await job.isDelayed()))) {
      await job.remove().catch(() => undefined)
    }
  }
}
