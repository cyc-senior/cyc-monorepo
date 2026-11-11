import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { Prisma } from '../../../generated/prisma/client'

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  @ApiProperty({ format: 'uuid' })
  actorId: string | null

  /** @example 'DesignRound.approve' */
  action: string

  /** @example 'DesignRound' */
  entityType: string

  @ApiProperty({ format: 'uuid' })
  entityId: string | null

  /** Request body of the mutation (secrets redacted). */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  changes: Prisma.JsonValue

  createdAt: Date
}

export class AuditLogQueryDto extends PaginationQueryDto {
  /** @example 'DesignRound' */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entityId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorId?: string

  /** @example 'DesignRound.approve' */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string

  /** Only entries at or after this time. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date

  /** Only entries at or before this time. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date
}
