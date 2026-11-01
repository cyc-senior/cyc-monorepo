import { randomBytes, timingSafeEqual } from 'node:crypto'

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '@nestjs/passport'
import { Request, Response } from 'express'

import { EnvironmentVariables } from '../../../config/env.validation'

export const OAUTH_STATE_COOKIE = 'oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000

/**
 * Drives both legs of the Google flow with a stateless CSRF check: the login
 * leg stores a random `state` in an httpOnly cookie and sends it to Google; the
 * callback leg requires Google to echo the same value back.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly cookiePath: string
  private readonly secure: boolean
  private readonly pendingStates = new WeakMap<Request, string>()

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super()
    this.cookiePath = new URL(
      config.get('GOOGLE_CALLBACK_URL', { infer: true }),
    ).pathname
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production'
  }

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()

    if (this.isCallback(req)) {
      this.assertState(req, res)
    } else {
      const state = randomBytes(32).toString('base64url')
      res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.secure,
        path: this.cookiePath,
        maxAge: STATE_TTL_MS,
      })
      this.pendingStates.set(req, state)
    }

    return super.canActivate(context)
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>()

    return { state: this.pendingStates.get(req) }
  }

  private isCallback(req: Request): boolean {
    return 'code' in req.query || 'error' in req.query
  }

  private assertState(req: Request, res: Response): void {
    const expected = req.cookies?.[OAUTH_STATE_COOKIE]
    const received = req.query.state
    res.clearCookie(OAUTH_STATE_COOKIE, { path: this.cookiePath })

    if (
      typeof expected !== 'string' ||
      typeof received !== 'string' ||
      expected.length !== received.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
    ) {
      throw new UnauthorizedException('Invalid OAuth state.')
    }
  }
}
