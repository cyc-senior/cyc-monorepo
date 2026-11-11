import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { AuthorizeOrg } from '../access/authorize-org.decorator'
import { OrgPermission } from '../access/org-permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateProjectDto,
  ProjectQueryDto,
  ProjectWithRoleDto,
} from './dto/project.dto'
import { ProjectsService } from './projects.service'

/** Projects are opened inside an organization; this is the only way to create one. */
@ApiTags('projects')
@AuditEntity('Project')
@Controller('organizations/:organizationId/projects')
export class OrganizationProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /**
   * List the caller's projects in the organization.
   *
   * @remarks Organization membership is not project access: only projects the
   * caller is a member of are listed.
   */
  @Get()
  @AuthorizeOrg(OrgPermission.OrgRead)
  @ApiPaginatedResponse(ProjectWithRoleDto)
  list(
    @UuidParam('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Query() query: ProjectQueryDto,
  ): Promise<Page<ProjectWithRoleDto>> {
    return this.projects.list(userId, { ...query, organizationId })
  }

  /**
   * Create a project.
   *
   * @remarks Requires the organization role ADMIN. Takes the project name,
   * the client or product, a description and the platforms to design and test
   * for. The caller becomes the project's DESIGNER. Next step: define the
   * design intent (`PUT /projects/{projectId}/design-intent`) and its user
   * personas (`POST /projects/{projectId}/personas`). The first design round
   * (#1) is created with the project.
   */
  @Post()
  @AuthorizeOrg(OrgPermission.OrgProjectCreate)
  create(
    @UuidParam('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectWithRoleDto> {
    return this.projects.create(userId, organizationId, dto)
  }
}
