import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { isUUID } from 'class-validator'

import { logEvent } from '../../common/logging/log-event'
import { ORG_PERMISSION_KEY } from './access.constants'
import { AccessService } from './access.service'
import { AccessRequest } from './access.types'
import { canInOrg, OrgPermission } from './org-permissions'

/**
 * Enforces `@AuthorizeOrg(permission)` on routes with an `:organizationId`
 * param. Non-members get a 404 (never confirm that an organization exists);
 * members without the permission get a 403.
 */
@Injectable()
export class OrganizationPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(OrganizationPermissionsGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<
      OrgPermission | undefined
    >(ORG_PERMISSION_KEY, [context.getHandler(), context.getClass()])
    if (!permission) {
      return true
    }

    const request = context.switchToHttp().getRequest<AccessRequest>()
    if (!request.user) {
      throw new UnauthorizedException()
    }
    const { organizationId } = request.params as Record<
      string,
      string | undefined
    >
    if (organizationId === undefined) {
      // A guarded route without an organization is a programming error: fail closed.
      this.logger.error(
        `@AuthorizeOrg used on ${request.method} ${request.route?.path} without :organizationId`,
      )
      throw new InternalServerErrorException()
    }

    const access = isUUID(organizationId)
      ? await this.access.forOrganization(request.user.id, organizationId)
      : null
    if (!access) {
      this.logger.warn(
        logEvent('access.denied', {
          reason: 'not_an_org_member',
          permission,
          user: request.user.id,
          organization: organizationId,
        }),
      )
      throw new NotFoundException('Organization not found.')
    }
    if (!canInOrg(access.role, permission)) {
      this.logger.warn(
        logEvent('access.denied', {
          reason: 'missing_org_permission',
          permission,
          role: access.role,
          user: request.user.id,
          organization: organizationId,
        }),
      )
      throw new ForbiddenException(
        'Your role in this organization does not allow this action.',
      )
    }
    request.orgAccess = access

    return true
  }
}
