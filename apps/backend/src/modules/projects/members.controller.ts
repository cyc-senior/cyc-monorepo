import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import {
  ApiPaginatedResponse,
  Page,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Access } from '../access/access.decorator'
import { AccessContext } from '../access/access.types'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AddMemberDto, MemberDto, UpdateMemberRoleDto } from './dto/member.dto'
import { MembersService } from './members.service'

@ApiTags('members')
@AuditEntity('ProjectMember')
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  /** List the project's team. */
  @Get()
  @Authorize(Permission.MemberRead)
  @ApiPaginatedResponse(MemberDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<MemberDto>> {
    return this.members.list(projectId, query)
  }

  /**
   * Invite a registered user to the project with a role.
   *
   * @remarks As a DESIGNER (co-owner), PROJECT_MANAGER or PRODUCT_OWNER (both
   * read-only). The user must already have signed in once.
   * @throws {409} The user is already a member.
   */
  @Post()
  @Authorize(Permission.MemberManage)
  add(
    @UuidParam('projectId') projectId: string,
    @Body() dto: AddMemberDto,
  ): Promise<MemberDto> {
    return this.members.add(projectId, dto)
  }

  /**
   * Change a member's role.
   *
   * @remarks The last DESIGNER cannot be demoted.
   * @throws {409} Would leave the project without a designer.
   */
  @Patch(':memberId')
  @Authorize(Permission.MemberManage)
  changeRole(
    @UuidParam('projectId') projectId: string,
    @UuidParam('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberDto> {
    return this.members.changeRole(projectId, memberId, dto.role)
  }

  /**
   * Remove a member, or leave the project.
   *
   * @remarks Any member may remove their own membership. Removing someone else
   * requires `member:manage`. The last DESIGNER cannot leave.
   * @throws {409} Would leave the project without a designer.
   */
  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.MemberRead)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('memberId') memberId: string,
    @Access() access: AccessContext,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.members.remove(
      projectId,
      { userId, role: access.role },
      memberId,
    )
  }
}
