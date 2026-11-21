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
import { WorkspaceRole, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  AddWorkspaceMemberDto,
  WorkspaceMemberDto,
  PendingInvitationDto,
} from './dto/workspace.dto'

/** How long an invitation to an unregistered email stays claimable. */
export const INVITATION_TTL_DAYS = 30

const INCLUDE_USER = {
  user: { select: { id: true, email: true, name: true, image: true } },
} satisfies Prisma.WorkspaceMemberInclude

/**
 * Workspace team rules: a workspace always keeps one ADMIN; removing a
 * member also removes their project memberships (a project can never contain
 * someone outside its workspace) unless they are a project's last designer.
 */
@Injectable()
export class WorkspaceMembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<Page<WorkspaceMemberDto>> {
    const where = { workspaceId }

    return paginate(
      query,
      (page) =>
        this.prisma.workspaceMember.findMany({
          where,
          include: INCLUDE_USER,
          orderBy: { joinedAt: 'asc' },
          ...page,
        }),
      () => this.prisma.workspaceMember.count({ where }),
    )
  }

  /**
   * Adds a registered user by email, or leaves a pending invitation when the
   * email has no account yet. No email is sent; the invitee claims it after
   * signing in (`POST /workspaces/invitations/:invitationId/accept`).
   */
  async add(
    workspaceId: string,
    dto: AddWorkspaceMemberDto,
    invitedById?: string,
  ): Promise<WorkspaceMemberDto | PendingInvitationDto> {
    const email = dto.email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (user) {
      return this.prisma.workspaceMember.create({
        data: { workspaceId, userId: user.id, role: dto.role },
        include: INCLUDE_USER,
      })
    }

    return this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: dto.role,
        invitedById,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
      },
    })
  }

  changeRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMemberDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `workspace-admins:${workspaceId}`)
      const target = await this.find(tx, workspaceId, memberId)
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        await this.assertAnotherAdmin(tx, workspaceId, target.id)
      }

      return tx.workspaceMember.update({
        where: { id: target.id },
        data: { role },
        include: INCLUDE_USER,
      })
    })
  }

  /** Removes a member (anyone may remove themselves, admins may remove anyone). */
  async remove(
    workspaceId: string,
    memberId: string,
    actor: { userId: string; role: WorkspaceRole },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `workspace-admins:${workspaceId}`)
      const target = await this.find(tx, workspaceId, memberId)
      if (target.userId !== actor.userId && actor.role !== 'ADMIN') {
        throw new NotFoundException('Member not found.')
      }
      if (target.role === 'ADMIN') {
        await this.assertAnotherAdmin(tx, workspaceId, target.id)
      }
      await this.detachFromProjects(tx, workspaceId, target.userId)
      await tx.workspaceMember.delete({ where: { id: target.id } })
    })
  }

  /** Drops the user's project memberships in the workspace. */
  private async detachFromProjects(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const memberships = await tx.projectMember.findMany({
      where: { workspaceId, userId },
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
    await tx.projectMember.deleteMany({ where: { workspaceId, userId } })
  }

  private async find(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    id: string,
  ) {
    const member = await tx.workspaceMember.findFirst({
      where: { id, workspaceId },
    })
    if (!member) {
      throw new NotFoundException('Member not found.')
    }

    return member
  }

  private async assertAnotherAdmin(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    excludingMemberId: string,
  ) {
    const others = await tx.workspaceMember.count({
      where: {
        workspaceId,
        role: 'ADMIN',
        id: { not: excludingMemberId },
      },
    })
    if (others === 0) {
      throw new ConflictException('A workspace must keep at least one admin.')
    }
  }
}
