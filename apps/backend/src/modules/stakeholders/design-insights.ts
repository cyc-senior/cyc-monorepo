/** Reads facts out of a stored accessibility report without trusting its shape. */
export { elementUsage } from '../design/html/check-html'

export interface AccessibilitySummary {
  passed: boolean
  errors: number
  warnings: number
  /** What was changed mechanically: removed by the sanitizer (HTML) or auto-fixed (legacy). */
  autoFixed: string[]
  /** The first few warning messages (the technical risks left in the design). */
  warningMessages: string[]
}

export function accessibilitySummary(report: unknown): AccessibilitySummary {
  const value = (report ?? {}) as {
    passed?: unknown
    errors?: unknown
    warnings?: unknown
    autoFixed?: unknown
    removed?: unknown
    issues?: Array<{ severity?: string; message?: string; criterion?: string }>
  }

  return {
    passed: value.passed === true,
    errors: typeof value.errors === 'number' ? value.errors : 0,
    warnings: typeof value.warnings === 'number' ? value.warnings : 0,
    // `removed` (HTML sanitizer) for HTML designs, `autoFixed` for legacy JSON ones.
    autoFixed: [value.removed, value.autoFixed]
      .filter(Array.isArray)
      .flat()
      .filter((x): x is string => typeof x === 'string'),
    warningMessages: (value.issues ?? [])
      .filter((issue) => issue.severity === 'warning')
      .slice(0, 10)
      .map(
        (issue) =>
          `${issue.criterion ? `WCAG ${issue.criterion}: ` : ''}${issue.message ?? ''}`,
      ),
  }
}
