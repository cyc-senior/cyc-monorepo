import { Module } from '@nestjs/common'

import { OrganizationMembersService } from './organization-members.service'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMembersService],
})
export class OrganizationsModule {}
