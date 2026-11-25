import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  DesignRoundStatus,
  GenerationJobStatus,
  Prisma,
  StoryOrigin,
  UserStoryStatus,
} from '../../../generated/prisma/client'

export class CreateUserStoryDto {
  /** @example 'Pay with a saved card' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  acceptanceCriteria?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  problemStatement?: string | null

  @ApiPropertyOptional({ enum: UserStoryStatus, enumName: 'UserStoryStatus' })
  @IsOptional()
  @IsEnum(UserStoryStatus)
  status?: UserStoryStatus
}

export class UpdateUserStoryDto extends PartialType(CreateUserStoryDto) {
  /** Saved structured A/B prompt draft for this story. */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  draftPrompt?: Record<string, unknown> | null
}

export class UserStoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStoryStatus, enumName: 'UserStoryStatus' })
  @IsOptional()
  @IsEnum(UserStoryStatus)
  status?: UserStoryStatus
}

export class StoryActiveJobDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ enum: GenerationJobStatus, enumName: 'GenerationJobStatus' })
  status: GenerationJobStatus

  /** A refinement of an existing design, not the first A/B generation. */
  refinement: boolean
}

/** Where a story's design cycle stands (its latest design round). */
export class StoryDesignCycleDto {
  @ApiProperty({ format: 'uuid' })
  roundId: string

  roundNumber: number

  @ApiProperty({ enum: DesignRoundStatus, enumName: 'DesignRoundStatus' })
  roundStatus: DesignRoundStatus

  /** Designs (variants) in the round, archived ones excluded. */
  variantCount: number

  /** Designs approved for testing ("Ready to test"). */
  approvedCount: number

  /** A generation that is queued or running, if any. */
  @ApiProperty({ nullable: true })
  activeJob: StoryActiveJobDto | null
}

export class UserStoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  title: string

  description: string | null

  acceptanceCriteria: string | null

  problemStatement: string | null

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  draftPrompt: Prisma.JsonValue | null

  @ApiProperty({ enum: UserStoryStatus, enumName: 'UserStoryStatus' })
  status: UserStoryStatus

  /** MANUAL, or AI for a draft written by the model (always starts as DRAFT). */
  @ApiProperty({ enum: StoryOrigin, enumName: 'StoryOrigin' })
  origin: StoryOrigin

  /** The AI drafting job that wrote it, if any. */
  @ApiProperty({ format: 'uuid' })
  generationId: string | null

  createdAt: Date

  updatedAt: Date

  /** Null until the story's structured prompt is approved (a round exists). */
  @ApiProperty({ type: StoryDesignCycleDto, nullable: true })
  designCycle: StoryDesignCycleDto | null
}
