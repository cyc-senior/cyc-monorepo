import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

import { errorText, logEvent } from '../../common/logging/log-event'
import {
  DESIGN_GENERATION_QUEUE,
  DESIGN_JOB_OPTIONS,
  DesignGenerationJobData,
} from './generation.constants'

/** A request must not hang on a Redis outage. */
const ENQUEUE_TIMEOUT_MS = 5_000

/** Producer side of the `design-generation` queue. */
@Injectable()
export class GenerationQueue {
  private readonly logger = new Logger(GenerationQueue.name)

  constructor(
    @InjectQueue(DESIGN_GENERATION_QUEUE)
    private readonly queue: Queue<DesignGenerationJobData>,
  ) {
    // An unhandled `error` event would crash the process on a Redis outage.
    queue.on('error', (error) =>
      this.logger.warn(
        logEvent('queue.error', { queue: queue.name, error: errorText(error) }),
      ),
    )
  }

  /** Queues a job; the BullMQ job id is the generation job id, so it is idempotent. */
  async enqueue(generationJobId: string): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.queue.add(
          'generate',
          { generationJobId },
          { ...DESIGN_JOB_OPTIONS, jobId: generationJobId },
        ),
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
    this.logger.log(logEvent('generation.queued', { job: generationJobId }))
  }

  /** BullMQ state of a job (`waiting`, `active`, `completed`, `failed`, ...), or `missing`. */
  async state(generationJobId: string): Promise<string> {
    const job = await this.queue.getJob(generationJobId)

    return job ? job.getState() : 'missing'
  }

  /**
   * Takes a job that has not started off the queue. A running job is left
   * alone: its worker notices the cancellation and stops.
   */
  async withdraw(generationJobId: string): Promise<void> {
    const job = await this.queue.getJob(generationJobId)
    if (job && ((await job.isWaiting()) || (await job.isDelayed()))) {
      await job.remove().catch(() => undefined)
    }
  }
}
