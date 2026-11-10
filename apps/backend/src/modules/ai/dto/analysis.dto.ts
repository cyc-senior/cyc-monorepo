import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  AnalysisStatus,
  FeedbackCategory,
  FeedbackSeverity,
  Prisma,
  ThemeOrigin,
  ThemeStatus,
} from '../../../generated/prisma/client'

export class CreateAnalysisDto {
  /** Round whose test feedback is analysed. */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roundId: string

  /** Limit the analysis to one session of the round. Default: every session of the round. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string

  /** Repeating the request with the same key returns the original analysis. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey?: string
}

export class AnalysisQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roundId?: string

  @ApiPropertyOptional({ enum: AnalysisStatus, enumName: 'AnalysisStatus' })
  @IsOptional()
  @IsEnum(AnalysisStatus)
  status?: AnalysisStatus
}

/** The designer's edits of the AI's summary. The AI's original is kept in `ai*`. */
export class UpdateAnalysisDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  summary?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  insights?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string
}

export class DecideAnalysisDto {
  /** Why (kept in the decision history). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string
}

export class AnalysisDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  @ApiProperty({ format: 'uuid' })
  sessionId: string | null

  @ApiProperty({ format: 'uuid' })
  requestedById: string | null

  /**
   * QUEUED → RUNNING → READY (waiting for a designer) → APPROVED or REJECTED.
   * Only a designer moves it past READY.
   */
  @ApiProperty({ enum: AnalysisStatus, enumName: 'AnalysisStatus' })
  status: AnalysisStatus

  modelProvider: string

  modelName: string

  /** What the AI wrote. Never edited. */
  aiSummary: string | null

  @ApiProperty({ type: [String] })
  aiInsights: string[]

  /** The designer-reviewed summary (starts as a copy of `aiSummary`). */
  summary: string | null

  @ApiProperty({ type: [String] })
  insights: string[]

  reviewNote: string | null

  @ApiProperty({ format: 'uuid' })
  reviewedById: string | null

  reviewedAt: Date | null

  @JsonOutput('Token usage and counts.')
  outputMetadata: Prisma.JsonValue

  error: string | null

  /** How many raw feedback items the analysis covers. */
  feedbackCount: number

  themeCount: number

  startedAt: Date | null

  finishedAt: Date | null

  createdAt: Date

  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export class ThemeDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  analysisId: string

  /** AI = proposed by the model; DESIGNER = made by hand, merged or split off. */
  @ApiProperty({ enum: ThemeOrigin, enumName: 'ThemeOrigin' })
  origin: ThemeOrigin

  @ApiProperty({ enum: ThemeStatus, enumName: 'ThemeStatus' })
  status: ThemeStatus

  /** The model's own wording, kept unchanged next to the designer's. */
  aiTitle: string | null

  aiSummary: string | null

  @ApiProperty({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  aiCategory: FeedbackCategory | null

  @ApiProperty({ enum: FeedbackSeverity, enumName: 'FeedbackSeverity' })
  aiSeverity: FeedbackSeverity | null

  title: string

  summary: string

  @ApiProperty({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  category: FeedbackCategory

  @ApiProperty({ enum: FeedbackSeverity, enumName: 'FeedbackSeverity' })
  severity: FeedbackSeverity

  labels: string[]

  designerNote: string | null

  /** Why the designer decided not to fix it. */
  wontFixReason: string | null

  selectedForIteration: boolean

  selectedAt: Date | null

  @ApiProperty({ format: 'uuid' })
  mergedIntoId: string | null

  /** The raw feedback items grouped here (see the session's feedback listing). */
  @ApiProperty({ type: [String], format: 'uuid' })
  feedbackIds: string[]

  createdAt: Date

  updatedAt: Date
}

export class ThemeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ThemeStatus, enumName: 'ThemeStatus' })
  @IsOptional()
  @IsEnum(ThemeStatus)
  status?: ThemeStatus

  @ApiPropertyOptional({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory

  @ApiPropertyOptional({ enum: FeedbackSeverity, enumName: 'FeedbackSeverity' })
  @IsOptional()
  @IsEnum(FeedbackSeverity)
  severity?: FeedbackSeverity
}

export class CreateThemeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  summary: string

  @ApiProperty({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  @IsEnum(FeedbackCategory)
  category: FeedbackCategory

  @ApiProperty({ enum: FeedbackSeverity, enumName: 'FeedbackSeverity' })
  @IsEnum(FeedbackSeverity)
  severity: FeedbackSeverity

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  labels?: string[]

  /** Raw feedback of the analysis to group under the theme. */
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  feedbackIds: string[]
}

/** The designer's edits. The AI's wording stays in `ai*`. */
export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  summary?: string

  @ApiPropertyOptional({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory

  @ApiPropertyOptional({ enum: FeedbackSeverity, enumName: 'FeedbackSeverity' })
  @IsOptional()
  @IsEnum(FeedbackSeverity)
  severity?: FeedbackSeverity

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  labels?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  designerNote?: string

  /** Review decision: accept or reject the suggestion (or put it back to PROPOSED). */
  @ApiPropertyOptional({ enum: ['PROPOSED', 'ACCEPTED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['PROPOSED', 'ACCEPTED', 'REJECTED'])
  status?: 'PROPOSED' | 'ACCEPTED' | 'REJECTED'
}

export class MergeThemesDto {
  /** At least two themes of the same analysis. */
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  themeIds: string[]

  /** Defaults to the first theme's. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  summary?: string
}

export class SplitThemeDto {
  /** Feedback to move out of the theme into a new one (not all of it). */
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  feedbackIds: string[]

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  summary?: string
}

export class WontFixDto {
  /** Why this will not be fixed. Required: it is part of the design record. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string
}

export class SelectThemeDto {
  /** Why it goes into the next iteration. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string
}
