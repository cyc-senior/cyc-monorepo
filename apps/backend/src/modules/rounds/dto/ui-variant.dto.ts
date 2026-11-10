import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import {
  JsonOutput,
  RequiredJsonInput,
} from '../../../common/decorators/json-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  Prisma,
  UiLibrary,
  UIVariantStatus,
} from '../../../generated/prisma/client'

const DESIGN_DESCRIPTION =
  'Figma-like design document (DOCUMENT → CANVAS → FRAME screens of FRAME/TEXT/RECTANGLE/INSTANCE nodes) for the project’s UI kit. See `GET /ui-kits/{uiLibrary}` for its JSON Schema and components. It must pass the UI kit guardrail and WCAG 2.0 AA checks.'

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

  @RequiredJsonInput(DESIGN_DESCRIPTION)
  design: Record<string, any>

  /** User stories of the project this variant addresses. */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  storyIds?: string[]

  @ApiPropertyOptional({ enum: UIVariantStatus, enumName: 'UIVariantStatus' })
  @IsOptional()
  @IsEnum(UIVariantStatus)
  status?: UIVariantStatus
}

export class UpdateUIVariantDto extends PartialType(CreateUIVariantDto) {}

export class UIVariantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UIVariantStatus, enumName: 'UIVariantStatus' })
  @IsOptional()
  @IsEnum(UIVariantStatus)
  status?: UIVariantStatus
}

export class UIVariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  /** The generation job that produced it; null when made by hand. */
  @ApiProperty({ format: 'uuid' })
  generationJobId: string | null

  name: string

  label: string | null

  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  uiLibrary: UiLibrary

  @JsonOutput(DESIGN_DESCRIPTION)
  design: Prisma.JsonValue

  @JsonOutput(
    'WCAG 2.0 AA report of the design: `{ standard, level, passed, checkedAt, errors, warnings, issues[], autoFixed[] }`.',
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
