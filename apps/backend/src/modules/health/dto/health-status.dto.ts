export class HealthStatusDto {
  /** @example 'ok' */
  status: string

  /** Process uptime in seconds. */
  uptime: number

  /** Server time (ISO 8601). */
  timestamp: string
}
