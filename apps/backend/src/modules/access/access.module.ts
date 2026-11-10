import { Global, Module } from '@nestjs/common'

import { AccessService } from './access.service'
import { OrganizationPermissionsGuard } from './organization-permissions.guard'
import { PermissionsGuard } from './permissions.guard'

@Global()
@Module({
  providers: [AccessService, PermissionsGuard, OrganizationPermissionsGuard],
  exports: [AccessService, PermissionsGuard, OrganizationPermissionsGuard],
})
export class AccessModule {}
