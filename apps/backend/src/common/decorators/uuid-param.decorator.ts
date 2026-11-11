import { Param, ParseUUIDPipe } from '@nestjs/common'

/** Route param that must be a UUID; anything else is a 400, not a DB error. */
export const UuidParam = (name: string) => Param(name, new ParseUUIDPipe())
