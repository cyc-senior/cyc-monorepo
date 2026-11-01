import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

import { AuthenticatedUser } from '../interfaces/authenticated-user.interface'

/** Injects the user resolved from the bearer token (or one of its fields). */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const { user } = ctx.switchToHttp().getRequest<Request>()
    const authenticated = user as AuthenticatedUser

    return field ? authenticated?.[field] : authenticated
  },
)
