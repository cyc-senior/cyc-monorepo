import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'

import { NoCache } from '../../cache/no-cache.decorator'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { Public } from '../auth/decorators/public.decorator'
import {
  FoundSessionDto,
  JoinSessionDto,
  LookupSessionDto,
  TesterTokenDto,
} from './dto/tester.dto'
import { OptionalUserService } from './optional-user.service'
import { SessionLookupService } from './session-lookup.service'
import { TesterAuthService } from './tester-auth.service'

const MINUTE = 60_000

/**
 * What a tester (a session participant) can do before and when joining. Not a
 * user account: these routes accept only the invitation token to join, and
 * the resulting tester token for `/testing/...` calls. A user bearer token is
 * optional here; when present it claims the invitation for that account.
 */
@ApiTags('testing')
@NoCache()
@Controller('testing')
export class TestingController {
  constructor(
    private readonly auth: TesterAuthService,
    private readonly lookup: SessionLookupService,
    private readonly optionalUser: OptionalUserService,
  ) {}

  /**
   * Preview a session from its invitation code, before joining it.
   *
   * @throws {404} No participant uses that code.
   */
  @Public()
  @Get('lookup')
  @RateLimit({ limit: 60, windowMs: MINUTE })
  async lookupSession(
    @Query() dto: LookupSessionDto,
    @Req() request: Request,
  ): Promise<FoundSessionDto> {
    return this.lookup.lookup(
      dto.code,
      await this.optionalUser.fromRequest(request),
    )
  }

  /**
   * Enter a session with an invitation.
   *
   * @remarks Public; rate-limited. Exchanges the invitation token for a
   * short-lived tester access token that expires with the session. Signed-in
   * users claim the invitation, so it appears in their "My sessions" list and
   * cannot be claimed by another account.
   * @throws {401} Unknown invitation.
   * @throws {403} The session is not open, access was revoked, or the
   *   invitation belongs to another account.
   */
  @Public()
  @Post('join')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 20, windowMs: MINUTE })
  async join(
    @Body() dto: JoinSessionDto,
    @Req() request: Request,
  ): Promise<TesterTokenDto> {
    return this.auth.join(
      dto.token,
      await this.optionalUser.fromRequest(request),
    )
  }
}
