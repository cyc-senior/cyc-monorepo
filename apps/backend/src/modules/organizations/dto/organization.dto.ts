import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import { EmailField } from '../../../common/decorators/email-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { OrganizationRole } from '../../../generated/prisma/client'

export class CreateOrganizationDto {
  /** @example 'Acme Design Studio' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string

  /**
   * Optional workspace picture as a PNG/JPEG data URL. The bytes are stored
   * in Postgres; the response's `avatarUrl` is the URL to fetch them.
   */
  @ApiPropertyOptional({ example: 'data:image/png;base64,iVBORw0KGgo...' })
  @IsOptional()
  @IsString()
  @MaxLength(1_500_000)
  avatarUrl?: string
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

  /**
   * URL of the workspace picture, or null. Usable directly in an `<img>`:
   * the picture endpoint is public but guarded by an unguessable key.
   */
  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null

  @ApiProperty({ format: 'uuid' })
  createdById: string | null

  createdAt: Date

  updatedAt: Date
}

/** Response of `POST /organizations/:organizationId/picture`. */
export class OrganizationPictureDto {
  avatarUrl: string
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

/** An invitation waiting for an email that has no account yet. */
export class PendingInvitationDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  organizationId: string

  @ApiProperty({ format: 'email' })
  email: string

  @ApiProperty({ enum: OrganizationRole, enumName: 'OrganizationRole' })
  role: OrganizationRole

  @ApiProperty({ format: 'uuid' })
  invitedById: string | null

  createdAt: Date

  expiresAt: Date | null
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
