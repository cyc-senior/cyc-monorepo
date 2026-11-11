import { z } from 'zod'

/**
 * Keywords constrained-decoding engines (vLLM/xgrammar, llguidance) reject.
 * They only narrow what zod validates anyway, so dropping them is safe.
 */
const UNSUPPORTED_KEYWORDS = new Set(['$schema', 'propertyNames'])

function withoutUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutUnsupported)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UNSUPPORTED_KEYWORDS.has(key))
        .map(([key, child]) => [key, withoutUnsupported(child)]),
    )
  }

  return value
}

/** JSON Schema of a zod schema, for LLM structured output (answers are still validated with zod). */
export function llmJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return withoutUnsupported(
    z.toJSONSchema(schema, { target: 'draft-2020-12' }),
  ) as Record<string, unknown>
}
