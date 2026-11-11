import { randomUUID } from 'node:crypto'

import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cache } from 'cache-manager'

import { logEvent } from '../common/logging/log-event'
import { EnvironmentVariables } from '../config/env.validation'

/** A slow or unreachable Redis must cost at most this much per request. */
const OPERATION_TIMEOUT_MS = 250
/** Versions outlive the responses keyed on them; losing one only invalidates. */
const VERSION_TTL_MS = 24 * 60 * 60 * 1000
/** Failed operations are warned about at most this often (connection state is logged by the store). */
const WARN_INTERVAL_MS = 60_000
/** While the store is down, one operation this often probes it (and reconnects it). */
const PROBE_INTERVAL_MS = 5_000

/**
 * Response cache with project-versioned keys. Every cached response key embeds
 * the current data version of its project; a write bumps the version, which
 * makes all older entries unreachable at once without scanning Redis. Stale
 * entries then simply expire.
 *
 * Fails open: if the store is slow or down the request is served uncached.
 */
@Injectable()
export class HttpCacheService {
  private readonly logger = new Logger('Cache')
  private readonly ttlMs: number
  private lastWarnAt = 0
  private isStoreReady: () => boolean = () => true
  private nextProbeAt = 0

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlMs = config.get('CACHE_TTL_SECONDS', { infer: true }) * 1000
  }

  get enabled(): boolean {
    return this.ttlMs > 0
  }

  /**
   * Lets the service skip a store that is known to be down instead of paying
   * the operation timeout on every request (a circuit breaker).
   */
  watchStore(isReady: () => boolean): void {
    this.isStoreReady = isReady
  }

  /**
   * The key for `url` as seen by `principal` under the project's current data
   * version, or `undefined` if the store cannot be reached.
   */
  async responseKey(
    projectId: string,
    principal: string,
    url: string,
  ): Promise<string | undefined> {
    const versionKey = projectVersionKey(projectId)
    // mget, unlike get, tells a missing version apart from a failed read.
    const versions = await this.attempt('read version', () =>
      this.cache.mget<string>([versionKey]),
    )
    if (!versions) {
      return undefined
    }
    const version = versions[0] ?? (await this.bump(versionKey))
    if (version === undefined) {
      return undefined
    }

    return `http:${projectId}@${version}:${principal}:${url}`
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.attempt('read', () => this.cache.get<T>(key))

    return value ?? undefined
  }

  async set(key: string, value: unknown, ttlMs = this.ttlMs): Promise<void> {
    await this.attempt('write', () => this.cache.set(key, value, ttlMs))
  }

  /** Drops every cached response of the project. */
  async invalidate(projectId: string): Promise<void> {
    if (!this.enabled) {
      return
    }
    await this.bump(projectVersionKey(projectId))
    this.logger.debug(logEvent('cache.invalidated', { project: projectId }))
  }

  private async bump(versionKey: string): Promise<string | undefined> {
    const version = randomUUID().slice(0, 8)
    const stored = await this.attempt('write version', () =>
      this.cache.set(versionKey, version, VERSION_TTL_MS),
    )

    return stored === undefined ? undefined : version
  }

  /** Runs a store operation with a deadline; logs and swallows failures. */
  private async attempt<T>(
    what: string,
    operation: () => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.isStoreReady()) {
      if (Date.now() < this.nextProbeAt) {
        return undefined
      }
      // Let this one through as a probe; it also triggers a reconnect.
      this.nextProbeAt = Date.now() + PROBE_INTERVAL_MS
    }
    let timer: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error(`timed out after ${OPERATION_TIMEOUT_MS}ms`)),
            OPERATION_TIMEOUT_MS,
          )
        }),
      ])
      return result
    } catch (error) {
      const message = logEvent('cache.operation_failed', {
        operation: what,
        error: (error as Error).message,
        fallback: 'uncached',
      })
      // Warn once a minute, not once per request, during an outage.
      if (Date.now() - this.lastWarnAt >= WARN_INTERVAL_MS) {
        this.lastWarnAt = Date.now()
        this.logger.warn(message)
      } else {
        this.logger.debug(message)
      }

      return undefined
    } finally {
      clearTimeout(timer)
    }
  }
}

function projectVersionKey(projectId: string): string {
  return `ver:project:${projectId}`
}
