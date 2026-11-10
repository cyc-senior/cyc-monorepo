import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { EnvironmentVariables } from '../../../config/env.validation'
import { API_AUDIENCE, JWT_ISSUER } from '../auth.constants'
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface'
import { JwtPayload } from '../interfaces/jwt-payload.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
      // A tester token (another audience) must never pass as a user token.
      issuer: JWT_ISSUER,
      audience: API_AUDIENCE,
      ignoreExpiration: false,
    })
  }

  /** The returned value becomes `request.user`. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email }
  }
}
