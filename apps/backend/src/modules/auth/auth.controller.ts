import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import { CookieOptions, Request, Response } from 'express'

import { EnvironmentVariables } from '../../config/env.validation'
import { AuthService } from './auth.service'
import { ApiAuthenticated } from './decorators/api-authenticated.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import { AuthTokensDto } from './dto/auth-tokens.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { GoogleAuthGuard } from './guards/google-auth.guard'
import { AuthenticatedUser } from './interfaces/authenticated-user.interface'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Builds cookie options for the refresh token. */
  private getCookieOptions(): CookieOptions {
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production'
    const domain =
      this.config.get('COOKIE_DOMAIN', { infer: true }) || undefined
    const days =
      this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) || 30

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: days * 24 * 60 * 60 * 1000,
    }
  }

  /** Redirects the browser to Google sign-in. */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // The guard performs the redirect.
  }

  /** Google redirect target; sets the refresh token cookie and redirects to frontend. */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.authService.issueTokens(user)
    res.cookie('refreshToken', tokens.refreshToken, this.getCookieOptions())

    const frontendUrl =
      this.config.get('FRONTEND_URL', { infer: true }) ||
      'http://localhost:3000'
    return res.redirect(`${frontendUrl}/dashboard`)
  }

  /**
   * Rotates the refresh token and issues a new pair.
   * Accepts the refresh token from either body or httpOnly cookie.
   *
   * @throws {401} Refresh token invalid or expired.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto?: RefreshTokenDto,
  ): Promise<AuthTokensDto> {
    const hasBodyToken = Boolean(dto?.refreshToken)
    const hasCookieToken = Boolean(req.cookies?.['refreshToken'])
    const rawToken = dto?.refreshToken || req.cookies?.['refreshToken']
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token provided.')
    }

    const tokens = await this.authService.refresh(rawToken)

    // For cookie flow: update httpOnly cookie and omit refreshToken from the JSON response
    if (hasCookieToken && !hasBodyToken) {
      res.cookie('refreshToken', tokens.refreshToken, this.getCookieOptions())
      return {
        accessToken: tokens.accessToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn,
      } as AuthTokensDto
    }

    // For body-token flow: return tokens without setting a browser cookie
    return tokens
  }

  /** Revokes the session of the given refresh token and clears the cookie. */
  @ApiAuthenticated()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto?: RefreshTokenDto,
  ): Promise<void> {
    const rawToken = dto?.refreshToken || req.cookies?.['refreshToken']
    if (rawToken) {
      await this.authService.logout(userId, rawToken)
    }

    const domain =
      this.config.get('COOKIE_DOMAIN', { infer: true }) || undefined
    res.clearCookie('refreshToken', { domain, path: '/' })
  }
}
