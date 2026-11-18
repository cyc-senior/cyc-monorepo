import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { NoCache } from '../../cache/no-cache.decorator'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UserSessionDto } from './dto/user-session.dto'
import { MySessionsService } from './my-sessions.service'

/** The signed-in user's testing sessions ("My sessions" on the dashboard). */
@ApiTags('testing')
@ApiAuthenticated()
@NoCache()
@Controller('users/me/sessions')
export class UserSessionsController {
  constructor(private readonly sessions: MySessionsService) {}

  @Get()
  list(@CurrentUser('id') userId: string): Promise<UserSessionDto[]> {
    return this.sessions.list(userId)
  }
}
