import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { lockKey } from '../../common/db-lock'
import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Prisma, ProjectRole } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { can, Permission } from '../access/permissions'
import { AddMemberDto, MemberDto } from './dto/member.dto'

const MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, name: true, image: true } },
} satisfies Prisma.ProjectMemberInclude

export interface Actor {
  userId: string
  role: ProjectRole
}

/**
 * Team rules, on top of the `member:manage` permission (designers):
 * - a project always keeps at least one DESIGNER, its owner (enforced under a
 *   lock so two designers cannot demote or remove each other concurrently);
 * - anyone may leave a project (subject to the previous rule).
 */
@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string, query: PaginationQueryDto): Promise<Page<MemberDto>> {
    const where = { projectId }

    return paginate(
      query,
      (page) =>
        this.prisma.projectMember.findMany({
          where,
          include: MEMBER_INCLUDE,
          orderBy: { joinedAt: 'asc' },
          ...page,
        }),
      () => this.prisma.projectMember.count({ where }),
    )
  }

  /**
   * Adds a member of the project's organization (looked up by email). Anyone
   * else — unknown, or merely registered elsewhere — gets the same answer, so
   * this cannot be used to find out who has an account. The composite foreign
   * keys on `project_members` back this up in the database.
   */
  async add(
    projectId: string,
    organizationId: string,
    dto: AddMemberDto,
  ): Promise<MemberDto> {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: { equals: dto.email, mode: 'insensitive' } },
      },
      select: { userId: true },
    })
    if (!member) {
      throw new NotFoundException(
        'That person is not a member of this project’s organization. Ask an organization owner to add them first.',
      )
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        organizationId,
        userId: member.userId,
        role: dto.role,
      },
      include: MEMBER_INCLUDE,
    })
  }

  async changeRole(
    projectId: string,
    memberId: string,
    role: ProjectRole,
  ): Promise<MemberDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `project-designers:${projectId}`)
      const target = await this.findInProject(tx, projectId, memberId)
      if (target.role === 'DESIGNER' && role !== 'DESIGNER') {
        await this.assertAnotherDesigner(tx, projectId, target.id)
      }

      return tx.projectMember.update({
        where: { id: target.id },
        data: { role },
        include: MEMBER_INCLUDE,
      })
    })
  }

  /** Removes a member; any member may remove themselves. */
  async remove(
    projectId: string,
    actor: Actor,
    memberId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `project-designers:${projectId}`)
      const target = await this.findInProject(tx, projectId, memberId)
      if (
        target.userId !== actor.userId &&
        !can(actor.role, Permission.MemberManage)
      ) {
        throw new ForbiddenException(
          'Your role in this project does not allow this action.',
        )
      }
      if (target.role === 'DESIGNER') {
        await this.assertAnotherDesigner(tx, projectId, target.id)
      }

      await tx.projectMember.delete({ where: { id: target.id } })
    })
  }

  private async findInProject(
    tx: Prisma.TransactionClient,
    projectId: string,
    id: string,
  ) {
    const member = await tx.projectMember.findFirst({
      where: { id, projectId },
    })
    if (!member) {
      throw new NotFoundException('Member not found.')
    }

    return member
  }

  private async assertAnotherDesigner(
    tx: Prisma.TransactionClient,
    projectId: string,
    excludingMemberId: string,
  ) {
    const others = await tx.projectMember.count({
      where: { projectId, role: 'DESIGNER', id: { not: excludingMemberId } },
    })
    if (others === 0) {
      throw new ConflictException(
        'A project must keep at least one designer, its owner.',
      )
    }
  }
}
