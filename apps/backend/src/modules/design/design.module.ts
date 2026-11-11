import { Module } from '@nestjs/common'

import { DesignIntentController } from './design-intent.controller'
import { DesignIntentService } from './design-intent.service'
import { PersonasController } from './personas.controller'
import { PersonasService } from './personas.service'
import { UserStoriesController } from './user-stories.controller'
import { UserStoriesService } from './user-stories.service'

/** Design inputs: the design intent, user personas and user stories. */
@Module({
  controllers: [
    DesignIntentController,
    PersonasController,
    UserStoriesController,
  ],
  providers: [DesignIntentService, PersonasService, UserStoriesService],
})
export class DesignModule {}
