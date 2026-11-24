import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { AccessContext, WorkspaceAccessContext } from './access.types'

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
      select: { role: true, workspaceId: true },
    })

    return member
      ? { projectId, workspaceId: member.workspaceId, role: member.role }
      : null
  }

  /** The user's role in the workspace, or `null` (missing = not a member). */
  async forWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceAccessContext | null> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    })

    return member ? { workspaceId, role: member.role } : null
  }
}
