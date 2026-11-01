import { ApiProperty } from '@nestjs/swagger'

export class AuthTokensDto {
  @ApiProperty({
    description: 'Short-lived JWT; send as `Authorization: Bearer`.',
  })
  accessToken: string

  @ApiProperty({
    description: 'Opaque, single-use token for POST /auth/refresh.',
  })
  refreshToken: string

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer'

  @ApiProperty({ description: 'Access token lifetime in seconds.' })
  expiresIn: number
}
