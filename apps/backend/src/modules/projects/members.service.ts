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

  /** Adds an already-registered user (looked up by email) to the project. */
  async add(projectId: string, dto: AddMemberDto): Promise<MemberDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!user) {
      throw new NotFoundException(
        'No registered user has that email. They need to sign in once first.',
      )
    }

    return this.prisma.projectMember.create({
      data: { projectId, userId: user.id, role: dto.role },
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
