type Field = string | number | boolean | null | undefined | Date

/**
 * Formats a domain event as `name key=value ...` so log lines read well in
 * the pretty format and stay greppable in JSON. Undefined fields are dropped.
 *
 * @example logEvent('invite.created', { invite: id, maxUses: 10 })
 */
export function logEvent(name: string, fields: Record<string, Field> = {}) {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key}=${value instanceof Date ? value.toISOString() : value}`,
    )

  return [name, ...pairs].join(' ')
}

/** A loggable reason for an error; connection errors (AggregateError) often have no message. */
export function errorText(error: unknown): string {
  if (error instanceof Error) {
    const { code } = error as Error & { code?: string }

    return error.message || code || error.name
  }

  return String(error)
}
