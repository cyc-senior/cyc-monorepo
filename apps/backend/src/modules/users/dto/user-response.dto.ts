import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'email' })
  email: string

  @ApiProperty()
  emailVerified: boolean

  @ApiPropertyOptional({ nullable: true })
  name: string | null

  @ApiPropertyOptional({ nullable: true })
  image: string | null

  @ApiProperty()
  createdAt: Date
}
