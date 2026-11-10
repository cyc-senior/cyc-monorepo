import { Module } from '@nestjs/common'

import { GenerationModule } from '../generation/generation.module'
import { GenerationJobsController } from './generation-jobs.controller'
import { GenerationJobsService } from './generation-jobs.service'
import { RoundsController } from './rounds.controller'
import { RoundsService } from './rounds.service'
import { UIVariantsController } from './ui-variants.controller'
import { UIVariantsService } from './ui-variants.service'

@Module({
  imports: [GenerationModule],
  controllers: [
    RoundsController,
    GenerationJobsController,
    UIVariantsController,
  ],
  providers: [RoundsService, GenerationJobsService, UIVariantsService],
})
export class RoundsModule {}
