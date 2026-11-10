import { Injectable } from '@nestjs/common'

import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { ParticipantStatus, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  ConsentQueryDto,
  ConsentRecordDto,
  FeedbackDto,
  FeedbackQueryDto,
  InteractionEventDto,
  InteractionEventQueryDto,
  SessionProgressDto,
  TaskRunDto,
} from './dto/test-session.dto'

/**
 * What a session produced, for the designers of its project: progress, the raw
 * feedback and events, task runs and the consent history. Every query starts
 * from a session of the project, so ids from elsewhere simply find nothing.
 */
@Injectable()
export class SessionResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async progress(
    projectId: string,
    sessionId: string,
  ): Promise<SessionProgressDto> {
    const session = await this.session(projectId, sessionId)
    const [participants, consents, tasks, runs, feedback, skipped, events] =
      await Promise.all([
        this.prisma.sessionParticipant.groupBy({
          by: ['status'],
          where: { sessionId },
          _count: { _all: true },
        }),
        this.prisma.consentRecord.findMany({
          where: { sessionId, consentVersion: session.consentVersion },
          orderBy: { createdAt: 'desc' },
          distinct: ['participantId'],
          select: { decision: true },
        }),
        this.prisma.testTask.findMany({
          where: { sessionId },
          orderBy: { position: 'asc' },
          select: { id: true, title: true },
        }),
        this.prisma.taskRun.groupBy({
          by: ['taskId', 'status'],
          where: { sessionId },
          _count: { _all: true },
        }),
        this.prisma.feedback.count({ where: { sessionId } }),
        this.prisma.feedback.count({ where: { sessionId, skipped: true } }),
        this.prisma.interactionEvent.count({ where: { sessionId } }),
      ])

    const byStatus = Object.fromEntries(
      (
        [
          'INVITED',
          'JOINED',
          'COMPLETED',
          'WITHDRAWN',
          'REVOKED',
        ] as ParticipantStatus[]
      ).map((status) => [status, 0]),
    ) as Record<ParticipantStatus, number>
    for (const row of participants) {
      byStatus[row.status] = row._count._all
    }
    const countRuns = (taskId: string, status: string) =>
      runs.find((r) => r.taskId === taskId && r.status === status)?._count
        ._all ?? 0

    return {
      sessionId,
      participants: byStatus,
      consentGranted: consents.filter((c) => c.decision === 'GRANTED').length,
      consentDeclined: consents.filter((c) => c.decision === 'DECLINED').length,
      tasks: tasks.map((task) => ({
        taskId: task.id,
        title: task.title,
        inProgress: countRuns(task.id, 'IN_PROGRESS'),
        completed: countRuns(task.id, 'COMPLETED'),
        abandoned: countRuns(task.id, 'ABANDONED'),
      })),
      feedbackCount: feedback,
      skippedFeedbackCount: skipped,
      eventCount: events,
    }
  }

  async feedback(
    projectId: string,
    sessionId: string,
    query: FeedbackQueryDto,
  ): Promise<Page<FeedbackDto>> {
    await this.session(projectId, sessionId)
    const where: Prisma.FeedbackWhereInput = {
      sessionId,
      variantId: query.variantId,
      participantId: query.participantId,
      scope: query.scope,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.feedback.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          ...page,
        }),
      () => this.prisma.feedback.count({ where }),
    )
  }

  async events(
    projectId: string,
    sessionId: string,
    query: InteractionEventQueryDto,
  ): Promise<Page<InteractionEventDto>> {
    await this.session(projectId, sessionId)
    const where: Prisma.InteractionEventWhereInput = {
      sessionId,
      participantId: query.participantId,
      variantId: query.variantId,
      type: query.type,
    }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.interactionEvent.findMany({
          where,
          orderBy: { occurredAt: 'asc' },
          ...page,
        })

        return rows.map((row) => ({
          ...row,
          metadata: row.metadata as Record<string, unknown>,
        }))
      },
      () => this.prisma.interactionEvent.count({ where }),
    )
  }

  async taskRuns(
    projectId: string,
    sessionId: string,
    query: PaginationQueryDto,
  ): Promise<Page<TaskRunDto>> {
    await this.session(projectId, sessionId)
    const where = { sessionId }

    return paginate(
      query,
      (page) =>
        this.prisma.taskRun.findMany({
          where,
          orderBy: { startedAt: 'asc' },
          ...page,
        }),
      () => this.prisma.taskRun.count({ where }),
    )
  }

  /** The PDPA consent history (every decision, newest first). */
  async consents(
    projectId: string,
    sessionId: string,
    query: ConsentQueryDto,
  ): Promise<Page<ConsentRecordDto>> {
    await this.session(projectId, sessionId)
    const where = { sessionId, participantId: query.participantId }

    return paginate(
      query,
      (page) =>
        this.prisma.consentRecord.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            participantId: true,
            consentVersion: true,
            textHash: true,
            decision: true,
            createdAt: true,
          },
          ...page,
        }),
      () => this.prisma.consentRecord.count({ where }),
    )
  }

  private session(projectId: string, sessionId: string) {
    return this.prisma.testSession.findFirstOrThrow({
      where: { id: sessionId, projectId },
      select: { id: true, consentVersion: true },
    })
  }
}
