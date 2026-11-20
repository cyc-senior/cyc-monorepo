import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { WorkspaceMemberDto, PendingInvitationDto } from './dto/workspace.dto'

const INCLUDE_USER = {
  user: { select: { id: true, email: true, name: true, image: true } },
} satisfies Prisma.WorkspaceMemberInclude

/** Pending invitations: no mail is sent, the invitee claims one after sign-in. */
@Injectable()
export class WorkspaceInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<Page<PendingInvitationDto>> {
    const where = { workspaceId }

    return paginate(
      query,
      (page) =>
        this.prisma.workspaceInvitation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.workspaceInvitation.count({ where }),
    )
  }

  /** Invitations addressed to the signed-in user's email. */
  listForEmail(
    email: string,
    query: PaginationQueryDto,
  ): Promise<Page<PendingInvitationDto>> {
    const where = { email: email.trim().toLowerCase() }

    return paginate(
      query,
      (page) =>
        this.prisma.workspaceInvitation.findMany({
          where,
          include: { workspace: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.workspaceInvitation.count({ where }),
    )
  }

  async cancel(workspaceId: string, invitationId: string): Promise<void> {
    const deleted = await this.prisma.workspaceInvitation.deleteMany({
      where: { id: invitationId, workspaceId },
    })
    if (deleted.count === 0) {
      throw new NotFoundException('Invitation not found.')
    }
  }

  /** Turns an invitation into membership, in one transaction. */
  async accept(
    invitationId: string,
    user: { id: string; email: string },
  ): Promise<WorkspaceMemberDto> {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      })
      if (invitation.email !== user.email.trim().toLowerCase()) {
        throw new ForbiddenException(
          'This invitation was sent to a different email address.',
        )
      }
      if (invitation.expiresAt && invitation.expiresAt <= new Date()) {
        throw new ConflictException('This invitation has expired.')
      }

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        },
        include: INCLUDE_USER,
      })
      await tx.workspaceInvitation.delete({ where: { id: invitationId } })

      return member
    })
  }
}
