import { ConflictException, Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { OrganizationRole } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateOrganizationDto,
  OrganizationDto,
  OrganizationQueryDto,
  OrganizationWithRoleDto,
  UpdateOrganizationDto,
} from './dto/organization.dto'

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Organizations the user belongs to, with their role in each. */
  list(
    userId: string,
    query: OrganizationQueryDto,
  ): Promise<Page<OrganizationWithRoleDto>> {
    const where = { userId }

    return paginate(
      query,
      async (page) => {
        const memberships = await this.prisma.organizationMember.findMany({
          where,
          include: { organization: true },
          orderBy: { organization: { createdAt: 'desc' } },
          ...page,
        })

        return memberships.map(({ organization, role }) => ({
          ...organization,
          role,
        }))
      },
      () => this.prisma.organizationMember.count({ where }),
    )
  }

  /** Creates an organization; the creator becomes its ADMIN. */
  create(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationWithRoleDto> {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.name, createdById: userId },
      })
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId, role: 'ADMIN' },
      })

      return { ...organization, role: 'ADMIN' as OrganizationRole }
    })
  }

  async get(
    id: string,
    role: OrganizationRole,
  ): Promise<OrganizationWithRoleDto> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id },
    })

    return { ...organization, role }
  }

  update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    return this.prisma.organization.update({ where: { id }, data: dto })
  }

  /**
   * Deletes an organization that has no projects.
   *
   * @throws ConflictException while it still owns projects (their data must
   *   not disappear as a side effect).
   */
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const projects = await tx.project.count({
        where: { organizationId: id },
      })
      if (projects > 0) {
        throw new ConflictException(
          'Delete or move the organization’s projects first.',
        )
      }
      await tx.organization.delete({ where: { id } })
    })
  }
}
