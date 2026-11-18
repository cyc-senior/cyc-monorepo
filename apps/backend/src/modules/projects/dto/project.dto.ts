import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  Platform,
  ProjectRole,
  ProjectStatus,
} from '../../../generated/prisma/client'

/** What a project is created with. The design intent is defined afterwards. */
export class CreateProjectDto {
  /** @example 'Checkout redesign' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string

  /**
   * The client the project is for, or the product it designs.
   * @example 'Acme Bank mobile app'
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  clientOrProduct: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null

  /**
   * Platforms to design and test for. Optional at creation (the first wizard
   * step only collects the brief); defaults to `DESKTOP` in the database and
   * can be refined with `PATCH /projects/{projectId}` later.
   */
  @ApiPropertyOptional({
    enum: Platform,
    enumName: 'Platform',
    isArray: true,
    example: ['DESKTOP', 'MOBILE'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(Platform, { each: true })
  platforms?: Platform[]
}

/** Project details and archiving. The design intent has its own endpoint. */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus
}

export class ProjectQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus

  /** Case-insensitive match on the name. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string

  /** Only projects of this organization. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string
}

export class ProjectDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  /** The organization the project belongs to (fixed at creation). */
  @ApiProperty({ format: 'uuid' })
  organizationId: string

  name: string

  clientOrProduct: string

  description: string | null

  @ApiProperty({ enum: Platform, enumName: 'Platform', isArray: true })
  platforms: Platform[]

  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  status: ProjectStatus

  /** Whether the design intent has been defined (needed before generating). */
  hasDesignIntent: boolean

  @ApiProperty({ format: 'uuid' })
  createdById: string | null

  createdAt: Date

  updatedAt: Date
}

class TesterProgressDto {
  current: number

  total: number
}

class ProjectStatusBadgeDto {
  label: string

  @ApiProperty({ enum: ['warning', 'in-progress', 'ready'] })
  type: 'warning' | 'in-progress' | 'ready'
}

class ProjectMemberSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  name: string | null

  image: string | null
}

export class ProjectWithRoleDto extends ProjectDto {
  /** The caller's role in this project. */
  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole' })
  role: ProjectRole

  /** @example 'Round 2 of 5' */
  activeRound?: string

  /** Participants who joined vs. were invited in the latest test session. */
  testerProgress?: TesterProgressDto

  /** Variants in the latest design round. */
  variantCount?: number

  statusBadge?: ProjectStatusBadgeDto

  /** True when a story or analysis is waiting for the designer. */
  requiresAttention?: boolean

  members?: ProjectMemberSummaryDto[]

  /** Preview image of the latest generated variant; null until one exists. */
  thumbnailUrl?: string | null
}
