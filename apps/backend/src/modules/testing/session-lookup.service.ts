import { Injectable, NotFoundException } from '@nestjs/common'

import { Platform } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'
import { FoundSessionDto } from './dto/tester.dto'
import { displayInviteCode, hashInviteToken } from './invite-token'

const PLATFORM_LABELS: Record<Platform, string> = {
  DESKTOP: 'Desktop',
  MOBILE: 'Mobile',
  TABLET: 'Tablet',
}

/**
 * Preview of an invitation before the designer's link is accepted. It reveals
 * only what the frontend needs for the preview screen — never participant
 * email, assignment or invitation ownership details.
 */
@Injectable()
export class SessionLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(
    code: string,
    user: AuthenticatedUser | null,
  ): Promise<FoundSessionDto> {
    const participant = await this.prisma.sessionParticipant.findUnique({
      where: { inviteTokenHash: hashInviteToken(code) },
      select: {
        userId: true,
        session: {
          select: {
            title: true,
            expiresAt: true,
            project: {
              select: {
                name: true,
                platforms: true,
                organization: { select: { name: true } },
              },
            },
            tasks: {
              orderBy: { position: 'asc' },
              take: 1,
              select: { title: true },
            },
          },
        },
      },
    })
    if (!participant) {
      throw new NotFoundException('No test session uses that code.')
    }

    const { session } = participant
    const platform = session.project.platforms[0] ?? Platform.DESKTOP

    return {
      code: displayInviteCode(code),
      workspaceName: session.project.organization.name,
      projectName: session.project.name,
      taskName: session.tasks[0]?.title ?? session.title,
      platform: PLATFORM_LABELS[platform],
      expiresAt: session.expiresAt?.toISOString() ?? '',
      isTakenByOther:
        participant.userId !== null && participant.userId !== user?.id,
    }
  }
}
