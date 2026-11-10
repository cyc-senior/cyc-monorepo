import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { GenerationModule } from '../generation/generation.module'
import { AI_TASK_QUEUE } from './ai.constants'
import { AiTaskEvents } from './ai-task.events'
import { AiTaskProcessor } from './ai-task.processor'
import { AiTaskQueue } from './ai-task.queue'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { FeedbackAnalyzer } from './feedback-analyzer'
import { StoryDrafter } from './story-drafter'
import { StoryGenerationService } from './story-generation.service'
import { StoryGenerationsController } from './story-generations.controller'
import { ThemesController } from './themes.controller'
import { ThemesService } from './themes.service'

/**
 * The text-model side of the platform, on its own BullMQ queue (`ai-tasks`):
 * feedback analysis and user-story drafting. Producers, the worker and the
 * queue events used for SSE live here; the LLM client is shared with design
 * generation. The worker runs in this process unless `GENERATION_WORKER=false`
 * (the same switch as the design worker, so one process serves both).
 */
@Module({
  imports: [
    GenerationModule,
    BullModule.registerQueue({ name: AI_TASK_QUEUE }),
  ],
  controllers: [
    AnalysisController,
    ThemesController,
    StoryGenerationsController,
  ],
  providers: [
    AiTaskQueue,
    AiTaskEvents,
    AiTaskProcessor,
    FeedbackAnalyzer,
    StoryDrafter,
    AnalysisService,
    ThemesService,
    StoryGenerationService,
  ],
})
export class AiModule {}
