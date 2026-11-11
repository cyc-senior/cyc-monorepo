import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  Platform,
  Prisma,
  ReportType,
  UiLibrary,
  UIVariantStatus,
} from '../../../generated/prisma/client'

// ---------------------------------------------------------------------------
// Shared (approved) rounds
// ---------------------------------------------------------------------------

export class SharedVariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  label: string | null

  name: string

  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  uiLibrary: UiLibrary

  @ApiProperty({ enum: UIVariantStatus, enumName: 'UIVariantStatus' })
  status: UIVariantStatus
}

export class SharedRoundDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  roundNumber: number

  title: string | null

  approvedAt: Date

  /** The variants a designer approved in this round. */
  variants: SharedVariantDto[]

  acknowledgementCount: number

  commentCount: number

  /** Whether the caller acknowledged this round. */
  acknowledgedByMe: boolean
}

export class SharedPrototypeDto extends SharedVariantDto {
  /** The design to render, in `<iframe sandbox srcdoc>`. Null for legacy JSON variants. */
  html: string | null

  @JsonOutput('Legacy JSON design (variants made before HTML generation).')
  design: Prisma.JsonValue | null

  @JsonOutput('WCAG 2.0 AA report of the design.')
  accessibility: Prisma.JsonValue
}

export class SharedRoundDetailDto extends SharedRoundDto {
  prototypes: SharedPrototypeDto[]
}

export class CreateRoundCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string
}

export class CommentAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  name: string | null
}

export class RoundCommentDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  @ApiProperty({ type: () => CommentAuthorDto, nullable: true })
  author: CommentAuthorDto | null

  body: string

  createdAt: Date
}

// ---------------------------------------------------------------------------
// Developer handoff
// ---------------------------------------------------------------------------

export class HandoffAccessibilityDto {
  passed: boolean

  errors: number

  warnings: number

  autoFixed: string[]
}

export class HandoffVariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  label: string | null

  name: string

  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  uiLibrary: UiLibrary

  /** HTML for current designs, LEGACY_JSON for designs made before HTML generation. */
  @ApiProperty({ enum: ['HTML', 'LEGACY_JSON'] })
  format: 'HTML' | 'LEGACY_JSON'

  /** HTML element → how many times the design uses it (buttons, inputs, links, landmarks, ...). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: { button: 3, input: 2, nav: 1 },
  })
  elementUsage: Record<string, number>

  @ApiProperty({ type: () => HandoffAccessibilityDto })
  accessibility: HandoffAccessibilityDto

  /** Remaining technical risks (accessibility warnings, what the sanitizer removed). */
  technicalRisks: string[]
}

export class HandoffRoundDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  roundNumber: number

  title: string | null

  approvedAt: Date

  variants: HandoffVariantDto[]
}

export class HandoffBrandColorsDto {
  primary: string | null

  secondary: string | null

  accent: string | null
}

export class HandoffDto {
  /** Design system of the design intent (null until it is defined). */
  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary', nullable: true })
  designSystem: UiLibrary | null

  designStandards: string[]

  @ApiProperty({ enum: Platform, enumName: 'Platform', isArray: true })
  platforms: Platform[]

  @ApiProperty({ type: () => HandoffBrandColorsDto })
  brandColors: HandoffBrandColorsDto

  brandGuidelines: string | null

  rounds: HandoffRoundDto[]
}

export class HandoffSpecDto extends HandoffVariantDto {
  @ApiProperty({ format: 'uuid' })
  roundId: string

  /** The HTML design: the specification to build from. Null for legacy JSON variants. */
  html: string | null

  @JsonOutput('Legacy JSON design (variants made before HTML generation).')
  design: Prisma.JsonValue | null

  @JsonOutput('Full HTML / WCAG 2.1 AA check report.')
  accessibilityReport: Prisma.JsonValue
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export class GenerateReportDto {
  @ApiProperty({ enum: ReportType, enumName: 'ReportType' })
  @IsEnum(ReportType)
  type: ReportType

  /** Limit the report to one round. Default: the whole project. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roundId?: string
}

export class ReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReportType, enumName: 'ReportType' })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType
}

export class ReportDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  @ApiProperty({ format: 'uuid' })
  roundId: string | null

  /**
   * The audience. A reader only ever sees reports written for their role:
   * CLIENT → CLIENT, DEVELOPER → DEVELOPER, PROJECT_MANAGER / PRODUCT_OWNER →
   * PROJECT_MANAGER, DESIGNER → all.
   */
  @ApiProperty({ enum: ReportType, enumName: 'ReportType' })
  type: ReportType

  title: string

  @JsonOutput(
    'The report body; its fields depend on `type` (see docs/backend-architecture.md). Never contains participant identities, raw feedback or consent records, except the DESIGNER report’s aggregated counts.',
  )
  content: Prisma.JsonValue

  @ApiProperty({ format: 'uuid' })
  generatedById: string | null

  createdAt: Date
}

export class ProjectStatusDto {
  @JsonOutput('Live project status: rounds, testing progress, timeline gaps.')
  status: Record<string, unknown>
}
