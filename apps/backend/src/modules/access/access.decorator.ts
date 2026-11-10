import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import { AccessContext, AccessRequest } from './access.types'

/** Injects the {@link AccessContext} resolved by the permission guard. */
export const Access = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessContext =>
    ctx.switchToHttp().getRequest<AccessRequest>().access,
)
