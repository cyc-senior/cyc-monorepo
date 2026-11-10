import KeyvRedis from '@keyv/redis'
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager'
import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { Cache } from 'cache-manager'

import { logEvent } from '../common/logging/log-event'
import { EnvironmentVariables } from '../config/env.validation'
import { HttpCacheInterceptor } from './http-cache.interceptor'
import { HttpCacheService } from './http-cache.service'

const logger = new Logger('Cache')
const NAMESPACE = 'senior'

/**
 * The Redis adapter behind the cache, or `undefined` for the in-process
 * default. Commands fail fast while disconnected (no offline queue) and the
 * client keeps reconnecting in the background, so an outage degrades to
 * uncached responses instead of hanging requests. Connection changes are
 * logged once per transition, not on every reconnect attempt.
 *
 * The bare adapter is returned (not a Keyv) so `CacheModule` wraps it in
 * exactly one Keyv.
 */
function createRedisStore(
  url: string | undefined,
): KeyvRedis<unknown> | undefined {
  if (!url) {
    logger.warn(
      logEvent('cache.store', { type: 'memory', reason: 'no REDIS_URL' }),
    )

    return undefined
  }

  const store = new KeyvRedis(
    {
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2_000,
        reconnectStrategy: (retries: number) => Math.min(retries * 200, 5_000),
      },
    },
    { namespace: NAMESPACE, throwOnConnectError: false },
  )
  const host = new URL(url).host
  let up: boolean | undefined
  const transition = (next: boolean, log: () => void) => {
    if (up !== next) {
      up = next
      log()
    }
  }
  store.on('error', (error: Error & { code?: string }) =>
    transition(false, () =>
      logger.error(
        logEvent('cache.redis.unavailable', {
          host,
          error: error.message || error.code || error.name,
          fallback: 'uncached',
        }),
      ),
    ),
  )
  store.on('connect', () =>
    transition(true, () =>
      logger.log(logEvent('cache.redis.connected', { host })),
    ),
  )
  store.on('reconnecting', () =>
    logger.debug(logEvent('cache.redis.reconnecting', { host })),
  )

  return store
}

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const store = createRedisStore(config.get('REDIS_URL', { infer: true }))

        return {
          stores: store ? [store] : undefined,
          namespace: NAMESPACE,
          ttl: config.get('CACHE_TTL_SECONDS', { infer: true }) * 1000,
        }
      },
    }),
  ],
  providers: [
    HttpCacheService,
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
  ],
  exports: [HttpCacheService],
})
export class HttpCacheModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly httpCache: HttpCacheService,
  ) {}

  onModuleInit(): void {
    for (const keyv of this.cache.stores) {
      // Keyv re-emits store errors and throws an `error` nobody listens to,
      // which would crash the process on a Redis restart. The adapter already
      // logged it; here it only has to be handled.
      keyv.on('error', () => undefined)
      const adapter: unknown = keyv.store
      if (adapter instanceof KeyvRedis) {
        // Read the client each time: the adapter replaces it after a failed connect.
        this.httpCache.watchStore(
          () => (adapter.client as { isReady?: boolean }).isReady !== false,
        )
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.cache.disconnect()
    logger.log(logEvent('cache.disconnected'))
  }
}
