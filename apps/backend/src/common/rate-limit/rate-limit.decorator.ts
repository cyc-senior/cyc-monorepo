import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiTooManyRequestsResponse } from '@nestjs/swagger'

import { RateLimitGuard } from './rate-limit.guard'

export const RATE_LIMIT_KEY = 'rateLimit'

export interface RateLimitOptions {
  /** Requests allowed per window and subject. */
  limit: number
  windowMs: number
  /** `ip` (default) or, behind the tester guard, `participant`. */
  by?: 'ip' | 'participant'
}

/** Limits how often one client may call a route (429 + `Retry-After` beyond it). */
export const RateLimit = (options: RateLimitOptions) =>
  applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, options),
    UseGuards(RateLimitGuard),
    ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' }),
  )
