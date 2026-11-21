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
import { WORKSPACE_PERMISSION_KEY } from './access.constants'
import { AccessService } from './access.service'
import { AccessRequest } from './access.types'
import { canInWorkspace, WorkspacePermission } from './workspace-permissions'

/**
 * Enforces `@AuthorizeWorkspace(permission)` on routes with an `:workspaceId`
 * param. Non-members get a 404 (never confirm that a workspace exists);
 * members without the permission get a 403.
 */
@Injectable()
export class WorkspacePermissionsGuard implements CanActivate {
  private readonly logger = new Logger(WorkspacePermissionsGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<
      WorkspacePermission | undefined
    >(WORKSPACE_PERMISSION_KEY, [context.getHandler(), context.getClass()])
    if (!permission) {
      return true
    }

    const request = context.switchToHttp().getRequest<AccessRequest>()
    if (!request.user) {
      throw new UnauthorizedException()
    }
    const { workspaceId } = request.params as Record<string, string | undefined>
    if (workspaceId === undefined) {
      // A guarded route without a workspace is a programming error: fail closed.
      this.logger.error(
        `@AuthorizeWorkspace used on ${request.method} ${request.route?.path} without :workspaceId`,
      )
      throw new InternalServerErrorException()
    }

    const access = isUUID(workspaceId)
      ? await this.access.forWorkspace(request.user.id, workspaceId)
      : null
    if (!access) {
      this.logger.warn(
        logEvent('access.denied', {
          reason: 'not_an_workspace_member',
          permission,
          user: request.user.id,
          workspace: workspaceId,
        }),
      )
      throw new NotFoundException('Workspace not found.')
    }
    if (!canInWorkspace(access.role, permission)) {
      this.logger.warn(
        logEvent('access.denied', {
          reason: 'missing_workspace_permission',
          permission,
          role: access.role,
          user: request.user.id,
          workspace: workspaceId,
        }),
      )
      throw new ForbiddenException(
        'Your role in this workspace does not allow this action.',
      )
    }
    request.workspaceAccess = access

    return true
  }
}
