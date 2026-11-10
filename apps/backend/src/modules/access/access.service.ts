import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { AccessContext } from './access.types'

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
      select: { role: true },
    })

    return member ? { projectId, role: member.role } : null
  }
}
