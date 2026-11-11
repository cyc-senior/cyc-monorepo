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

  /** Platforms to design and test for (at least one). */
  @ApiProperty({
    enum: Platform,
    enumName: 'Platform',
    isArray: true,
    example: ['DESKTOP', 'MOBILE'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(Platform, { each: true })
  platforms: Platform[]
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

export class ProjectWithRoleDto extends ProjectDto {
  /** The caller's role in this project. */
  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole' })
  role: ProjectRole
}
