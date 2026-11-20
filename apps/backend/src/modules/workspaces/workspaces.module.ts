import { Module } from '@nestjs/common'

import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { WorkspaceInvitationsService } from './workspace-invitations.service'
import { WorkspaceMembersService } from './workspace-members.service'
import { WorkspacesController } from './workspaces.controller'
import { WorkspacesService } from './workspaces.service'

@Module({
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspaceMembersService,
    WorkspaceInvitationsService,
    RateLimitGuard,
  ],
})
export class WorkspacesModule {}
