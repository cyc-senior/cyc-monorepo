import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import { filter, Observable, Subject } from 'rxjs'

import { errorText, logEvent } from '../../common/logging/log-event'
import {
  DESIGN_GENERATION_QUEUE,
  GenerationProgress,
} from './generation.constants'

/** A queue event about one job: progress, or "its state changed, re-read it". */
export type GenerationSignal =
  | { jobId: string; kind: 'progress'; progress: GenerationProgress }
  | { jobId: string; kind: 'changed' }

/**
 * Relays BullMQ queue events (published through Redis by whichever process
 * runs the worker) to subscribers in this process, e.g. SSE streams. One
 * Redis subscription per process, however many clients listen.
 */
@QueueEventsListener(DESIGN_GENERATION_QUEUE)
export class GenerationEvents
  extends QueueEventsHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(GenerationEvents.name)
  private readonly signals = new Subject<GenerationSignal>()

  onApplicationBootstrap(): void {
    this.queueEvents.on('error', (error) =>
      this.logger.warn(
        logEvent('queue.events_error', { error: errorText(error) }),
      ),
    )
  }

  forJob(jobId: string): Observable<GenerationSignal> {
    return this.signals.pipe(filter((signal) => signal.jobId === jobId))
  }

  @OnQueueEvent('progress')
  onProgress({ jobId, data }: { jobId: string; data: unknown }): void {
    if (data && typeof data === 'object') {
      this.signals.next({
        jobId,
        kind: 'progress',
        progress: data as GenerationProgress,
      })
    }
  }

  @OnQueueEvent('active')
  onActive({ jobId }: { jobId: string }): void {
    this.changed(jobId)
  }

  @OnQueueEvent('completed')
  onCompleted({ jobId }: { jobId: string }): void {
    this.changed(jobId)
  }

  @OnQueueEvent('failed')
  onFailed({ jobId }: { jobId: string }): void {
    this.changed(jobId)
  }

  @OnQueueEvent('removed')
  onRemoved({ jobId }: { jobId: string }): void {
    this.changed(jobId)
  }

  @OnQueueEvent('delayed')
  onDelayed({ jobId }: { jobId: string }): void {
    this.changed(jobId)
  }

  private changed(jobId: string): void {
    this.signals.next({ jobId, kind: 'changed' })
  }
}
