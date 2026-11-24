import { MessageEvent } from '@nestjs/common'
import { lastValueFrom, Subject, toArray } from 'rxjs'

import { GenerationJobStatus } from '../../generated/prisma/client'
import { GenerationSignal } from '../generation/generation-events.service'
import { GenerationJobsService } from './generation-jobs.service'

const JOB = 'job-1'

describe('GenerationJobsService.stream', () => {
  let status: GenerationJobStatus
  let signals: Subject<GenerationSignal>
  let service: GenerationJobsService

  beforeEach(() => {
    status = 'QUEUED'
    signals = new Subject()
    const row = () => ({
      id: JOB,
      status,
      error: null,
      startedAt: null,
      finishedAt: null,
      variants: status === 'SUCCEEDED' ? [{ id: 'v-1' }, { id: 'v-2' }] : [],
    })
    const prisma = {
      generationJob: {
        findFirstOrThrow: jest.fn(async () => row()),
        findUniqueOrThrow: jest.fn(async () => row()),
      },
    }
    const events = { forJob: () => signals.asObservable() }
    service = new GenerationJobsService(
      prisma as never,
      {} as never,
      events as never,
      {} as never,
    )
  })

  /** Event types and statuses in order, without heartbeats. */
  const summary = (events: MessageEvent[]) =>
    events.map((e) => {
      const data = e.data as { status?: string; stage?: string }
      return `${e.type}:${data.status ?? data.stage}`
    })

  it('reports RUNNING once the worker has started, not only the final state', async () => {
    const stream = await service.stream('p-1', JOB)
    const collected = lastValueFrom(stream.pipe(toArray()))
    await flush()

    // BullMQ's `active` fires before the worker claims the row...
    signals.next({ jobId: JOB, kind: 'changed' })
    await flush()
    // ...and the worker reports `started` right after it marked it RUNNING.
    status = 'RUNNING'
    signals.next({
      jobId: JOB,
      kind: 'progress',
      progress: { stage: 'started', of: 2 },
    })
    signals.next({
      jobId: JOB,
      kind: 'progress',
      progress: { stage: 'generating', variant: 1, of: 2, attempt: 1 },
    })
    await flush()
    status = 'SUCCEEDED'
    signals.next({ jobId: JOB, kind: 'changed' })

    expect(summary(await collected)).toEqual([
      'status:QUEUED',
      'status:QUEUED',
      'status:RUNNING',
      'progress:started',
      'progress:generating',
      'completed:SUCCEEDED',
    ])
  })
})

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}
