import { Module } from '@nestjs/common'

import { MembersController } from './members.controller'
import { MembersService } from './members.service'
import { OrganizationProjectsController } from './organization-projects.controller'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  controllers: [
    ProjectsController,
    OrganizationProjectsController,
    MembersController,
  ],
  providers: [ProjectsService, MembersService],
})
export class ProjectsModule {}
