import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EnvironmentVariables } from '../../config/env.validation'
import { DesignGenerationProcessor } from './design-generation.processor'
import { DesignGenerator } from './design-generator.service'
import { DESIGN_GENERATION_QUEUE } from './generation.constants'
import { GenerationEvents } from './generation-events.service'
import { GenerationQueue } from './generation-queue.service'
import { LlmClient } from './llm.client'
import { PersonaSynthesizer } from './persona-synthesizer'

/**
 * LLM design generation (persona artifact + high-fidelity HTML) on BullMQ: the producer ({@link GenerationQueue}),
 * the worker ({@link DesignGenerationProcessor}, on when `GENERATION_WORKER`)
 * and queue events for SSE ({@link GenerationEvents}).
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        prefix: config.get('QUEUE_PREFIX', { infer: true }),
        connection: {
          url:
            config.get('REDIS_URL', { infer: true }) ??
            'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({ name: DESIGN_GENERATION_QUEUE }),
  ],
  providers: [
    LlmClient,
    DesignGenerator,
    PersonaSynthesizer,
    DesignGenerationProcessor,
    GenerationQueue,
    GenerationEvents,
  ],
  exports: [GenerationQueue, GenerationEvents, LlmClient],
})
export class GenerationModule {}
