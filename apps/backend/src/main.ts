import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module'
import { AppLogger } from './common/logging/app-logger'
import { logEvent } from './common/logging/log-event'
import { securityHeaders } from './common/security-headers.middleware'
import { EnvironmentVariables } from './config/env.validation'
import { setupSwagger } from './swagger'

async function bootstrap() {
  // Buffer until the configured logger is installed, so boot logs use it too.
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService<EnvironmentVariables, true>)
  app.useLogger(
    new AppLogger(
      config.get('LOG_LEVEL', { infer: true }),
      config.get('LOG_FORMAT', { infer: true }),
    ),
  )
  const logger = new Logger('Bootstrap')
  process.on('unhandledRejection', (reason) =>
    logger.error(
      logEvent('process.unhandled_rejection', { error: String(reason) }),
      reason instanceof Error ? reason.stack : undefined,
    ),
  )

  const express = app.getHttpAdapter().getInstance()
  express.disable('x-powered-by')
  if (config.get('TRUST_PROXY', { infer: true })) {
    express.set('trust proxy', 1)
  }
  app.use(
    securityHeaders({
      hsts: config.get('NODE_ENV', { infer: true }) === 'production',
    }),
  )
  app.setGlobalPrefix('api')
  const frontendUrl = config.get('FRONTEND_URL', { infer: true })
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'].filter(Boolean),
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'X-Cache'],
  })
  app.use(cookieParser())
  app.enableShutdownHooks()

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    setupSwagger(app)
  }

  const port = config.get('PORT', { infer: true })
  await app.listen(port)
  logger.log(
    logEvent('app.started', {
      port,
      env: config.get('NODE_ENV', { infer: true }),
      docs: config.get('SWAGGER_ENABLED', { infer: true }) ? '/api' : 'off',
    }),
  )
}
void bootstrap()
