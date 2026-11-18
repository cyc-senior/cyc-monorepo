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
import {
  OrganizationMemberDto,
  PendingInvitationDto,
} from './dto/organization.dto'

const INCLUDE_USER = {
  user: { select: { id: true, email: true, name: true, image: true } },
} satisfies Prisma.OrganizationMemberInclude

/** Pending invitations: no mail is sent, the invitee claims one after sign-in. */
@Injectable()
export class OrganizationInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<Page<PendingInvitationDto>> {
    const where = { organizationId }

    return paginate(
      query,
      (page) =>
        this.prisma.organizationInvitation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.organizationInvitation.count({ where }),
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
        this.prisma.organizationInvitation.findMany({
          where,
          include: { organization: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.organizationInvitation.count({ where }),
    )
  }

  async cancel(organizationId: string, invitationId: string): Promise<void> {
    const deleted = await this.prisma.organizationInvitation.deleteMany({
      where: { id: invitationId, organizationId },
    })
    if (deleted.count === 0) {
      throw new NotFoundException('Invitation not found.')
    }
  }

  /** Turns an invitation into membership, in one transaction. */
  async accept(
    invitationId: string,
    user: { id: string; email: string },
  ): Promise<OrganizationMemberDto> {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUniqueOrThrow({
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

      const member = await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
        include: INCLUDE_USER,
      })
      await tx.organizationInvitation.delete({ where: { id: invitationId } })

      return member
    })
  }
}
