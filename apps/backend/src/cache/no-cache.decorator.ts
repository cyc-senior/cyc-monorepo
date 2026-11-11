import { SetMetadata } from '@nestjs/common'

export const NO_CACHE_KEY = 'noResponseCache'

/**
 * Opts a GET route (or a whole controller) out of the response cache, for
 * data that must always be read fresh, such as the audit log.
 */
export const NoCache = () => SetMetadata(NO_CACHE_KEY, true)
