import { Global, Module } from '@nestjs/common'

import { AccessService } from './access.service'
import { WorkspacePermissionsGuard } from './workspace-permissions.guard'
import { PermissionsGuard } from './permissions.guard'

@Global()
@Module({
  providers: [AccessService, PermissionsGuard, WorkspacePermissionsGuard],
  exports: [AccessService, PermissionsGuard, WorkspacePermissionsGuard],
})
export class AccessModule {}
