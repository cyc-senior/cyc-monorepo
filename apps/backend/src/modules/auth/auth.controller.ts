import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { AuthService } from './auth.service'
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

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirects the browser to Google sign-in.' })
  googleLogin(): void {
    // The guard performs the redirect.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google redirect target; returns a token pair.' })
  @ApiOkResponse({ type: AuthTokensDto })
  googleCallback(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthTokensDto> {
    return this.authService.issueTokens(user)
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotates the refresh token and issues a new pair.' })
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid or expired.' })
  refresh(@Body() { refreshToken }: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(refreshToken)
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revokes the session of the given refresh token.' })
  @ApiNoContentResponse()
  logout(
    @CurrentUser('id') userId: string,
    @Body() { refreshToken }: RefreshTokenDto,
  ): Promise<void> {
    return this.authService.logout(userId, refreshToken)
  }
}
