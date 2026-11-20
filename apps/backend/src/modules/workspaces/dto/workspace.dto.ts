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
import { WorkspaceRole } from '../../../generated/prisma/client'

export class CreateWorkspaceDto {
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

export class UpdateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string
}

export class WorkspaceDto {
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

/** Response of `POST /workspaces/:workspaceId/picture`. */
export class WorkspacePictureDto {
  avatarUrl: string
}

export class WorkspaceWithRoleDto extends WorkspaceDto {
  /** The caller's role in this workspace. */
  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role: WorkspaceRole
}

export class AddWorkspaceMemberDto {
  /** Email of a user who has already signed in once. */
  @EmailField()
  email: string

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole
}

export class UpdateWorkspaceMemberDto {
  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole
}

export class WorkspaceMemberUserDto {
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
  workspaceId: string

  @ApiProperty({ format: 'email' })
  email: string

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role: WorkspaceRole

  @ApiProperty({ format: 'uuid' })
  invitedById: string | null

  createdAt: Date

  expiresAt: Date | null
}

export class WorkspaceMemberDto {
  /** Membership id. */
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  workspaceId: string

  @ApiProperty({ format: 'uuid' })
  userId: string

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role: WorkspaceRole

  joinedAt: Date

  user: WorkspaceMemberUserDto
}

export class WorkspaceQueryDto extends PaginationQueryDto {}
