import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { lockKey } from '../../common/db-lock'
import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { OrganizationRole, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  AddOrganizationMemberDto,
  OrganizationMemberDto,
} from './dto/organization.dto'

const INCLUDE_USER = {
  user: { select: { id: true, email: true, name: true, image: true } },
} satisfies Prisma.OrganizationMemberInclude

/**
 * Organization team rules: an organization always keeps one ADMIN; removing a
 * member also removes their project memberships (a project can never contain
 * someone outside its organization) unless they are a project's last designer.
 */
@Injectable()
export class OrganizationMembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<Page<OrganizationMemberDto>> {
    const where = { organizationId }

    return paginate(
      query,
      (page) =>
        this.prisma.organizationMember.findMany({
          where,
          include: INCLUDE_USER,
          orderBy: { joinedAt: 'asc' },
          ...page,
        }),
      () => this.prisma.organizationMember.count({ where }),
    )
  }

  /** Adds an already-registered user (looked up by email). */
  async add(
    organizationId: string,
    dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    })
    if (!user) {
      throw new NotFoundException(
        'No user can be added with that email. They need to sign in once first.',
      )
    }

    return this.prisma.organizationMember.create({
      data: { organizationId, userId: user.id, role: dto.role },
      include: INCLUDE_USER,
    })
  }

  changeRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMemberDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `org-admins:${organizationId}`)
      const target = await this.find(tx, organizationId, memberId)
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        await this.assertAnotherAdmin(tx, organizationId, target.id)
      }

      return tx.organizationMember.update({
        where: { id: target.id },
        data: { role },
        include: INCLUDE_USER,
      })
    })
  }

  /** Removes a member (anyone may remove themselves, admins may remove anyone). */
  async remove(
    organizationId: string,
    memberId: string,
    actor: { userId: string; role: OrganizationRole },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `org-admins:${organizationId}`)
      const target = await this.find(tx, organizationId, memberId)
      if (target.userId !== actor.userId && actor.role !== 'ADMIN') {
        throw new NotFoundException('Member not found.')
      }
      if (target.role === 'ADMIN') {
        await this.assertAnotherAdmin(tx, organizationId, target.id)
      }
      await this.detachFromProjects(tx, organizationId, target.userId)
      await tx.organizationMember.delete({ where: { id: target.id } })
    })
  }

  /** Drops the user's project memberships in the organization. */
  private async detachFromProjects(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const memberships = await tx.projectMember.findMany({
      where: { organizationId, userId },
      select: { id: true, projectId: true, role: true },
      orderBy: { projectId: 'asc' },
    })
    for (const membership of memberships) {
      // Same lock as the project team rules, taken in a stable order.
      await lockKey(tx, `project-designers:${membership.projectId}`)
      if (membership.role === 'DESIGNER') {
        const others = await tx.projectMember.count({
          where: {
            projectId: membership.projectId,
            role: 'DESIGNER',
            id: { not: membership.id },
          },
        })
        if (others === 0) {
          throw new ConflictException(
            'This person is the only designer of a project; add another designer first.',
          )
        }
      }
    }
    await tx.projectMember.deleteMany({ where: { organizationId, userId } })
  }

  private async find(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ) {
    const member = await tx.organizationMember.findFirst({
      where: { id, organizationId },
    })
    if (!member) {
      throw new NotFoundException('Member not found.')
    }

    return member
  }

  private async assertAnotherAdmin(
    tx: Prisma.TransactionClient,
    organizationId: string,
    excludingMemberId: string,
  ) {
    const others = await tx.organizationMember.count({
      where: {
        organizationId,
        role: 'ADMIN',
        id: { not: excludingMemberId },
      },
    })
    if (others === 0) {
      throw new ConflictException(
        'An organization must keep at least one admin.',
      )
    }
  }
}
