import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { logEvent } from '../common/logging/log-event'
import { EnvironmentVariables } from '../config/env.validation'
import { Prisma, PrismaClient } from '../generated/prisma/client'

type LoggedEvents = 'query' | 'warn' | 'error'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('Prisma')

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    })

    const slowMs = config.get('SLOW_QUERY_MS', { infer: true })
    const events = this as unknown as PrismaClient<LoggedEvents>
    events.$on('query', (event: Prisma.QueryEvent) => {
      // Parameters are left out on purpose: they can hold personal data.
      if (event.duration >= slowMs) {
        this.logger.warn(
          logEvent('db.query.slow', { ms: event.duration, query: event.query }),
        )
      }
    })
    events.$on('warn', (event: Prisma.LogEvent) =>
      this.logger.warn(logEvent('db.warn', { message: event.message })),
    )
    events.$on('error', (event: Prisma.LogEvent) =>
      this.logger.error(logEvent('db.error', { message: event.message })),
    )
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log(logEvent('db.connected'))
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
    this.logger.log(logEvent('db.disconnected'))
  }
}
