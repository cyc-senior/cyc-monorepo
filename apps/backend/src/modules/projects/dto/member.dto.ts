import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsEnum } from 'class-validator'

import { ProjectRole } from '../../../generated/prisma/client'

export class AddMemberDto {
  /** Email of a user who has already signed in once. */
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email: string

  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole' })
  @IsEnum(ProjectRole)
  role: ProjectRole
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole' })
  @IsEnum(ProjectRole)
  role: ProjectRole
}

export class MemberUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'email' })
  email: string

  name: string | null

  image: string | null
}

export class MemberDto {
  /** Member id. */
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  @ApiProperty({ format: 'uuid' })
  userId: string

  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole' })
  role: ProjectRole

  joinedAt: Date

  user: MemberUserDto
}
