import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { StoryOrigin, UserStoryStatus } from '../../../generated/prisma/client'

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

export class UpdateUserStoryDto extends PartialType(CreateUserStoryDto) {}

export class UserStoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStoryStatus, enumName: 'UserStoryStatus' })
  @IsOptional()
  @IsEnum(UserStoryStatus)
  status?: UserStoryStatus
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
}
