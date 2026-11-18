import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags } from '@nestjs/swagger'
import { Response } from 'express'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import {
  ApiPaginatedResponse,
  Page,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { OrgAccess } from '../access/access.decorator'
import { OrgAccessContext } from '../access/access.types'
import { AuthorizeOrg } from '../access/authorize-org.decorator'
import { OrgPermission } from '../access/org-permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'
import {
  AddOrganizationMemberDto,
  CreateOrganizationDto,
  OrganizationDto,
  OrganizationMemberDto,
  OrganizationPictureDto,
  OrganizationQueryDto,
  PendingInvitationDto,
  OrganizationWithRoleDto,
  UpdateOrganizationDto,
  UpdateOrganizationMemberDto,
} from './dto/organization.dto'
import { ORG_AVATAR_MAX_BYTES, UploadedAvatar } from './organization-avatar'
import { OrganizationInvitationsService } from './organization-invitations.service'
import { OrganizationMembersService } from './organization-members.service'
import { OrganizationsService } from './organizations.service'

const MINUTE = 60_000

@ApiTags('organizations')
@AuditEntity('Organization')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly members: OrganizationMembersService,
    private readonly invitations: OrganizationInvitationsService,
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

  /** Invitations addressed to the signed-in user's email. */
  @Get('invitations/me')
  @ApiAuthenticated()
  @ApiPaginatedResponse(PendingInvitationDto)
  myInvitations(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<PendingInvitationDto>> {
    return this.invitations.listForEmail(current.email, query)
  }

  /** Accept an invitation to an organization (email must match). */
  @Post('invitations/:invitationId/accept')
  @ApiAuthenticated()
  acceptInvitation(
    @UuidParam('invitationId') invitationId: string,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<OrganizationMemberDto> {
    return this.invitations.accept(invitationId, current)
  }

  /** Pending invitations of an organization (admins and members can see them). */
  @Get(':organizationId/invitations')
  @AuthorizeOrg(OrgPermission.OrgMemberRead)
  @ApiPaginatedResponse(PendingInvitationDto)
  listInvitations(
    @UuidParam('organizationId') organizationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<PendingInvitationDto>> {
    return this.invitations.list(organizationId, query)
  }

  /** Cancel a pending invitation. */
  @Delete(':organizationId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthorizeOrg(OrgPermission.OrgMemberManage)
  cancelInvitation(
    @UuidParam('organizationId') organizationId: string,
    @UuidParam('invitationId') invitationId: string,
  ): Promise<void> {
    return this.invitations.cancel(organizationId, invitationId)
  }

  /**
   * The workspace picture. Public so that `<img src>` works; the `key` from
   * `avatarUrl` is unguessable and rotates whenever the picture is replaced.
   */
  @Public()
  @Get(':organizationId/picture')
  @RateLimit({ limit: 120, windowMs: MINUTE })
  async picture(
    @UuidParam('organizationId') organizationId: string,
    @Query('key') key: string,
    @Res() response: Response,
  ): Promise<void> {
    const avatar = await this.organizations.picture(organizationId, key ?? '')
    if (!avatar) {
      throw new NotFoundException('Workspace picture not found.')
    }
    response.type(avatar.contentType).send(Buffer.from(avatar.data))
  }

  /**
   * Upload (or replace) the workspace picture as multipart/form-data with a
   * `file` field. PNG and JPG, at most 1 MiB.
   */
  @Post(':organizationId/picture')
  @AuthorizeOrg(OrgPermission.OrgUpdate)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ORG_AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  uploadPicture(
    @UuidParam('organizationId') organizationId: string,
    @UploadedFile() file: UploadedAvatar,
  ): Promise<OrganizationPictureDto> {
    return this.organizations
      .uploadPicture(organizationId, file)
      .then((avatarUrl) => ({ avatarUrl }))
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
   * Invite someone by email. A registered user becomes a member immediately;
   * an unregistered email gets a pending invitation they can accept after
   * signing in (no email is sent).
   *
   * @remarks Membership only makes the person eligible for the organization's
   * projects; a project designer still has to add them to a project.
   * @throws {409} Already a member or already invited.
   */
  @Post(':organizationId/members')
  @AuthorizeOrg(OrgPermission.OrgMemberManage)
  addMember(
    @UuidParam('organizationId') organizationId: string,
    @Body() dto: AddOrganizationMemberDto,
    @CurrentUser('id') userId: string,
  ): Promise<OrganizationMemberDto | PendingInvitationDto> {
    return this.members.add(organizationId, dto, userId)
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
