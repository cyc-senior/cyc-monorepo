import { Module } from '@nestjs/common'

import { UiKitsController } from './ui-kits.controller'
import { UserStoriesController } from './user-stories.controller'
import { UserStoriesService } from './user-stories.service'

@Module({
  controllers: [UserStoriesController, UiKitsController],
  providers: [UserStoriesService],
})
export class DesignModule {}
