import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { EmailField } from '../../../common/decorators/email-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { OrganizationRole } from '../../../generated/prisma/client'

export class CreateOrganizationDto {
  /** @example 'Acme Design Studio' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string
}

export class UpdateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string
}

export class OrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  name: string

  @ApiProperty({ format: 'uuid' })
  createdById: string | null

  createdAt: Date

  updatedAt: Date
}

export class OrganizationWithRoleDto extends OrganizationDto {
  /** The caller's role in this organization. */
  @ApiProperty({ enum: OrganizationRole, enumName: 'OrganizationRole' })
  role: OrganizationRole
}

export class AddOrganizationMemberDto {
  /** Email of a user who has already signed in once. */
  @EmailField()
  email: string

  @ApiProperty({ enum: OrganizationRole, enumName: 'OrganizationRole' })
  @IsEnum(OrganizationRole)
  role: OrganizationRole
}

export class UpdateOrganizationMemberDto {
  @ApiProperty({ enum: OrganizationRole, enumName: 'OrganizationRole' })
  @IsEnum(OrganizationRole)
  role: OrganizationRole
}

export class OrganizationMemberUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'email' })
  email: string

  name: string | null

  image: string | null
}

export class OrganizationMemberDto {
  /** Membership id. */
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  organizationId: string

  @ApiProperty({ format: 'uuid' })
  userId: string

  @ApiProperty({ enum: OrganizationRole, enumName: 'OrganizationRole' })
  role: OrganizationRole

  joinedAt: Date

  user: OrganizationMemberUserDto
}

export class OrganizationQueryDto extends PaginationQueryDto {}
