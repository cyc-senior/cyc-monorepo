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
import { WorkspaceAccess } from '../access/access.decorator'
import { WorkspaceAccessContext } from '../access/access.types'
import { AuthorizeWorkspace } from '../access/authorize-workspace.decorator'
import { WorkspacePermission } from '../access/workspace-permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'
import {
  AddWorkspaceMemberDto,
  CreateWorkspaceDto,
  WorkspaceDto,
  WorkspaceMemberDto,
  WorkspacePictureDto,
  WorkspaceQueryDto,
  PendingInvitationDto,
  WorkspaceWithRoleDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceMemberDto,
} from './dto/workspace.dto'
import { WORKSPACE_AVATAR_MAX_BYTES, UploadedAvatar } from './workspace-avatar'
import { WorkspaceInvitationsService } from './workspace-invitations.service'
import { WorkspaceMembersService } from './workspace-members.service'
import { WorkspacesService } from './workspaces.service'

const MINUTE = 60_000

@ApiTags('workspaces')
@AuditEntity('Workspace')
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly members: WorkspaceMembersService,
    private readonly invitations: WorkspaceInvitationsService,
  ) {}

  /** List the workspaces the caller belongs to. */
  @Get()
  @ApiAuthenticated()
  @ApiPaginatedResponse(WorkspaceWithRoleDto)
  list(
    @CurrentUser('id') userId: string,
    @Query() query: WorkspaceQueryDto,
  ): Promise<Page<WorkspaceWithRoleDto>> {
    return this.workspaces.list(userId, query)
  }

  /**
   * Create a workspace.
   *
   * @remarks Any signed-in user can; the caller becomes its ADMIN and can
   * then create projects (`POST /workspaces/{workspaceId}/projects`).
   */
  @Post()
  @ApiAuthenticated()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceWithRoleDto> {
    return this.workspaces.create(userId, dto)
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

  /** Accept an invitation to a workspace (email must match). */
  @Post('invitations/:invitationId/accept')
  @ApiAuthenticated()
  acceptInvitation(
    @UuidParam('invitationId') invitationId: string,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<WorkspaceMemberDto> {
    return this.invitations.accept(invitationId, current)
  }

  /** Pending invitations of a workspace (admins and members can see them). */
  @Get(':workspaceId/invitations')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceMemberRead)
  @ApiPaginatedResponse(PendingInvitationDto)
  listInvitations(
    @UuidParam('workspaceId') workspaceId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<PendingInvitationDto>> {
    return this.invitations.list(workspaceId, query)
  }

  /** Cancel a pending invitation. */
  @Delete(':workspaceId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceMemberManage)
  cancelInvitation(
    @UuidParam('workspaceId') workspaceId: string,
    @UuidParam('invitationId') invitationId: string,
  ): Promise<void> {
    return this.invitations.cancel(workspaceId, invitationId)
  }

  /**
   * The workspace picture. Public so that `<img src>` works; the `key` from
   * `avatarUrl` is unguessable and rotates whenever the picture is replaced.
   */
  @Public()
  @Get(':workspaceId/picture')
  @RateLimit({ limit: 120, windowMs: MINUTE })
  async picture(
    @UuidParam('workspaceId') workspaceId: string,
    @Query('key') key: string,
    @Res() response: Response,
  ): Promise<void> {
    const avatar = await this.workspaces.picture(workspaceId, key ?? '')
    if (!avatar) {
      throw new NotFoundException('Workspace picture not found.')
    }
    response.type(avatar.contentType).send(Buffer.from(avatar.data))
  }

  /**
   * Upload (or replace) the workspace picture as multipart/form-data with a
   * `file` field. PNG and JPG, at most 1 MiB.
   */
  @Post(':workspaceId/picture')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceUpdate)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: WORKSPACE_AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  uploadPicture(
    @UuidParam('workspaceId') workspaceId: string,
    @UploadedFile() file: UploadedAvatar,
  ): Promise<WorkspacePictureDto> {
    return this.workspaces
      .uploadPicture(workspaceId, file)
      .then((avatarUrl) => ({ avatarUrl }))
  }

  /** Get a workspace and the caller's role in it. */
  @Get(':workspaceId')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceRead)
  get(
    @UuidParam('workspaceId') workspaceId: string,
    @WorkspaceAccess() access: WorkspaceAccessContext,
  ): Promise<WorkspaceWithRoleDto> {
    return this.workspaces.get(workspaceId, access.role)
  }

  /** Rename a workspace. */
  @Patch(':workspaceId')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceUpdate)
  update(
    @UuidParam('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    return this.workspaces.update(workspaceId, dto)
  }

  /**
   * Delete a workspace.
   *
   * @throws {409} The workspace still has projects.
   */
  @Delete(':workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceDelete)
  remove(@UuidParam('workspaceId') workspaceId: string): Promise<void> {
    return this.workspaces.remove(workspaceId)
  }

  /** List the workspace's members. */
  @Get(':workspaceId/members')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceMemberRead)
  @ApiPaginatedResponse(WorkspaceMemberDto)
  listMembers(
    @UuidParam('workspaceId') workspaceId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<WorkspaceMemberDto>> {
    return this.members.list(workspaceId, query)
  }

  /**
   * Invite someone by email. A registered user becomes a member immediately;
   * an unregistered email gets a pending invitation they can accept after
   * signing in (no email is sent).
   *
   * @remarks Membership only makes the person eligible for the workspace's
   * projects; a project designer still has to add them to a project.
   * @throws {409} Already a member or already invited.
   */
  @Post(':workspaceId/members')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceMemberManage)
  addMember(
    @UuidParam('workspaceId') workspaceId: string,
    @Body() dto: AddWorkspaceMemberDto,
    @CurrentUser('id') userId: string,
  ): Promise<WorkspaceMemberDto | PendingInvitationDto> {
    return this.members.add(workspaceId, dto, userId)
  }

  /**
   * Change a member's workspace role.
   *
   * @throws {409} The last ADMIN cannot be demoted.
   */
  @Patch(':workspaceId/members/:memberId')
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceMemberManage)
  changeMemberRole(
    @UuidParam('workspaceId') workspaceId: string,
    @UuidParam('memberId') memberId: string,
    @Body() dto: UpdateWorkspaceMemberDto,
  ): Promise<WorkspaceMemberDto> {
    return this.members.changeRole(workspaceId, memberId, dto.role)
  }

  /**
   * Remove a member (or leave).
   *
   * @remarks Also removes the person from the workspace's projects.
   * @throws {409} They are the last admin, or the only designer of a project.
   */
  @Delete(':workspaceId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthorizeWorkspace(WorkspacePermission.WorkspaceRead)
  removeMember(
    @UuidParam('workspaceId') workspaceId: string,
    @UuidParam('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceAccess() access: WorkspaceAccessContext,
  ): Promise<void> {
    return this.members.remove(workspaceId, memberId, {
      userId,
      role: access.role,
    })
  }
}
