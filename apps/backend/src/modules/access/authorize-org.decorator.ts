import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger'

import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { ORG_PERMISSION_KEY } from './access.constants'
import { OrgPermission, orgRolesWith } from './org-permissions'
import { OrganizationPermissionsGuard } from './organization-permissions.guard'

/**
 * Requires the caller's role in the route's organization to hold
 * `permission`. The route must declare `:organizationId`.
 */
export const AuthorizeOrg = (permission: OrgPermission) =>
  applyDecorators(
    SetMetadata(ORG_PERMISSION_KEY, permission),
    UseGuards(OrganizationPermissionsGuard),
    ApiAuthenticated(),
    ApiForbiddenResponse({
      description: `Requires organization permission \`${permission}\` (roles: ${orgRolesWith(permission).join(', ')}).`,
    }),
    ApiNotFoundResponse({
      description:
        'Resource not found, or the caller is not a member of the organization.',
    }),
  )
