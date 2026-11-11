import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Access } from '../access/access.decorator'
import { AccessContext } from '../access/access.types'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  ProjectDto,
  ProjectQueryDto,
  ProjectWithRoleDto,
  UpdateProjectDto,
} from './dto/project.dto'
import { ProjectsService } from './projects.service'

@ApiTags('projects')
@AuditEntity('Project')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /**
   * List the projects the caller is a member of.
   *
   * @remarks Projects are created inside an organization:
   * `POST /organizations/{organizationId}/projects`.
   */
  @Get()
  @ApiAuthenticated()
  @ApiPaginatedResponse(ProjectWithRoleDto)
  list(
    @CurrentUser('id') userId: string,
    @Query() query: ProjectQueryDto,
  ): Promise<Page<ProjectWithRoleDto>> {
    return this.projects.list(userId, query)
  }

  /** Get a project and the caller's role. */
  @Get(':projectId')
  @Authorize(Permission.ProjectRead)
  get(
    @UuidParam('projectId') projectId: string,
    @Access() access: AccessContext,
  ): Promise<ProjectWithRoleDto> {
    return this.projects.get(projectId, access.role)
  }

  /** Update a project's details or platforms, archive or unarchive it. */
  @Patch(':projectId')
  @Authorize(Permission.ProjectUpdate)
  update(
    @UuidParam('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.update(projectId, dto)
  }

  /**
   * Delete a project and all of its data.
   *
   * @remarks Irreversible: removes the team, design intent, personas, rounds,
   * generation jobs, designs and the audit log. Prefer archiving (`PATCH status=ARCHIVED`).
   */
  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.ProjectDelete)
  remove(@UuidParam('projectId') projectId: string): Promise<void> {
    return this.projects.remove(projectId)
  }
}
