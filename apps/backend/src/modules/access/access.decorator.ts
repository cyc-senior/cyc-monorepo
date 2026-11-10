import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import { AccessContext, AccessRequest, OrgAccessContext } from './access.types'

/** Injects the {@link AccessContext} resolved by the permission guard. */
export const Access = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessContext =>
    ctx.switchToHttp().getRequest<AccessRequest>().access,
)

/** Injects the {@link OrgAccessContext} resolved by the organization guard. */
export const OrgAccess = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgAccessContext =>
    ctx.switchToHttp().getRequest<AccessRequest>().orgAccess,
)
