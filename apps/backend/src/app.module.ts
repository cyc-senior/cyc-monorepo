import {
  BeforeApplicationShutdown,
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'

import { HttpCacheModule } from './cache/http-cache.module'
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter'
import { logEvent } from './common/logging/log-event'
import { RequestLoggerMiddleware } from './common/logging/request-logger.middleware'
import { validateEnv } from './config/env.validation'
import { AccessModule } from './modules/access/access.module'
import { AiModule } from './modules/ai/ai.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { DesignModule } from './modules/design/design.module'
import { HealthModule } from './modules/health/health.module'
import { IterationModule } from './modules/iteration/iteration.module'
import { TestingModule } from './modules/testing/testing.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { RoundsModule } from './modules/rounds/rounds.module'
import { StakeholdersModule } from './modules/stakeholders/stakeholders.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests configure themselves; a developer's .env (Redis, LLM key) must not leak in.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    HttpCacheModule,
    AccessModule,
    AuditModule,
    AuthModule,
    UsersModule,
    HealthModule,
    OrganizationsModule,
    ProjectsModule,
    DesignModule,
    RoundsModule,
    IterationModule,
    TestingModule,
    AiModule,
    StakeholdersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule, BeforeApplicationShutdown {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path')
  }

  beforeApplicationShutdown(signal?: string): void {
    new Logger('Bootstrap').log(logEvent('app.stopping', { signal }))
  }
}
