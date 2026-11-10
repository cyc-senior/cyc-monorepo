import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { DesignRoundStatus } from '../../../generated/prisma/client'

export class CreateDesignRoundDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string | null

  /** Earlier round of the same project this one iterates on. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentRoundId?: string | null
}

export class UpdateDesignRoundDto extends PartialType(CreateDesignRoundDto) {
  /** Cannot be set to APPROVED (use the approve endpoint). */
  @ApiPropertyOptional({
    enum: DesignRoundStatus,
    enumName: 'DesignRoundStatus',
  })
  @IsOptional()
  @IsEnum(DesignRoundStatus)
  status?: DesignRoundStatus
}

export class DesignRoundQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DesignRoundStatus,
    enumName: 'DesignRoundStatus',
  })
  @IsOptional()
  @IsEnum(DesignRoundStatus)
  status?: DesignRoundStatus
}

export class DesignRoundDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  /** Sequential within the project, from 1. */
  roundNumber: number

  title: string | null

  @ApiProperty({ format: 'uuid' })
  parentRoundId: string | null

  @ApiProperty({ enum: DesignRoundStatus, enumName: 'DesignRoundStatus' })
  status: DesignRoundStatus

  @ApiProperty({ format: 'uuid' })
  approvedById: string | null

  approvedAt: Date | null

  createdAt: Date

  updatedAt: Date
}
