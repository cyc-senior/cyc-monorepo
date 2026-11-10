import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request, Response } from 'express'

import { logEvent } from '../logging/log-event'
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator'

/** Past this many tracked keys, expired windows are swept. */
const SWEEP_THRESHOLD = 10_000

/**
 * Sliding-window limiter for `@RateLimit()` routes. State is in this process
 * only: with several API instances the effective limit is multiplied by the
 * instance count, which is enough to blunt guessing and floods on the public
 * tester endpoints (tokens carry 256 bits of entropy anyway). Counters are
 * deliberately not persisted: a restart resets them.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name)
  private readonly hits = new Map<string, number[]>()

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    )
    if (!options) {
      return true
    }

    const http = context.switchToHttp()
    const request = http.getRequest<
      Request & { tester?: { participantId: string } }
    >()
    const subject =
      options.by === 'participant' && request.tester
        ? `p:${request.tester.participantId}`
        : `ip:${request.ip}`
    const key = `${request.method} ${request.route?.path ?? request.path}|${subject}`
    const now = Date.now()
    const recent = (this.hits.get(key) ?? []).filter(
      (at) => now - at < options.windowMs,
    )

    if (recent.length >= options.limit) {
      const retryAfter = Math.ceil((recent[0] + options.windowMs - now) / 1000)
      http.getResponse<Response>().setHeader('Retry-After', String(retryAfter))
      this.logger.warn(
        logEvent('rate_limit.exceeded', { route: key, retryAfter }),
      )
      throw new HttpException(
        'Too many requests; slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    recent.push(now)
    this.hits.set(key, recent)
    if (this.hits.size > SWEEP_THRESHOLD) {
      this.sweep(now, options.windowMs)
    }

    return true
  }

  private sweep(now: number, windowMs: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((at) => now - at >= windowMs)) {
        this.hits.delete(key)
      }
    }
  }
}
