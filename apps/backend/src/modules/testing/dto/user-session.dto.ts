import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Frontend dashboard shape for a session the signed-in user has joined. */
export class UserSessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ example: 'Fintech checkout' })
  title: string

  @ApiProperty({
    enum: ['ACTIVE', 'SCHEDULED', 'COMPLETED'],
    example: 'ACTIVE',
  })
  status: 'ACTIVE' | 'SCHEDULED' | 'COMPLETED'

  @ApiPropertyOptional({ example: 2 })
  currentRound?: number

  @ApiPropertyOptional({ example: 5 })
  totalRounds?: number

  /** ISO timestamp of the participant's most recent activity. */
  @ApiPropertyOptional()
  lastActiveTime?: string

  /** ISO timestamp when a scheduled session opens. */
  @ApiPropertyOptional()
  opensAt?: string

  /** ISO timestamp when the participant finished. */
  @ApiPropertyOptional()
  submittedAt?: string
}
