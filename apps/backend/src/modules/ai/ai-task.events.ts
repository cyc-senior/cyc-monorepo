import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import { filter, Observable, Subject } from 'rxjs'

import { errorText, logEvent } from '../../common/logging/log-event'
import { AI_TASK_QUEUE, AiProgress } from './ai.constants'

export type AiSignal =
  | { jobId: string; kind: 'progress'; progress: AiProgress }
  | { jobId: string; kind: 'changed' }

/**
 * Relays queue events (published through Redis by whichever process runs the
 * worker) to SSE streams in this process. Signals only say "job X changed";
 * the stream then reads the database, so what a subscriber sees is decided by
 * the authorized lookup it made, never by the event.
 */
@QueueEventsListener(AI_TASK_QUEUE)
export class AiTaskEvents
  extends QueueEventsHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(AiTaskEvents.name)
  private readonly signals = new Subject<AiSignal>()

  onApplicationBootstrap(): void {
    this.queueEvents.on('error', (error) =>
      this.logger.warn(
        logEvent('queue.events_error', { error: errorText(error) }),
      ),
    )
  }

  forJob(jobId: string): Observable<AiSignal> {
    return this.signals.pipe(filter((signal) => signal.jobId === jobId))
  }

  @OnQueueEvent('progress')
  onProgress({ jobId, data }: { jobId: string; data: unknown }): void {
    if (data && typeof data === 'object') {
      this.signals.next({
        jobId,
        kind: 'progress',
        progress: data as AiProgress,
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
