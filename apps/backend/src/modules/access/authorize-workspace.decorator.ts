import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger'

import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { WORKSPACE_PERMISSION_KEY } from './access.constants'
import {
  WorkspacePermission,
  workspaceRolesWith,
} from './workspace-permissions'
import { WorkspacePermissionsGuard } from './workspace-permissions.guard'

/**
 * Requires the caller's role in the route's workspace to hold
 * `permission`. The route must declare `:workspaceId`.
 */
export const AuthorizeWorkspace = (permission: WorkspacePermission) =>
  applyDecorators(
    SetMetadata(WORKSPACE_PERMISSION_KEY, permission),
    UseGuards(WorkspacePermissionsGuard),
    ApiAuthenticated(),
    ApiForbiddenResponse({
      description: `Requires workspace permission \`${permission}\` (roles: ${workspaceRolesWith(permission).join(', ')}).`,
    }),
    ApiNotFoundResponse({
      description:
        'Resource not found, or the caller is not a member of the workspace.',
    }),
  )
