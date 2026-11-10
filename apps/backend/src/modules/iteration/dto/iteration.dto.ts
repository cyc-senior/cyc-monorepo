import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  DecisionType,
  DesignRoundStatus,
  FeedbackCategory,
  FeedbackSeverity,
  UIVariantStatus,
} from '../../../generated/prisma/client'
import { DesignRoundDto } from '../../rounds/dto/design-round.dto'

export class StartIterationDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  /** Why this iteration (kept in the decision history). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string

  /**
   * Variants of this round to copy into the new round as a starting point (up
   * to 4). The copies keep a link to their originals; refine them with a
   * generation job (`baseVariantId`) or by hand.
   */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  carryForwardVariantIds?: string[]
}

export class AddressedThemeDto {
  @ApiProperty({ format: 'uuid' })
  themeId: string

  title: string

  summary: string

  @ApiProperty({ enum: FeedbackCategory, enumName: 'FeedbackCategory' })
  category: FeedbackCategory

  @ApiProperty({ enum: FeedbackSeverity, enumName: 'FeedbackSeverity' })
  severity: FeedbackSeverity

  designerNote: string | null

  /** How many raw feedback items back it. */
  feedbackCount: number
}

export class IterationDto {
  round: DesignRoundDto

  /** The themes this round was opened to address. */
  addressed: AddressedThemeDto[]

  /** Copies of the source round's variants made for the new round. */
  @ApiProperty({ type: [String], format: 'uuid' })
  carriedVariantIds: string[]
}

export class DecisionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roundId?: string

  @ApiPropertyOptional({ enum: DecisionType, enumName: 'DecisionType' })
  @IsOptional()
  @IsEnum(DecisionType)
  type?: DecisionType
}

export class DecisionDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  @ApiProperty({ enum: DecisionType, enumName: 'DecisionType' })
  type: DecisionType

  @ApiProperty({ format: 'uuid' })
  variantId: string | null

  @ApiProperty({ format: 'uuid' })
  sessionId: string | null

  @ApiProperty({ format: 'uuid' })
  analysisId: string | null

  @ApiProperty({ format: 'uuid' })
  themeId: string | null

  /** For ITERATION_STARTED: the round that was opened. */
  @ApiProperty({ format: 'uuid' })
  resultingRoundId: string | null

  @ApiProperty({ format: 'uuid' })
  decidedById: string | null

  rationale: string | null

  createdAt: Date
}

export class TraceVariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  label: string | null

  name: string

  @ApiProperty({ enum: UIVariantStatus, enumName: 'UIVariantStatus' })
  status: UIVariantStatus

  @ApiProperty({ format: 'uuid' })
  parentVariantId: string | null

  version: number
}

/** How a round came to be, and what was decided in it. */
export class RoundTraceDto {
  @ApiProperty({ format: 'uuid' })
  roundId: string

  roundNumber: number

  @ApiProperty({ enum: DesignRoundStatus, enumName: 'DesignRoundStatus' })
  status: DesignRoundStatus

  @ApiProperty({ format: 'uuid' })
  parentRoundId: string | null

  /** Feedback themes this round was opened to address. */
  addressed: AddressedThemeDto[]

  /** The round's variants and the variants they came from. */
  variants: TraceVariantDto[]

  /** Decisions made in this round, oldest first. */
  decisions: DecisionDto[]

  /** Rounds opened from this one, with the decision that opened them. */
  @ApiProperty({ type: [String], format: 'uuid' })
  childRoundIds: string[]
}
