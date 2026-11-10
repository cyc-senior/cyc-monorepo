import { MessageEvent } from '@nestjs/common'
import {
  concatMap,
  defer,
  interval,
  map,
  merge,
  Observable,
  of,
  takeWhile,
} from 'rxjs'

import { AiTaskEvents } from './ai-task.events'

/** Keeps proxies from closing an idle stream. */
const HEARTBEAT_MS = 15_000
/** How long a client waits before reconnecting a dropped stream. */
const RECONNECT_MS = 3_000

export interface JobSnapshot {
  /** `status`, or one of the final event types. */
  type: string
  data: Record<string, unknown>
}

/**
 * Server-sent events for one queued job. The caller has ALREADY checked that
 * the requesting user may see this job (the lookup went through the project);
 * the stream carries only that job's state, read fresh from the database on
 * every signal. Live events are subscribed to before the state is read, so
 * none is lost in between; a reconnecting client gets the current state again.
 */
export function streamJob(
  events: AiTaskEvents,
  jobId: string,
  snapshot: () => Promise<JobSnapshot>,
  finalTypes: readonly string[],
): Observable<MessageEvent> {
  let sequence = 0
  const live = events.forJob(jobId).pipe(
    concatMap((signal) =>
      signal.kind === 'progress'
        ? of<MessageEvent>({
            type: 'progress',
            data: { jobId, ...signal.progress },
          })
        : defer(snapshot),
    ),
  )
  const heartbeat = interval(HEARTBEAT_MS).pipe(
    map((): MessageEvent => ({ type: 'heartbeat', data: { jobId } })),
  )

  return merge(live, defer(snapshot), heartbeat).pipe(
    takeWhile((event) => !finalTypes.includes(event.type), true),
    map((event) => ({
      ...event,
      id: String(++sequence),
      retry: sequence === 1 ? RECONNECT_MS : undefined,
    })),
  )
}
