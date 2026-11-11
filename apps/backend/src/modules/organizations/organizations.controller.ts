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
import { OrgAccess } from '../access/access.decorator'
import { OrgAccessContext } from '../access/access.types'
import { AuthorizeOrg } from '../access/authorize-org.decorator'
import { OrgPermission } from '../access/org-permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  AddOrganizationMemberDto,
  CreateOrganizationDto,
  OrganizationDto,
  OrganizationMemberDto,
  OrganizationQueryDto,
  OrganizationWithRoleDto,
  UpdateOrganizationDto,
  UpdateOrganizationMemberDto,
} from './dto/organization.dto'
import { OrganizationMembersService } from './organization-members.service'
import { OrganizationsService } from './organizations.service'

@ApiTags('organizations')
@AuditEntity('Organization')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly members: OrganizationMembersService,
  ) {}

  /** List the organizations the caller belongs to. */
  @Get()
  @ApiAuthenticated()
  @ApiPaginatedResponse(OrganizationWithRoleDto)
  list(
    @CurrentUser('id') userId: string,
    @Query() query: OrganizationQueryDto,
  ): Promise<Page<OrganizationWithRoleDto>> {
    return this.organizations.list(userId, query)
  }

  /**
   * Create an organization.
   *
   * @remarks Any signed-in user can; the caller becomes its ADMIN and can
   * then create projects (`POST /organizations/{organizationId}/projects`).
   */
  @Post()
  @ApiAuthenticated()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationWithRoleDto> {
    return this.organizations.create(userId, dto)
  }

  /** Get an organization and the caller's role in it. */
  @Get(':organizationId')
  @AuthorizeOrg(OrgPermission.OrgRead)
  get(
    @UuidParam('organizationId') organizationId: string,
    @OrgAccess() access: OrgAccessContext,
  ): Promise<OrganizationWithRoleDto> {
    return this.organizations.get(organizationId, access.role)
  }

  /** Rename an organization. */
  @Patch(':organizationId')
  @AuthorizeOrg(OrgPermission.OrgUpdate)
  update(
    @UuidParam('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationDto> {
    return this.organizations.update(organizationId, dto)
  }

  /**
   * Delete an organization.
   *
   * @throws {409} The organization still has projects.
   */
  @Delete(':organizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthorizeOrg(OrgPermission.OrgDelete)
  remove(@UuidParam('organizationId') organizationId: string): Promise<void> {
    return this.organizations.remove(organizationId)
  }

  /** List the organization's members. */
  @Get(':organizationId/members')
  @AuthorizeOrg(OrgPermission.OrgMemberRead)
  @ApiPaginatedResponse(OrganizationMemberDto)
  listMembers(
    @UuidParam('organizationId') organizationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<OrganizationMemberDto>> {
    return this.members.list(organizationId, query)
  }

  /**
   * Add a registered user to the organization.
   *
   * @remarks Membership only makes the person eligible for the organization's
   * projects; a project designer still has to add them to a project.
   * @throws {404} No such user (they must sign in once first).
   * @throws {409} Already a member.
   */
  @Post(':organizationId/members')
  @AuthorizeOrg(OrgPermission.OrgMemberManage)
  addMember(
    @UuidParam('organizationId') organizationId: string,
    @Body() dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    return this.members.add(organizationId, dto)
  }

  /**
   * Change a member's organization role.
   *
   * @throws {409} The last ADMIN cannot be demoted.
   */
  @Patch(':organizationId/members/:memberId')
  @AuthorizeOrg(OrgPermission.OrgMemberManage)
  changeMemberRole(
    @UuidParam('organizationId') organizationId: string,
    @UuidParam('memberId') memberId: string,
    @Body() dto: UpdateOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    return this.members.changeRole(organizationId, memberId, dto.role)
  }

  /**
   * Remove a member (or leave).
   *
   * @remarks Also removes the person from the organization's projects.
   * @throws {409} They are the last admin, or the only designer of a project.
   */
  @Delete(':organizationId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthorizeOrg(OrgPermission.OrgRead)
  removeMember(
    @UuidParam('organizationId') organizationId: string,
    @UuidParam('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @OrgAccess() access: OrgAccessContext,
  ): Promise<void> {
    return this.members.remove(organizationId, memberId, {
      userId,
      role: access.role,
    })
  }
}
