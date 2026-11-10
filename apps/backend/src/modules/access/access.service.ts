import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { AccessContext, OrgAccessContext } from './access.types'

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The user's role in the project, or `null` if the project does not exist or
   * the user is not a member (the two are deliberately indistinguishable).
   */
  async forProject(
    userId: string,
    projectId: string,
  ): Promise<AccessContext | null> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true, organizationId: true },
    })

    return member
      ? { projectId, organizationId: member.organizationId, role: member.role }
      : null
  }

  /** The user's role in the organization, or `null` (missing = not a member). */
  async forOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrgAccessContext | null> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    })

    return member ? { organizationId, role: member.role } : null
  }
}
