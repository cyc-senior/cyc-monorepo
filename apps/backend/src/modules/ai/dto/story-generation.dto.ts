import { ApiProperty } from '@nestjs/swagger'
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import { GenerationJobStatus, Prisma } from '../../../generated/prisma/client'

export class CreateStoryGenerationDto {
  /** How many stories to draft. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number = 3

  /**
   * Extra guidance on top of the design brief.
   * @example 'Focus on first-time visitors on mobile.'
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string

  /** Repeating the request with the same key returns the original job. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey?: string
}

export class StoryGenerationDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  @ApiProperty({ format: 'uuid' })
  requestedById: string | null

  instruction: string | null

  count: number

  modelProvider: string

  modelName: string

  /** SUCCEEDED means the drafts exist as DRAFT user stories (origin AI) for review. */
  @ApiProperty({ enum: GenerationJobStatus, enumName: 'GenerationJobStatus' })
  status: GenerationJobStatus

  @JsonOutput('Token usage and counts.')
  outputMetadata: Prisma.JsonValue

  error: string | null

  /** The stories this job drafted. */
  @ApiProperty({ type: [String], format: 'uuid' })
  storyIds: string[]

  startedAt: Date | null

  finishedAt: Date | null

  createdAt: Date

  updatedAt: Date
}
