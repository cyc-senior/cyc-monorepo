import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger'

import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { PERMISSION_KEY } from './access.constants'
import { Permission, rolesWith } from './permissions'
import { PermissionsGuard } from './permissions.guard'

/**
 * Requires the caller's role in the route's project to hold `permission`. The
 * route must declare `:projectId`. Also adds the bearer-auth and error
 * responses to the API docs, including which roles pass.
 */
export const Authorize = (permission: Permission) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permission),
    UseGuards(PermissionsGuard),
    ApiAuthenticated(),
    ApiForbiddenResponse({
      description: `Requires permission \`${permission}\` (roles: ${rolesWith(permission).join(', ')}).`,
    }),
    ApiNotFoundResponse({
      description:
        'Resource not found, or the caller is not a member of the project.',
    }),
  )
