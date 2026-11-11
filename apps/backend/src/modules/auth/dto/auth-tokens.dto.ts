export class AuthTokensDto {
  /** Short-lived JWT; send as `Authorization: Bearer`. */
  accessToken: string

  /** Opaque, single-use token for POST /auth/refresh. */
  refreshToken: string

  /** @example 'Bearer' */
  tokenType: 'Bearer'

  /** Access token lifetime in seconds. */
  expiresIn: number
}
