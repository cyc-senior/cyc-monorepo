import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import {
  AccessContext,
  AccessRequest,
  WorkspaceAccessContext,
} from './access.types'

/** Injects the {@link AccessContext} resolved by the permission guard. */
export const Access = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessContext =>
    ctx.switchToHttp().getRequest<AccessRequest>().access,
)

/** Injects the {@link WorkspaceAccessContext} resolved by the workspace guard. */
export const WorkspaceAccess = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceAccessContext =>
    ctx.switchToHttp().getRequest<AccessRequest>().workspaceAccess,
)
