import { Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma, ProjectRole } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateProjectDto,
  ProjectDto,
  ProjectQueryDto,
  ProjectWithRoleDto,
  UpdateProjectDto,
} from './dto/project.dto'

const WITH_INTENT = {
  designIntent: { select: { id: true } },
} satisfies Prisma.ProjectInclude

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof WITH_INTENT }>

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
          include: { project: { include: WITH_INTENT } },
          orderBy: { project: { createdAt: 'desc' } },
          ...page,
        })

        return memberships.map(({ project, role }) => ({
          ...toDto(project),
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
        include: WITH_INTENT,
      })
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          organizationId,
          userId,
          role: 'DESIGNER',
        },
      })

      return { ...toDto(project), role: 'DESIGNER' as ProjectRole }
    })
  }

  async get(id: string, role: ProjectRole): Promise<ProjectWithRoleDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: WITH_INTENT,
    })

    return { ...toDto(project), role }
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectDto> {
    return toDto(
      await this.prisma.project.update({
        where: { id },
        data: dto,
        include: WITH_INTENT,
      }),
    )
  }

  async remove(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } })
  }
}

function toDto({ designIntent, ...project }: ProjectRow): ProjectDto {
  return { ...project, hasDesignIntent: designIntent !== null }
}
