import { Global, Module } from '@nestjs/common'

import { AccessService } from './access.service'
import { PermissionsGuard } from './permissions.guard'

@Global()
@Module({
  providers: [AccessService, PermissionsGuard],
  exports: [AccessService, PermissionsGuard],
})
export class AccessModule {}
