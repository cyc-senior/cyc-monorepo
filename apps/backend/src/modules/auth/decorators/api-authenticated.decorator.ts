import { applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'

/**
 * Documents that a route (or every route of a controller) needs the bearer
 * access token. Authentication itself is enforced by the global JWT guard; use
 * `@Authorize()` instead on project-scoped routes.
 */
export const ApiAuthenticated = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing or invalid bearer token.',
    }),
  )
