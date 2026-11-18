import { Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import {
  Prisma,
  ProjectRole,
  TestSessionStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateProjectDto,
  ProjectDto,
  ProjectQueryDto,
  ProjectWithRoleDto,
  UpdateProjectDto,
} from './dto/project.dto'

/**
 * Everything the dashboard cards need, loaded in one query per page. The
 * summaries are derived from the latest round/session instead of being stored
 * so they cannot go stale when designs, participants or stories change.
 */
const SUMMARY_INCLUDE = {
  designIntent: { select: { id: true } },
  rounds: {
    orderBy: { roundNumber: 'desc' },
    include: {
      _count: { select: { variants: true } },
      variants: {
        where: { thumbnailUrl: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { thumbnailUrl: true },
      },
    },
  },
  testSessions: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      status: true,
      participants: { select: { status: true } },
    },
  },
  members: {
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: { id: true, name: true, image: true } } },
  },
  analyses: { where: { status: 'READY' }, select: { id: true } },
  userStories: { where: { status: 'DRAFT' }, select: { id: true } },
} satisfies Prisma.ProjectInclude

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof SUMMARY_INCLUDE }>
type ProjectSummary = Omit<ProjectWithRoleDto, 'role'>
type StatusBadge = NonNullable<ProjectWithRoleDto['statusBadge']>

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Projects the user is a member of, with their role in each. */
  list(
    userId: string,
    query: ProjectQueryDto,
  ): Promise<Page<ProjectWithRoleDto>> {
    const where: Prisma.ProjectMemberWhereInput = {
      userId,
      organizationId: query.organizationId,
      project: {
        status: query.status,
        name: query.search
          ? { contains: query.search, mode: 'insensitive' }
          : undefined,
      },
    }

    return paginate(
      query,
      async (page) => {
        const memberships = await this.prisma.projectMember.findMany({
          where,
          include: { project: { include: SUMMARY_INCLUDE } },
          orderBy: { project: { createdAt: 'desc' } },
          ...page,
        })

        return memberships.map(({ project, role }) => ({
          ...toSummary(project),
          role,
        }))
      },
      () => this.prisma.projectMember.count({ where }),
    )
  }

  /**
   * Creates the project inside the organization, makes the creator its
   * designer and opens the first design round. The design intent is defined
   * in the next step.
   *
   * The caller's right to open projects in the organization was checked by
   * the organization guard; `organizationId` never comes from the body.
   */
  create(
    userId: string,
    organizationId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectWithRoleDto> {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...dto,
          organizationId,
          createdById: userId,
          rounds: { create: { roundNumber: 1 } },
        },
        include: SUMMARY_INCLUDE,
      })
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          organizationId,
          userId,
          role: 'DESIGNER',
        },
      })

      return { ...toSummary(project), role: 'DESIGNER' as ProjectRole }
    })
  }

  async get(id: string, role: ProjectRole): Promise<ProjectWithRoleDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: SUMMARY_INCLUDE,
    })

    return { ...toSummary(project), role }
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectDto> {
    return toSummary(
      await this.prisma.project.update({
        where: { id },
        data: dto,
        include: SUMMARY_INCLUDE,
      }),
    )
  }

  async remove(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } })
  }
}

function toSummary({
  designIntent,
  rounds,
  testSessions,
  members,
  analyses,
  userStories,
  ...project
}: ProjectRow): ProjectSummary {
  const latestRound = rounds[0]
  const latestSession = testSessions[0]
  const participants = latestSession?.participants ?? []
  const hasDraftStories = userStories.length > 0
  const hasPendingAnalyses = analyses.length > 0

  return {
    ...project,
    hasDesignIntent: designIntent !== null,
    activeRound: roundLabel(latestRound, rounds.length),
    testerProgress: latestSession
      ? {
          current: participants.filter((p) =>
            ['JOINED', 'COMPLETED'].includes(p.status),
          ).length,
          total: participants.length,
        }
      : undefined,
    variantCount: latestRound?._count.variants ?? 0,
    statusBadge: statusBadge({
      status: project.status,
      latestSession: latestSession?.status,
      latestRoundStatus: latestRound?.status,
      hasDesignIntent: designIntent !== null,
      hasDraftStories,
      hasPendingAnalyses,
    }),
    requiresAttention:
      designIntent === null || hasDraftStories || hasPendingAnalyses,
    members: members.map(({ user }) => ({
      id: user.id,
      name: user.name,
      image: user.image,
    })),
    thumbnailUrl: latestRound?.variants[0]?.thumbnailUrl ?? null,
  }
}

function roundLabel(
  round: ProjectRow['rounds'][number] | undefined,
  total: number,
): string {
  if (!round || round.status === 'DRAFT') {
    return 'Draft'
  }

  return `Round ${round.roundNumber} of ${total}`
}

function statusBadge(input: {
  status: ProjectSummary['status']
  latestSession?: TestSessionStatus
  latestRoundStatus?: ProjectRow['rounds'][number]['status']
  hasDesignIntent: boolean
  hasDraftStories: boolean
  hasPendingAnalyses: boolean
}): StatusBadge {
  if (input.status === 'ARCHIVED' || input.latestSession === 'COMPLETED') {
    return { label: 'Completed', type: 'ready' }
  }
  if (input.latestSession === 'ACTIVE') {
    return { label: 'In testing', type: 'in-progress' }
  }
  if (input.latestRoundStatus === 'APPROVED') {
    return { label: 'Ready to test', type: 'ready' }
  }
  if (input.hasPendingAnalyses) {
    return { label: 'Feedback needs you', type: 'warning' }
  }
  if (input.hasDraftStories) {
    return { label: 'T3 needs you', type: 'warning' }
  }
  if (!input.hasDesignIntent) {
    return { label: 'Prompt & context', type: 'warning' }
  }

  return { label: 'Draft · Design intent', type: 'warning' }
}
