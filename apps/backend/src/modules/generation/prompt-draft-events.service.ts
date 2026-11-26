import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import { filter, Observable, Subject } from 'rxjs'

import { errorText, logEvent } from '../../common/logging/log-event'
import {
  PROMPT_DRAFT_QUEUE,
  promptDraftJobId,
  PromptDraftProgress,
} from './generation.constants'

export type PromptDraftSignal =
  | { jobId: string; kind: 'progress'; progress: PromptDraftProgress }
  | { jobId: string; kind: 'changed' }

/**
 * Relays BullMQ `prompt-draft` queue events (published through Redis) to
 * SSE subscribers in this process.
 */
@QueueEventsListener(PROMPT_DRAFT_QUEUE)
export class PromptDraftEvents
  extends QueueEventsHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(PromptDraftEvents.name)
  private readonly signals = new Subject<PromptDraftSignal>()

  onApplicationBootstrap(): void {
    this.queueEvents.on('error', (error) =>
      this.logger.warn(
        logEvent('queue.events_error', { error: errorText(error) }),
      ),
    )
  }

  forStory(storyId: string): Observable<PromptDraftSignal> {
    const targetId = promptDraftJobId(storyId)
    return this.signals.pipe(filter((signal) => signal.jobId === targetId))
  }

  @OnQueueEvent('progress')
  onProgress({ jobId, data }: { jobId: string; data: unknown }): void {
    if (data && typeof data === 'object') {
      this.signals.next({
        jobId,
        kind: 'progress',
        progress: data as PromptDraftProgress,
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

  private changed(jobId: string): void {
    this.signals.next({ jobId, kind: 'changed' })
  }
}
