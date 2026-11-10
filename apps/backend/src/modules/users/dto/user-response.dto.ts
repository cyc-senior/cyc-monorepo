import { ApiProperty } from '@nestjs/swagger'

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'email' })
  email: string

  emailVerified: boolean

  name: string | null

  image: string | null

  createdAt: Date
}
