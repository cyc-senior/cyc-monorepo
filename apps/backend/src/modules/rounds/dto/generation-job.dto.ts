import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import {
  GenerationJobStatus,
  Prisma,
  UiLibrary,
} from '../../../generated/prisma/client'

/** The design intent and UI kit come from the project's design brief. */
export class CreateGenerationJobDto {
  /**
   * Extra instructions on top of the brief.
   * @example 'Checkout for returning customers with a saved card.'
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string

  /** How many alternative designs to make. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  variantCount?: number = 2

  /** User stories of the project the designs must satisfy. */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  storyIds?: string[]
}

export class GenerationJobDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  @ApiProperty({ format: 'uuid' })
  requestedById: string | null

  /** The UI kit the designs are built with (the project's, at creation). */
  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  uiLibrary: UiLibrary

  prompt: string | null

  variantCount: number

  /** @example 'gateway.ai.cpe.kmutt.ac.th' */
  modelProvider: string

  /** @example 'qwen3.8-27b' */
  modelName: string

  @ApiProperty({ enum: GenerationJobStatus, enumName: 'GenerationJobStatus' })
  status: GenerationJobStatus

  @JsonOutput(
    'The design brief, user stories and prompt the job generates from.',
  )
  inputSnapshot: Prisma.JsonValue

  @JsonOutput(
    'Token usage and, per variant, attempts, auto-fixes or the issues that made it fail.',
  )
  outputMetadata: Prisma.JsonValue

  /** Why the job failed, or why it is being retried. */
  error: string | null

  startedAt: Date | null

  finishedAt: Date | null

  /** Variants this job produced. */
  @ApiProperty({ type: [String], format: 'uuid' })
  variantIds: string[]

  createdAt: Date

  updatedAt: Date
}
