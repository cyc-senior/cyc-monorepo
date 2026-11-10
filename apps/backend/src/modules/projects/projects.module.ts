import { Module } from '@nestjs/common'

import { MembersController } from './members.controller'
import { MembersService } from './members.service'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  controllers: [ProjectsController, MembersController],
  providers: [ProjectsService, MembersService],
})
export class ProjectsModule {}
