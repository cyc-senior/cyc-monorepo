import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import { Prisma, UiLibrary } from '../../../generated/prisma/client'

const HEX = /^#[0-9A-Fa-f]{6}$/
const HEX_MESSAGE = 'must be a hex color like #1A73E8'

/**
 * The project's design intent: reusable context for every design the LLM
 * generates. Personas are managed separately (`/projects/{id}/personas`).
 */
export class PutDesignIntentDto {
  /**
   * What the design must achieve.
   * @example 'Let returning customers check out in under a minute.'
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  statement?: string

  /** Design system the HTML follows. */
  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  @IsEnum(UiLibrary)
  designSystem: UiLibrary

  /**
   * Standards the design must meet.
   * @example ['WCAG 2.1 AA']
   */
  @ApiPropertyOptional({ type: [String], default: ['WCAG 2.1 AA'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(80, { each: true })
  designStandards?: string[]

  /** Further design-system and standards guidance (spacing, density, components to prefer, ...). */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  designGuidelines?: string

  /** Brand & CI: primary color (main actions, key brand areas). @example '#1A73E8' */
  @Matches(HEX, { message: `primaryColor ${HEX_MESSAGE}` })
  primaryColor: string

  /** Brand & CI: secondary color (supporting surfaces and elements). @example '#0F172A' */
  @Matches(HEX, { message: `secondaryColor ${HEX_MESSAGE}` })
  secondaryColor: string

  /** Brand & CI: accent color (highlights, badges, focus). @example '#F59E0B' */
  @Matches(HEX, { message: `accentColor ${HEX_MESSAGE}` })
  accentColor: string

  /** Brand & CI notes: logo usage, typography, imagery, do's and don'ts. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  brandGuidelines?: string

  /**
   * How the copy should sound; the LLM writes all text in this voice.
   * @example 'Warm, plain-spoken, confident; no jargon.'
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  toneOfVoice?: string
}

export class DesignIntentDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  statement: string | null

  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  designSystem: UiLibrary

  designStandards: string[]

  designGuidelines: string | null

  primaryColor: string | null

  secondaryColor: string | null

  accentColor: string | null

  brandGuidelines: string | null

  toneOfVoice: string | null

  @JsonOutput(
    'Free-form brief of the earlier model, kept read-only after the migration.',
  )
  legacyBrief: Prisma.JsonValue

  /** Starts at 1; incremented on every change. Generation jobs keep a snapshot. */
  version: number

  createdAt: Date

  updatedAt: Date
}
