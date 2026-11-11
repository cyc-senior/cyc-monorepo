import { CACHE_TTL_METADATA } from '@nestjs/cache-manager'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { catchError, from, mergeMap, Observable, of, tap } from 'rxjs'

import { AccessRequest } from '../modules/access/access.types'
import { HttpCacheService } from './http-cache.service'
import { NO_CACHE_KEY } from './no-cache.decorator'

export const CACHE_STATUS_HEADER = 'X-Cache'

type CacheableRequest = Partial<AccessRequest> & {
  method: string
  originalUrl: string
}

/**
 * Caches GET responses of project routes in Redis and invalidates them when
 * the project's data changes.
 *
 * - Only routes behind `@Authorize` are cached: their project is known, and
 *   the permission guard has already run, so access is always checked fresh;
 *   only the body is reused. Keys include the caller and their role, because
 *   bodies can differ by role.
 * - Any other method in a project bumps the project's version before the
 *   response is sent, so a client always reads its own writes. Background
 *   work (design generation) invalidates through `HttpCacheService`.
 * - `@NoCache()` opts out; `@CacheTTL(ms)` overrides the lifetime.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: HttpCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http' || !this.cache.enabled) {
      return next.handle()
    }
    const request = context.switchToHttp().getRequest<CacheableRequest>()

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const projectId = request.access?.projectId

      return projectId ? this.invalidating(projectId, next) : next.handle()
    }

    const noCache = this.reflector.getAllAndOverride<boolean | undefined>(
      NO_CACHE_KEY,
      [context.getHandler(), context.getClass()],
    )
    const { access, user } = request
    if (request.method !== 'GET' || noCache || !access || !user) {
      return next.handle()
    }

    const ttl = this.reflector.get<number | undefined>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    )
    const response = context.switchToHttp().getResponse<Response>()

    return from(
      this.cache.responseKey(
        access.projectId,
        `${user.id}:${access.role}`,
        request.originalUrl,
      ),
    ).pipe(
      mergeMap(async (key) => ({
        key,
        hit: key ? await this.cache.get<unknown>(key) : undefined,
      })),
      mergeMap(({ key, hit }) => {
        if (hit !== undefined) {
          response.setHeader(CACHE_STATUS_HEADER, 'HIT')

          return of(hit)
        }
        response.setHeader(CACHE_STATUS_HEADER, 'MISS')

        return next.handle().pipe(
          tap((body) => {
            // Fire and forget: storing must not delay the response.
            if (key && body !== undefined && response.statusCode === 200) {
              void this.cache.set(key, body, ttl)
            }
          }),
        )
      }),
    )
  }

  /** Runs the write, then invalidates (even on error: it may be partial). */
  private invalidating(
    projectId: string,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (body) => {
        await this.cache.invalidate(projectId)

        return body
      }),
      catchError(async (error) => {
        await this.cache.invalidate(projectId)
        throw error
      }),
    )
  }
}
