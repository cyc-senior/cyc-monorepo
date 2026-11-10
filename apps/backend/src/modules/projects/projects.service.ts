import { Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma, ProjectRole } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateProjectDto,
  ProjectDto,
  ProjectQueryDto,
  ProjectWithRoleDto,
  UpdateProjectDesignDto,
  UpdateProjectDto,
} from './dto/project.dto'

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
          include: { project: true },
          orderBy: { project: { createdAt: 'desc' } },
          ...page,
        })

        return memberships.map(({ project, role }) => ({ ...project, role }))
      },
      () => this.prisma.projectMember.count({ where }),
    )
  }

  /**
   * Creates the project with its design brief, makes the creator its
   * designer (owner) and opens the first design round.
   */
  async create(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectWithRoleDto> {
    const project = await this.prisma.project.create({
      data: {
        ...dto,
        createdById: userId,
        members: { create: { userId, role: 'DESIGNER' } },
        rounds: { create: { roundNumber: 1 } },
      },
    })

    return { ...project, role: 'DESIGNER' }
  }

  async get(id: string, role: ProjectRole): Promise<ProjectWithRoleDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
    })

    return { ...project, role }
  }

  update(id: string, dto: UpdateProjectDto): Promise<ProjectDto> {
    return this.prisma.project.update({ where: { id }, data: dto })
  }

  /** Changes the design brief and bumps `designVersion`. */
  updateDesign(id: string, dto: UpdateProjectDesignDto): Promise<ProjectDto> {
    return this.prisma.project.update({
      where: { id },
      data: { ...dto, designVersion: { increment: 1 } },
    })
  }

  async remove(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } })
  }
}
