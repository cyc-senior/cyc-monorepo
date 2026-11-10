/** `iss` of every token this backend signs. */
export const JWT_ISSUER = 'cyc-backend'

/** `aud` of user access tokens; the JWT strategy accepts nothing else. */
export const API_AUDIENCE = 'cyc-api'

/** `aud` of tester (session participant) tokens; only the tester guard accepts it. */
export const TESTER_AUDIENCE = 'cyc-testing'
