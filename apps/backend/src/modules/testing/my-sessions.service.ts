import { Injectable } from '@nestjs/common'

import { TestSessionStatus } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { UserSessionDto } from './dto/user-session.dto'

/**
 * "My sessions" for a signed-in user. Only invitations actually claimed by
 * that account are returned; a tester who joined anonymously has none until
 * they claim the invitation with `POST /testing/join` while signed in.
 */
@Injectable()
export class MySessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<UserSessionDto[]> {
    const participants = await this.prisma.sessionParticipant.findMany({
      where: { userId, status: { in: ['JOINED', 'COMPLETED'] } },
      orderBy: { joinedAt: 'desc' },
      select: {
        joinedAt: true,
        completedAt: true,
        session: {
          select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
            expiresAt: true,
            endedAt: true,
            round: {
              select: {
                roundNumber: true,
                project: { select: { rounds: { select: { id: true } } } },
              },
            },
          },
        },
        taskRuns: {
          orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
          take: 1,
          select: { startedAt: true, finishedAt: true },
        },
        events: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true },
        },
        feedback: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    })

    return participants.map((participant) => {
      const { session } = participant
      const lastActiveTime = latest([
        participant.joinedAt,
        participant.taskRuns[0]?.startedAt,
        participant.taskRuns[0]?.finishedAt,
        participant.events[0]?.occurredAt,
        participant.feedback[0]?.createdAt,
      ])
      const submittedAt =
        participant.completedAt ??
        (session.status === 'COMPLETED' ? session.endedAt : null)

      return {
        // `id` is the session id the frontend uses to open the tester flow.
        id: participant.session.id,
        title: session.title,
        status: dashboardStatus(session.status),
        currentRound: session.round.roundNumber,
        totalRounds: session.round.project.rounds.length,
        ...(lastActiveTime
          ? { lastActiveTime: lastActiveTime.toISOString() }
          : {}),
        ...(session.startsAt
          ? { opensAt: session.startsAt.toISOString() }
          : {}),
        ...(submittedAt ? { submittedAt: submittedAt.toISOString() } : {}),
      }
    })
  }
}

function dashboardStatus(status: TestSessionStatus) {
  if (status === 'ACTIVE') {
    return 'ACTIVE' as const
  }
  if (status === 'DRAFT') {
    return 'SCHEDULED' as const
  }

  return 'COMPLETED' as const
}

function latest(values: Array<Date | null | undefined>): Date | null {
  return values.reduce<Date | null>(
    (best, value) => (value && (!best || value > best) ? value : best),
    null,
  )
}
