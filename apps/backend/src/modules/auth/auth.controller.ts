import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

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
  constructor(private readonly authService: AuthService) {}

  /** Redirects the browser to Google sign-in. */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // The guard performs the redirect.
  }

  /** Google redirect target; returns a token pair. */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthTokensDto> {
    return this.authService.issueTokens(user)
  }

  /**
   * Rotates the refresh token and issues a new pair.
   *
   * @throws {401} Refresh token invalid or expired.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() { refreshToken }: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(refreshToken)
  }

  /** Revokes the session of the given refresh token. */
  @ApiAuthenticated()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(
    @CurrentUser('id') userId: string,
    @Body() { refreshToken }: RefreshTokenDto,
  ): Promise<void> {
    return this.authService.logout(userId, refreshToken)
  }
}
