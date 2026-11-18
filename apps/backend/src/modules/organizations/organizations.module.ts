import { Module } from '@nestjs/common'

import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { OrganizationInvitationsService } from './organization-invitations.service'
import { OrganizationMembersService } from './organization-members.service'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrganizationMembersService,
    OrganizationInvitationsService,
    RateLimitGuard,
  ],
})
export class OrganizationsModule {}
