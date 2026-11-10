import { Module } from '@nestjs/common'
import { Subject } from 'rxjs'
import { filter } from 'rxjs/operators'

import {
  GenerationEvents,
  GenerationSignal,
} from './../src/modules/generation/generation-events.service'
import { GenerationQueue } from './../src/modules/generation/generation-queue.service'
import { LlmClient } from './../src/modules/generation/llm.client'

/** In-memory stand-ins for the BullMQ-backed generation module (no Redis). */
export const fakeGeneration = {
  signals: new Subject<GenerationSignal>(),
  queue: { enqueue: jest.fn(), withdraw: jest.fn() },
  llm: { configured: true, model: 'test-model', provider: 'llm.test' },
}

@Module({
  providers: [
    { provide: GenerationQueue, useValue: fakeGeneration.queue },
    {
      provide: GenerationEvents,
      useValue: {
        forJob: (jobId: string) =>
          fakeGeneration.signals.pipe(filter((s) => s.jobId === jobId)),
      },
    },
    { provide: LlmClient, useValue: fakeGeneration.llm },
  ],
  exports: [GenerationQueue, GenerationEvents, LlmClient],
})
export class FakeGenerationModule {}
