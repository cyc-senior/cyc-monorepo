import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Access } from '../access/access.decorator'
import { AccessContext } from '../access/access.types'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  GenerateReportDto,
  ReportDto,
  ReportQueryDto,
} from './dto/stakeholder.dto'
import { ReportsService } from './reports.service'

@ApiTags('reports')
@AuditEntity('Report')
@Controller('projects/:projectId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * List the reports the caller may read.
   *
   * @remarks Each role sees only the audience written for it: CLIENT →
   * client reports, DEVELOPER → developer reports, PROJECT_MANAGER /
   * PRODUCT_OWNER → project-manager reports. Designers see all.
   */
  @Get()
  @Authorize(Permission.ReportRead)
  @ApiPaginatedResponse(ReportDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Access() access: AccessContext,
    @Query() query: ReportQueryDto,
  ): Promise<Page<ReportDto>> {
    return this.reports.list(projectId, access.role, query)
  }

  /**
   * Generate a report for an audience (designers).
   *
   * @remarks A snapshot of the project (or one round) written for CLIENT,
   * DEVELOPER, PROJECT_MANAGER or DESIGNER readers. It is built from
   * aggregates and designer-reviewed text; participant identities, raw
   * feedback and consent records are never included.
   */
  @Post()
  @Authorize(Permission.ReportGenerate)
  generate(
    @UuidParam('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateReportDto,
  ): Promise<ReportDto> {
    return this.reports.generate(projectId, userId, dto)
  }

  /**
   * Get a report.
   *
   * @throws {404} Not found, or written for another audience.
   */
  @Get(':reportId')
  @Authorize(Permission.ReportRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('reportId') reportId: string,
    @Access() access: AccessContext,
  ): Promise<ReportDto> {
    return this.reports.get(projectId, access.role, reportId)
  }
}
