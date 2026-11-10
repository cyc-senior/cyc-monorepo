import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import {
  GenerationJobStatus,
  Prisma,
  UiLibrary,
} from '../../../generated/prisma/client'

/**
 * The designer's prompt. The project, its design intent and personas come
 * from the project; the backend fills them into the prompt template.
 */
export class CreateGenerationJobDto {
  /**
   * What to design now (with a `baseVariantId`: how to change it).
   * @example 'Checkout for returning customers with a saved card.'
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  prompt: string

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

  /**
   * Personas of the project to design for. Default: every persona written by
   * a designer (up to 5).
   */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  personaIds?: string[]

  /**
   * Synthesize a user persona from this prompt and save it to the project
   * (origin AI) before designing. On by default.
   */
  @IsOptional()
  @IsBoolean()
  synthesizePersona?: boolean = true

  /**
   * Refine an existing variant of the project instead of designing from
   * scratch: `prompt` then holds the instruction ("make the CTA more
   * prominent"). The results are new variants whose parent is this one.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  baseVariantId?: string

  /**
   * Any unique string (e.g. a UUID) chosen by the client. Repeating the request
   * with the same key returns the original job instead of queuing a second one.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey?: string
}

export class GenerationJobDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  @ApiProperty({ format: 'uuid' })
  requestedById: string | null

  /** The design system of the design intent when the job was created. */
  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  uiLibrary: UiLibrary

  prompt: string | null

  /** The variant being refined, if this is a refinement job. */
  @ApiProperty({ format: 'uuid' })
  baseVariantId: string | null

  idempotencyKey: string | null

  variantCount: number

  /** @example 'gateway.ai.cpe.kmutt.ac.th' */
  modelProvider: string

  /** @example 'qwen3.8-27b' */
  modelName: string

  @ApiProperty({ enum: GenerationJobStatus, enumName: 'GenerationJobStatus' })
  status: GenerationJobStatus

  @JsonOutput(
    'Everything the prompt template used: project, design intent, personas, stories, prompt.',
  )
  inputSnapshot: Prisma.JsonValue

  @JsonOutput(
    'Token usage, the persona artifact id (`personaId`) and, per variant, attempts, warnings or the issues that made it fail.',
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
