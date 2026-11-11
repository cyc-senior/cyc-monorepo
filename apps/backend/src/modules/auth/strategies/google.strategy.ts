import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Profile, Strategy } from 'passport-google-oauth20'

import { logEvent } from '../../../common/logging/log-event'
import { EnvironmentVariables } from '../../../config/env.validation'
import { AuthProvider } from '../../../generated/prisma/client'
import { UsersService } from '../../users/users.service'
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      callbackURL: config.get('GOOGLE_CALLBACK_URL', { infer: true }),
      scope: ['openid', 'email', 'profile'],
    })
  }

  /**
   * Maps a Google profile to a local user, creating or linking it on first
   * sign-in. Its return value becomes `request.user` in the callback.
   *
   * @throws UnauthorizedException when Google reports no verified email.
   */
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<AuthenticatedUser> {
    const email = profile.emails?.[0]?.value
    if (!email || !profile._json.email_verified) {
      this.logger.warn(
        logEvent('auth.google_rejected', {
          reason: 'email_not_verified',
          googleAccount: profile.id,
        }),
      )
      throw new UnauthorizedException('Google account email is not verified.')
    }

    const user = await this.usersService.findOrCreateFromProfile({
      provider: AuthProvider.GOOGLE,
      providerAccountId: profile.id,
      email,
      emailVerified: true,
      name: profile.displayName,
      image: profile.photos?.[0]?.value,
    })

    return { id: user.id, email: user.email }
  }
}
