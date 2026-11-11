import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { EnvironmentVariables } from '../../config/env.validation'
import { ParticipantsService } from './participants.service'
import { SessionResultsController } from './session-results.controller'
import { SessionResultsService } from './session-results.service'
import { SessionSetupController } from './session-setup.controller'
import { TestSessionsController } from './test-sessions.controller'
import { TestSessionsService } from './test-sessions.service'
import { TestTasksService } from './test-tasks.service'
import { TesterController } from './tester.controller'
import { TestingController } from './testing.controller'
import { TesterGuard } from './tester.guard'
import { TesterAuthService } from './tester-auth.service'
import { TesterService } from './tester.service'

/**
 * The testing space. Designers run sessions under `/projects/:projectId/
 * test-sessions` (project permissions); testers use `/testing` with a
 * participant token that is separate from user authentication.
 */
@Module({
  imports: [
    // Signs and verifies tester tokens (own audience, same secret as user JWTs).
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [
    TestSessionsController,
    SessionSetupController,
    SessionResultsController,
    TestingController,
    TesterController,
  ],
  providers: [
    TestSessionsService,
    TestTasksService,
    ParticipantsService,
    SessionResultsService,
    TesterAuthService,
    TesterService,
    TesterGuard,
    RateLimitGuard,
  ],
})
export class TestingModule {}
