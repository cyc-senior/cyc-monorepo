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
import { PERMISSION_KEY } from './access.constants'
import { AccessService } from './access.service'
import { AccessContext, AccessRequest } from './access.types'
import { can, Permission } from './permissions'

/**
 * Enforces `@Authorize(permission)` on routes with a `:projectId` param: the
 * caller's role in that project must hold the permission.
 *
 * Non-members get a 404 (never confirm that a project exists); members whose
 * role lacks the permission get a 403. On success the resolved
 * {@link AccessContext} is attached as `request.access`.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!permission) {
      return true
    }

    const request = context.switchToHttp().getRequest<AccessRequest>()
    if (!request.user) {
      throw new UnauthorizedException()
    }

    const access = await this.resolve(request, permission)
    if (!can(access.role, permission)) {
      this.logger.warn(
        logEvent('access.denied', {
          reason: 'missing_permission',
          permission,
          role: access.role,
          user: request.user.id,
          project: access.projectId,
        }),
      )
      throw new ForbiddenException(
        'Your role in this project does not allow this action.',
      )
    }
    request.access = access

    return true
  }

  /** @throws NotFoundException when the project is missing or not accessible. */
  private async resolve(
    request: AccessRequest,
    permission: Permission,
  ): Promise<AccessContext> {
    const { projectId } = request.params as Record<string, string | undefined>
    if (projectId === undefined) {
      // A guarded route without a project is a programming error: fail closed.
      this.logger.error(
        `@Authorize used on ${request.method} ${request.route?.path} without :projectId`,
      )
      throw new InternalServerErrorException()
    }

    const access = isUUID(projectId)
      ? await this.access.forProject(request.user.id, projectId)
      : null
    if (!access) {
      // Probing ids of other projects shows up here, not just as a 404.
      this.logger.warn(
        logEvent('access.denied', {
          reason: 'not_a_member',
          permission,
          user: request.user.id,
          project: projectId,
        }),
      )
      throw new NotFoundException('Project not found.')
    }

    return access
  }
}
