import { Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma, ProjectRole, ReportType } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  GenerateReportDto,
  ReportDto,
  ReportQueryDto,
} from './dto/stakeholder.dto'
import { ProjectInsightsService } from './project-insights.service'

const TITLES: Record<ReportType, string> = {
  DESIGNER: 'Design evolution report',
  CLIENT: 'Client report',
  DEVELOPER: 'Developer report',
  PROJECT_MANAGER: 'Project status report',
}

/**
 * Which report audiences a project role may read. Designers read all of them
 * (they write them); every stakeholder reads only the one written for them,
 * whatever id they ask for.
 */
export function readableReports(role: ProjectRole): ReportType[] {
  switch (role) {
    case 'DESIGNER':
      return ['DESIGNER', 'CLIENT', 'DEVELOPER', 'PROJECT_MANAGER']
    case 'CLIENT':
      return ['CLIENT']
    case 'DEVELOPER':
      return ['DEVELOPER']
    default:
      return ['PROJECT_MANAGER']
  }
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: ProjectInsightsService,
  ) {}

  /** Writes a snapshot report for an audience (designers only; see the controller). */
  async generate(
    projectId: string,
    userId: string,
    dto: GenerateReportDto,
  ): Promise<ReportDto> {
    if (dto.roundId) {
      await this.prisma.designRound.findFirstOrThrow({
        where: { id: dto.roundId, projectId },
        select: { id: true },
      })
    }
    const content = await this.insights.build(projectId, dto.type, dto.roundId)

    return this.prisma.report.create({
      data: {
        projectId,
        roundId: dto.roundId,
        type: dto.type,
        title: TITLES[dto.type],
        content: content as Prisma.InputJsonObject,
        generatedById: userId,
      },
    })
  }

  list(
    projectId: string,
    role: ProjectRole,
    query: ReportQueryDto,
  ): Promise<Page<ReportDto>> {
    const allowed = readableReports(role)
    const where: Prisma.ReportWhereInput = {
      projectId,
      type: query.type
        ? { in: allowed.filter((type) => type === query.type) }
        : { in: allowed },
    }

    return paginate(
      query,
      (page) =>
        this.prisma.report.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.report.count({ where }),
    )
  }

  /** A report the role may read, or 404 (another audience's report does not "exist"). */
  get(projectId: string, role: ProjectRole, id: string): Promise<ReportDto> {
    return this.prisma.report.findFirstOrThrow({
      where: { id, projectId, type: { in: readableReports(role) } },
    })
  }
}
