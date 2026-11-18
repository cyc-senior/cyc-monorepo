import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { isUUID } from 'class-validator'
import { Request } from 'express'

import { API_AUDIENCE, JWT_ISSUER } from '../auth/auth.constants'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface'

/**
 * Reads a user identity from a public testing route. Joining and looking up
 * an invitation work without an account, but when a valid access token is
 * present the invitation can be tied to that account. Invalid or tester
 * tokens are treated as "not signed in" rather than breaking the public flow.
 */
@Injectable()
export class OptionalUserService {
  constructor(private readonly jwt: JwtService) {}

  async fromRequest(request: Request): Promise<AuthenticatedUser | null> {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) {
      return null
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: API_AUDIENCE,
      })
      if (!isUUID(payload.sub)) {
        return null
      }

      return { id: payload.sub, email: payload.email }
    } catch {
      return null
    }
  }
}
