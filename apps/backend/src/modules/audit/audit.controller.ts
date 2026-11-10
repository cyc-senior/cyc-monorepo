import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { NoCache } from '../../cache/no-cache.decorator'

import {
  ApiPaginatedResponse,
  Page,
  paginate,
} from '../../common/dto/pagination.dto'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { Prisma } from '../../generated/prisma/client'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditLogDto, AuditLogQueryDto } from './dto/audit-log.dto'
import { AuditService } from './audit.service'

@ApiTags('audit')
// Every write in the project lands here; always read it fresh.
@NoCache()
@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** List audit entries of a project (newest first). */
  @Get('projects/:projectId/audit-logs')
  @Authorize(Permission.AuditRead)
  @ApiPaginatedResponse(AuditLogDto)
  listForProject(
    @UuidParam('projectId') projectId: string,
    @Query() query: AuditLogQueryDto,
  ): Promise<Page<AuditLogDto>> {
    return this.page({ projectId }, query)
  }

  private page(
    scope: Prisma.AuditLogWhereInput,
    query: AuditLogQueryDto,
  ): Promise<Page<AuditLogDto>> {
    const { entityType, entityId, actorId, action, from, to } = query
    const where: Prisma.AuditLogWhereInput = {
      ...scope,
      entityType,
      entityId,
      actorId,
      action,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    }

    return paginate(
      query,
      (page) => this.audit.list(where, page),
      () => this.audit.count(where),
    ) as Promise<Page<AuditLogDto>>
  }
}
