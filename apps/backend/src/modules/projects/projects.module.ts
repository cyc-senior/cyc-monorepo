import { Module } from '@nestjs/common'

import { MembersController } from './members.controller'
import { MembersService } from './members.service'
import { WorkspaceProjectsController } from './workspace-projects.controller'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  controllers: [
    ProjectsController,
    WorkspaceProjectsController,
    MembersController,
  ],
  providers: [ProjectsService, MembersService],
})
export class ProjectsModule {}
