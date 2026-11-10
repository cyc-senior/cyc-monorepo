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
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Access } from '../access/access.decorator'
import { AccessContext } from '../access/access.types'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateProjectDto,
  ProjectDto,
  ProjectQueryDto,
  ProjectWithRoleDto,
  UpdateProjectDesignDto,
  UpdateProjectDto,
} from './dto/project.dto'
import { ProjectsService } from './projects.service'

@ApiTags('projects')
@AuditEntity('Project')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** List the projects the caller is a member of. */
  @Get()
  @ApiAuthenticated()
  @ApiPaginatedResponse(ProjectWithRoleDto)
  list(
    @CurrentUser('id') userId: string,
    @Query() query: ProjectQueryDto,
  ): Promise<Page<ProjectWithRoleDto>> {
    return this.projects.list(userId, query)
  }

  /**
   * Create a project with its design brief.
   *
   * @remarks Any signed-in user can. The caller becomes the project's
   * DESIGNER, its owner, and invites the team
   * (`POST /projects/{projectId}/members`). The first design round (#1) is
   * created with it.
   */
  @Post()
  @ApiAuthenticated()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectWithRoleDto> {
    return this.projects.create(userId, dto)
  }

  /** Get a project, its design brief and the caller's role. */
  @Get(':projectId')
  @Authorize(Permission.ProjectRead)
  get(
    @UuidParam('projectId') projectId: string,
    @Access() access: AccessContext,
  ): Promise<ProjectWithRoleDto> {
    return this.projects.get(projectId, access.role)
  }

  /** Rename, describe, archive or unarchive a project. */
  @Patch(':projectId')
  @Authorize(Permission.ProjectUpdate)
  update(
    @UuidParam('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.update(projectId, dto)
  }

  /**
   * Change the project's design brief (intent, UI library, persona, ...).
   *
   * @remarks Bumps `designVersion`. Generation jobs already created keep the
   * brief they were created with.
   */
  @Patch(':projectId/design')
  @Authorize(Permission.DesignWrite)
  @AuditAction('update_design')
  updateDesign(
    @UuidParam('projectId') projectId: string,
    @Body() dto: UpdateProjectDesignDto,
  ): Promise<ProjectDto> {
    return this.projects.updateDesign(projectId, dto)
  }

  /**
   * Delete a project and all of its data.
   *
   * @remarks Irreversible: removes the team, rounds, generation jobs,
   * designs and the audit log. Prefer archiving (`PATCH status=ARCHIVED`).
   */
  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.ProjectDelete)
  remove(@UuidParam('projectId') projectId: string): Promise<void> {
    return this.projects.remove(projectId)
  }
}
