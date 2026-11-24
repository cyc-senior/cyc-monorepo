import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string

  /**
   * With a `refreshToken` in the body: store the new refresh token in the
   * httpOnly cookie (replacing any stale one, which page scripts cannot do)
   * and leave it out of the response, like the cookie flow.
   */
  @IsOptional()
  @IsBoolean()
  cookie?: boolean
}
