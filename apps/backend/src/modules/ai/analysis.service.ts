import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  MessageEvent,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Observable } from 'rxjs'

import { recordDecision } from '../../common/decisions'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { errorText, logEvent } from '../../common/logging/log-event'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { LlmClient } from '../generation/llm.client'
import { MAX_FEEDBACK_PER_ANALYSIS } from '../testing/testing.constants'
import { AiTaskQueue } from './ai-task.queue'
import { AiTaskEvents } from './ai-task.events'
import { streamJob } from './ai-stream'
import {
  AnalysisDto,
  AnalysisQueryDto,
  CreateAnalysisDto,
  UpdateAnalysisDto,
} from './dto/analysis.dto'

const FINAL: Record<string, string> = {
  READY: 'completed',
  APPROVED: 'completed',
  REJECTED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

const COUNTS = {
  _count: { select: { themes: true } },
} satisfies Prisma.FeedbackAnalysisInclude

type AnalysisRow = Prisma.FeedbackAnalysisGetPayload<{
  include: typeof COUNTS
}>

/**
 * Feedback analyses: the AI's proposal (themes, summary) and the designer's
 * review of it. Creating one only queues a job; the worker never approves
 * anything — APPROVED/REJECTED are set here, by a person.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: AiTaskQueue,
    private readonly events: AiTaskEvents,
    private readonly llm: LlmClient,
  ) {}

  list(projectId: string, query: AnalysisQueryDto): Promise<Page<AnalysisDto>> {
    const where: Prisma.FeedbackAnalysisWhereInput = {
      projectId,
      roundId: query.roundId,
      status: query.status,
    }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.feedbackAnalysis.findMany({
          where,
          include: COUNTS,
          orderBy: { createdAt: 'desc' },
          ...page,
        })

        return rows.map((row) => this.toDto(row))
      },
      () => this.prisma.feedbackAnalysis.count({ where }),
    )
  }

  async get(projectId: string, id: string): Promise<AnalysisDto> {
    return this.toDto(await this.find(projectId, id))
  }

  /**
   * Snapshots the ids of the feedback to analyse and queues the job.
   *
   * Only feedback of the project's own sessions (of the round, or of the one
   * session asked for), with text, from participants who have not withdrawn.
   *
   * @throws BadRequestException when there is nothing to analyse, or too much.
   * @throws ServiceUnavailableException when the model is not configured or the queue is down.
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreateAnalysisDto,
  ): Promise<AnalysisDto> {
    await this.prisma.designRound.findFirstOrThrow({
      where: { id: dto.roundId, projectId },
      select: { id: true },
    })
    if (dto.sessionId) {
      await this.prisma.testSession.findFirstOrThrow({
        where: { id: dto.sessionId, projectId, roundId: dto.roundId },
        select: { id: true },
      })
    }
    const existing = await this.byIdempotencyKey(
      dto.roundId,
      dto.idempotencyKey,
    )
    if (existing) {
      return existing
    }
    if (!this.llm.configured) {
      throw new ServiceUnavailableException(
        'AI analysis is not configured on this server.',
      )
    }

    const feedback = await this.prisma.feedback.findMany({
      where: {
        skipped: false,
        comment: { not: null },
        session: {
          projectId,
          roundId: dto.roundId,
          id: dto.sessionId,
        },
        participant: { status: { not: 'WITHDRAWN' } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_FEEDBACK_PER_ANALYSIS + 1,
    })
    if (feedback.length === 0) {
      throw new BadRequestException(
        'There is no written feedback to analyse yet.',
      )
    }
    if (feedback.length > MAX_FEEDBACK_PER_ANALYSIS) {
      throw new BadRequestException(
        `At most ${MAX_FEEDBACK_PER_ANALYSIS} feedback items can be analysed at once; pick a single session.`,
      )
    }

    let analysis: AnalysisRow
    try {
      analysis = await this.prisma.feedbackAnalysis.create({
        data: {
          projectId,
          roundId: dto.roundId,
          sessionId: dto.sessionId,
          requestedById: userId,
          idempotencyKey: dto.idempotencyKey,
          modelProvider: this.llm.provider,
          modelName: this.llm.analysisModel,
          inputFeedbackIds: feedback.map((f) => f.id),
        },
        include: COUNTS,
      })
    } catch (error) {
      // Two identical requests raced past the lookup: the loser gets the winner's analysis.
      const raced = await this.byIdempotencyKey(dto.roundId, dto.idempotencyKey)
      if (raced) {
        return raced
      }
      throw error
    }
    try {
      await this.queue.enqueue('feedback-analysis', analysis.id)
    } catch (error) {
      await this.prisma.feedbackAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'FAILED',
          error: errorText(error),
          finishedAt: new Date(),
        },
      })
      this.logger.error(
        logEvent('analysis.enqueue_failed', {
          id: analysis.id,
          error: errorText(error),
        }),
      )
      throw new ServiceUnavailableException(
        'Could not queue the analysis; try again shortly.',
      )
    }

    return this.toDto(analysis)
  }

  /** Stops a queued or running analysis; nothing is saved. */
  async cancel(projectId: string, id: string): Promise<AnalysisDto> {
    await this.find(projectId, id)
    const cancelled = await this.prisma.feedbackAnalysis.updateMany({
      where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
    if (cancelled.count === 0) {
      throw new ConflictException('The analysis has already finished.')
    }
    await this.queue.withdraw(id).catch(() => undefined)

    return this.get(projectId, id)
  }

  /** Edits the reviewed summary/insights while the analysis awaits review. */
  async update(
    projectId: string,
    id: string,
    dto: UpdateAnalysisDto,
  ): Promise<AnalysisDto> {
    await this.find(projectId, id)
    const updated = await this.prisma.feedbackAnalysis.updateMany({
      where: { id, projectId, status: 'READY' },
      data: {
        summary: dto.summary,
        insights: dto.insights,
        reviewNote: dto.reviewNote,
      },
    })
    if (updated.count === 0) {
      throw new ConflictException(
        'Only an analysis awaiting review (READY) can be edited.',
      )
    }

    return this.get(projectId, id)
  }

  /**
   * The designer approves the analysis. Every suggested theme must have been
   * decided first (accepted, rejected, won't-fix or merged).
   */
  async approve(
    projectId: string,
    id: string,
    userId: string,
    rationale?: string,
  ): Promise<AnalysisDto> {
    const analysis = await this.find(projectId, id)

    await this.prisma.$transaction(async (tx) => {
      const undecided = await tx.feedbackTheme.count({
        where: { analysisId: id, status: 'PROPOSED' },
      })
      if (undecided > 0) {
        throw new ConflictException(
          `${undecided} theme(s) are still undecided; accept, reject, merge or mark them won’t-fix first.`,
        )
      }
      await this.decide(tx, analysis, userId, 'APPROVED', rationale)
      await recordDecision(tx, {
        projectId,
        roundId: analysis.roundId,
        type: 'ANALYSIS_APPROVED',
        analysisId: id,
        decidedById: userId,
        rationale,
      })
    })

    return this.get(projectId, id)
  }

  /** The designer rejects the analysis; its themes can no longer be selected. */
  async reject(
    projectId: string,
    id: string,
    userId: string,
    rationale?: string,
  ): Promise<AnalysisDto> {
    const analysis = await this.find(projectId, id)

    await this.prisma.$transaction(async (tx) => {
      await this.decide(tx, analysis, userId, 'REJECTED', rationale)
      await tx.feedbackTheme.updateMany({
        where: { analysisId: id },
        data: { selectedForIteration: false, selectedAt: null },
      })
      await recordDecision(tx, {
        projectId,
        roundId: analysis.roundId,
        type: 'ANALYSIS_REJECTED',
        analysisId: id,
        decidedById: userId,
        rationale,
      })
    })

    return this.get(projectId, id)
  }

  /** SSE: status and progress of the analysis job. */
  async stream(
    projectId: string,
    id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.find(projectId, id)

    return streamJob(
      this.events,
      id,
      async () => {
        const row = await this.prisma.feedbackAnalysis.findUniqueOrThrow({
          where: { id },
          select: {
            status: true,
            error: true,
            startedAt: true,
            finishedAt: true,
          },
        })

        return {
          type: FINAL[row.status] ?? 'status',
          data: { jobId: id, ...row },
        }
      },
      ['completed', 'failed', 'cancelled'],
    )
  }

  /** The analysis of the project or 404; the only way analyses are looked up. */
  find(projectId: string, id: string): Promise<AnalysisRow> {
    return this.prisma.feedbackAnalysis.findFirstOrThrow({
      where: { id, projectId },
      include: COUNTS,
    })
  }

  private async decide(
    tx: Prisma.TransactionClient,
    analysis: AnalysisRow,
    userId: string,
    status: 'APPROVED' | 'REJECTED',
    note?: string,
  ): Promise<void> {
    const claimed = await tx.feedbackAnalysis.updateMany({
      where: {
        id: analysis.id,
        projectId: analysis.projectId,
        status: 'READY',
      },
      data: {
        status,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: note ?? analysis.reviewNote,
      },
    })
    if (claimed.count === 0) {
      throw new ConflictException(
        'Only an analysis awaiting review (READY) can be approved or rejected.',
      )
    }
  }

  private async byIdempotencyKey(
    roundId: string,
    key: string | undefined,
  ): Promise<AnalysisDto | null> {
    if (!key) {
      return null
    }
    const row = await this.prisma.feedbackAnalysis.findUnique({
      where: { roundId_idempotencyKey: { roundId, idempotencyKey: key } },
      include: COUNTS,
    })

    return row ? this.toDto(row) : null
  }

  private toDto(row: AnalysisRow): AnalysisDto {
    const { _count, inputFeedbackIds, ...analysis } = row

    return {
      ...analysis,
      aiInsights: analysis.aiInsights as string[],
      insights: analysis.insights as string[],
      feedbackCount: (inputFeedbackIds as string[]).length,
      themeCount: _count.themes,
    }
  }
}
