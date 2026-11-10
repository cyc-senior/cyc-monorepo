import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import {
  JsonInput,
  JsonOutput,
} from '../../../common/decorators/json-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  Prisma,
  ProjectRole,
  ProjectStatus,
  UiLibrary,
} from '../../../generated/prisma/client'

/** The design brief every generation in the project is grounded in. */
export class ProjectDesignDto {
  /**
   * What the design must achieve, and for whom.
   * @example 'Let returning customers check out in under a minute on mobile.'
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  designIntent: string

  /** Component library the generated UI is built with. */
  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  @IsEnum(UiLibrary)
  uiLibrary: UiLibrary

  @JsonInput('Who the design is for.')
  targetPersona?: Record<string, any>

  @JsonInput()
  designGuidelines?: Record<string, any>

  @JsonInput()
  brandIdentity?: Record<string, any>

  @JsonInput()
  toneOfVoice?: Record<string, any>

  @JsonInput(
    'Colors, spacing, typography, ... applied on top of the UI library.',
  )
  designTokens?: Record<string, any>
}

/** Change the brief. Bumps `designVersion`. */
export class UpdateProjectDesignDto extends PartialType(ProjectDesignDto) {}

export class ProjectDetailsDto {
  /** @example 'Checkout redesign' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null
}

export class CreateProjectDto extends IntersectionType(
  ProjectDetailsDto,
  ProjectDesignDto,
) {}

/** Name, description and archiving. The brief has its own endpoint. */
export class UpdateProjectDto extends PartialType(ProjectDetailsDto) {
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
}

export class ProjectDto extends PickType(ProjectDesignDto, [
  'designIntent',
  'uiLibrary',
] as const) {
  @ApiProperty({ format: 'uuid' })
  id: string

  name: string

  description: string | null

  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  status: ProjectStatus

  @JsonOutput()
  targetPersona: Prisma.JsonValue

  @JsonOutput()
  designGuidelines: Prisma.JsonValue

  @JsonOutput()
  brandIdentity: Prisma.JsonValue

  @JsonOutput()
  toneOfVoice: Prisma.JsonValue

  @JsonOutput()
  designTokens: Prisma.JsonValue

  /** Starts at 1; incremented whenever the design brief changes. */
  designVersion: number

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
