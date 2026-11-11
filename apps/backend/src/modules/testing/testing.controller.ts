import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JoinSessionDto, TesterTokenDto } from './dto/tester.dto'
import { TesterAuthService } from './tester-auth.service'

const MINUTE = 60_000

/**
 * What a tester (a session participant) can do. Not a user account: these
 * routes accept only the tester token obtained from `POST /testing/join`
 * (audience `cyc-testing`), never a user token, and every call re-checks that
 * the participant is still allowed into an open session. A participant can
 * only ever touch their own session.
 */
@ApiTags('testing')
@Controller('testing')
export class TestingController {
  constructor(private readonly auth: TesterAuthService) {}

  /**
   * Enter a session with an invitation.
   *
   * @remarks Public; rate-limited. Exchanges the invitation token for a
   * short-lived tester access token that expires with the session.
   * @throws {401} Unknown invitation.
   * @throws {403} The session is not open, or access was revoked.
   */
  @Public()
  @Post('join')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 20, windowMs: MINUTE })
  join(@Body() dto: JoinSessionDto): Promise<TesterTokenDto> {
    return this.auth.join(dto.token)
  }
}
