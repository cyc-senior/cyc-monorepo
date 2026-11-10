import { randomUUID } from 'node:crypto'

import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'

import { logEvent } from './log-event'
import { runWithRequestId } from './request-context'

export const REQUEST_ID_HEADER = 'x-request-id'

const VALID_REQUEST_ID = /^[\w.-]{1,128}$/
/** Link secrets would travel in the path; never write them to the log. */
const SECRET_SEGMENT =
  /^(?![0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$)[\w-]{32,}$/i
const SECRET_QUERY_KEY = /code|token|secret|password|state/i

interface LoggedRequest extends Request {
  user?: { id?: string }
}

/**
 * Logs one line per HTTP request once its response is sent, including requests
 * rejected by guards, pipes or unknown routes, which never reach an
 * interceptor. 5xx are errors, 4xx warnings. Also assigns the request id
 * (honouring a sane incoming `X-Request-Id`) that every other log line of the
 * request carries, and echoes it back in the response.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP')

  use(req: LoggedRequest, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER)
    const requestId =
      incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID()
    res.setHeader(REQUEST_ID_HEADER, requestId)
    const started = process.hrtime.bigint()

    runWithRequestId(requestId, () => {
      let logged = false
      const done = () => {
        if (logged) {
          return
        }
        logged = true
        // An event stream normally ends by the client going away: not an error.
        const streamed = String(res.getHeader('content-type') ?? '').startsWith(
          'text/event-stream',
        )
        const status = res.writableFinished || streamed ? res.statusCode : 499
        const message = logEvent('http.request', {
          method: req.method,
          path: redactUrl(req.originalUrl),
          status,
          ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
          stream: streamed || undefined,
          user: req.user?.id,
          ip: req.ip,
        })
        if (status >= 500) {
          this.logger.error(message)
        } else if (status >= 400) {
          this.logger.warn(message)
        } else {
          this.logger.log(message)
        }
      }
      res.on('finish', done)
      // A client that disconnects first never gets `finish`.
      res.on('close', done)
      next()
    })
  }
}

/** The URL with secret-looking path segments and query values masked. */
export function redactUrl(url: string): string {
  const [path, query] = url.split('?', 2)
  const safePath = path
    .split('/')
    .map((segment) => (SECRET_SEGMENT.test(segment) ? '[redacted]' : segment))
    .join('/')
  if (!query) {
    return safePath
  }
  const params = new URLSearchParams(query)
  for (const key of [...params.keys()]) {
    if (SECRET_QUERY_KEY.test(key)) {
      params.set(key, '[redacted]')
    }
  }

  return `${safePath}?${decodeURIComponent(params.toString())}`
}
