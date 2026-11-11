import { ConsoleLogger, LogLevel } from '@nestjs/common'

import { currentRequestId } from './request-context'

export type LogFormat = 'json' | 'pretty'

/** Most to least severe; a configured level enables itself and everything above. */
const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']

/**
 * Nest's console logger, tagged with the current request id so every line an
 * HTTP request causes (guards, services, Prisma, cache) can be correlated.
 * `json` writes one JSON object per line for log shippers; `pretty` is the
 * coloured developer format.
 */
export class AppLogger extends ConsoleLogger {
  constructor(level: LogLevel, format: LogFormat) {
    super({
      json: format === 'json',
      colors: format === 'pretty',
      logLevels: LEVELS.slice(0, LEVELS.indexOf(level) + 1),
    })
  }

  protected getJsonLogObject(
    message: unknown,
    options: Parameters<ConsoleLogger['getJsonLogObject']>[1],
  ) {
    const requestId = currentRequestId()
    const object = super.getJsonLogObject(message, options)

    return requestId ? { ...object, requestId } : object
  }

  protected formatContext(context: string): string {
    const requestId = currentRequestId()

    return super.formatContext(
      requestId ? `${context} ${requestId.slice(0, 8)}` : context,
    )
  }
}
