import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { MAX_HTML_BYTES } from '../../design/html/sanitize-html-design'
import {
  Prisma,
  UiLibrary,
  UIVariantStatus,
} from '../../../generated/prisma/client'

export class CreateUIVariantDto {
  /** @example 'Single-page checkout' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string

  /** @example 'A' */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string | null

  /**
   * The design as one self-contained HTML document (embedded CSS, no
   * scripts). It is sanitized and must pass the structure, WCAG 2.1 AA markup
   * and platform checks.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_HTML_BYTES)
  html: string

  /** User stories of the project this variant addresses. */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  storyIds?: string[]

  /**
   * DRAFT, READY or ARCHIVED. APPROVED can only be reached through
   * `POST /variants/{variantId}/approve`.
   */
  @ApiPropertyOptional({
    enum: ['DRAFT', 'READY', 'ARCHIVED'],
    enumName: 'UIVariantEditableStatus',
  })
  @IsOptional()
  @IsIn(['DRAFT', 'READY', 'ARCHIVED'])
  status?: 'DRAFT' | 'READY' | 'ARCHIVED'
}

export class UpdateUIVariantDto extends PartialType(CreateUIVariantDto) {}

export class ApproveUIVariantDto {
  /** Why it is approved (kept in the decision history). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string
}

export class UIVariantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UIVariantStatus, enumName: 'UIVariantStatus' })
  @IsOptional()
  @IsEnum(UIVariantStatus)
  status?: UIVariantStatus
}

export class UIVariantHistoryDto {
  /** The variant and its ancestors, newest first. */
  @ApiProperty({ type: () => [UIVariantDto] })
  lineage: UIVariantDto[]
}

export class UIVariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  /** The generation job that produced it; null when made by hand. */
  @ApiProperty({ format: 'uuid' })
  generationJobId: string | null

  /** The variant this one was refined or iterated from. */
  @ApiProperty({ format: 'uuid' })
  parentVariantId: string | null

  /** Who approved it; only a designer's explicit action sets this. */
  @ApiProperty({ format: 'uuid' })
  approvedById: string | null

  approvedAt: Date | null

  name: string

  label: string | null

  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  uiLibrary: UiLibrary

  /**
   * The high-fidelity design: a sanitized, self-contained HTML document.
   * Render it in `<iframe sandbox srcdoc>` (no `allow-scripts`, no
   * `allow-same-origin`). Null only for legacy JSON variants.
   */
  html: string | null

  @JsonOutput(
    'Legacy Figma-like JSON design of variants made before HTML generation; null for HTML variants.',
  )
  design: Prisma.JsonValue | null

  @JsonOutput(
    'Check report of the HTML: `{ standard, scope, passed, checkedAt, errors, warnings, issues[], removed[], bytes }`.',
  )
  accessibility: Prisma.JsonValue

  /** Starts at 1; incremented on every update. */
  version: number

  @ApiProperty({ enum: UIVariantStatus, enumName: 'UIVariantStatus' })
  status: UIVariantStatus

  @ApiProperty({ type: [String], format: 'uuid' })
  storyIds: string[]

  createdAt: Date

  updatedAt: Date
}
