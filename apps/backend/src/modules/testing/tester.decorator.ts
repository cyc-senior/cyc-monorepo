import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import { TesterContext, TesterRequest } from './tester.types'

/** Injects the {@link TesterContext} resolved by the tester guard. */
export const Tester = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TesterContext =>
    ctx.switchToHttp().getRequest<TesterRequest>().tester,
)
