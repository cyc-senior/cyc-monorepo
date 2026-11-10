import { Transform } from 'class-transformer'

/** Parses `"true"` / `"false"` query-string values; anything else fails `@IsBoolean()`. */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }

    return value
  })
