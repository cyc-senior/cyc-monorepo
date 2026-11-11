import { Injectable } from '@nestjs/common'

import { ReportType } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { HandoffService } from './handoff.service'

const DAY_MS = 24 * 60 * 60 * 1000
/** A round open, or a pause between approved rounds, longer than this is reported as a gap. */
const GAP_DAYS = 14

type Json = Record<string, unknown>

/**
 * Builds the content of the role-specific reports and the live project status.
 * Each view is assembled from aggregates and designer-reviewed text only:
 * participants' emails, raw feedback, interaction events and consent records
 * never enter a stakeholder view (the DESIGNER report carries counts, not
 * identities, either).
 */
@Injectable()
export class ProjectInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly handoff: HandoffService,
  ) {}

  /** The report body for an audience. */
  build(projectId: string, type: ReportType, roundId?: string): Promise<Json> {
    switch (type) {
      case 'CLIENT':
        return this.client(projectId, roundId)
      case 'DEVELOPER':
        return this.developer(projectId, roundId)
      case 'PROJECT_MANAGER':
        return this.status(projectId, roundId)
      default:
        return this.designer(projectId, roundId)
    }
  }

  // -------------------------------------------------------------------------
  // Project manager / live status
  // -------------------------------------------------------------------------

  async status(projectId: string, roundId?: string): Promise<Json> {
    const now = new Date()
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        name: true,
        clientOrProduct: true,
        platforms: true,
        status: true,
        designIntent: { select: { version: true } },
      },
    })
    const rounds = await this.prisma.designRound.findMany({
      where: { projectId, id: roundId },
      select: {
        id: true,
        roundNumber: true,
        title: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        updatedAt: true,
      },
      orderBy: { roundNumber: 'asc' },
    })
    const ids = rounds.map((round) => round.id)
    const [variants, sessions, analyses, undecided] = await Promise.all([
      this.prisma.uIVariant.groupBy({
        by: ['roundId', 'status'],
        where: { roundId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.testSession.findMany({
        where: { projectId, roundId: { in: ids } },
        select: {
          id: true,
          roundId: true,
          status: true,
          expiresAt: true,
          endedAt: true,
        },
      }),
      this.prisma.feedbackAnalysis.findMany({
        where: { projectId, roundId: { in: ids } },
        select: { id: true, roundId: true, status: true },
      }),
      this.prisma.feedbackTheme.groupBy({
        by: ['analysisId'],
        where: { analysis: { projectId }, status: 'PROPOSED' },
        _count: { _all: true },
      }),
    ])
    const participants = await this.prisma.sessionParticipant.groupBy({
      by: ['sessionId', 'status'],
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      _count: { _all: true },
    })

    const roundOf = new Map(sessions.map((s) => [s.id, s.roundId]))
    const openThemes = new Map<string, number>()
    for (const row of undecided) {
      const analysis = analyses.find((a) => a.id === row.analysisId)
      if (analysis) {
        openThemes.set(
          analysis.roundId,
          (openThemes.get(analysis.roundId) ?? 0) + row._count._all,
        )
      }
    }

    const progress = rounds.map((round) => {
      const mine = sessions.filter((s) => s.roundId === round.id)
      const people = (status?: string) =>
        participants
          .filter(
            (p) =>
              roundOf.get(p.sessionId) === round.id &&
              (status === undefined || p.status === status),
          )
          .reduce((sum, p) => sum + p._count._all, 0)
      const variantCount = (status?: string) =>
        variants
          .filter(
            (v) =>
              v.roundId === round.id &&
              (status === undefined || v.status === status),
          )
          .reduce((sum, v) => sum + v._count._all, 0)

      return {
        roundNumber: round.roundNumber,
        title: round.title,
        status: round.status,
        createdAt: round.createdAt,
        approvedAt: round.approvedAt,
        daysOpen: Math.floor(
          ((round.approvedAt ?? now).getTime() - round.createdAt.getTime()) /
            DAY_MS,
        ),
        variants: { total: variantCount(), approved: variantCount('APPROVED') },
        sessions: {
          total: mine.length,
          active: mine.filter((s) => s.status === 'ACTIVE').length,
          completed: mine.filter((s) => s.status === 'COMPLETED').length,
        },
        participants: {
          total: people(),
          completed: people('COMPLETED'),
        },
        analyses: {
          total: analyses.filter((a) => a.roundId === round.id).length,
          awaitingReview: analyses.filter(
            (a) => a.roundId === round.id && a.status === 'READY',
          ).length,
          approved: analyses.filter(
            (a) => a.roundId === round.id && a.status === 'APPROVED',
          ).length,
        },
        undecidedThemes: openThemes.get(round.id) ?? 0,
      }
    })

    const gaps: Json[] = []
    for (const round of rounds) {
      const age = Math.floor(
        (now.getTime() - round.updatedAt.getTime()) / DAY_MS,
      )
      if (round.status === 'DRAFT' && age > GAP_DAYS) {
        gaps.push({
          type: 'stale_round',
          roundNumber: round.roundNumber,
          days: age,
          message: `Round ${round.roundNumber} has had no activity for ${age} days and is not approved.`,
        })
      }
    }
    const approved = rounds.filter((round) => round.approvedAt)
    for (let i = 1; i < approved.length; i++) {
      const days = Math.floor(
        ((approved[i].approvedAt as Date).getTime() -
          (approved[i - 1].approvedAt as Date).getTime()) /
          DAY_MS,
      )
      if (days > GAP_DAYS) {
        gaps.push({
          type: 'gap_between_rounds',
          roundNumber: approved[i].roundNumber,
          days,
          message: `${days} days passed between the approval of round ${approved[i - 1].roundNumber} and round ${approved[i].roundNumber}.`,
        })
      }
    }
    for (const session of sessions) {
      if (
        session.status === 'ACTIVE' &&
        session.expiresAt &&
        session.expiresAt < now
      ) {
        gaps.push({
          type: 'expired_session',
          roundNumber: rounds.find((r) => r.id === session.roundId)
            ?.roundNumber,
          message: 'A test session passed its deadline without being ended.',
        })
      }
    }

    return {
      audience: 'PROJECT_MANAGER',
      generatedAt: now,
      project,
      rounds: {
        total: rounds.length,
        approved: approved.length,
        draft: rounds.filter((r) => r.status === 'DRAFT').length,
        archived: rounds.filter((r) => r.status === 'ARCHIVED').length,
      },
      roundProgress: progress,
      timelineGaps: gaps,
      lastActivityAt: rounds.reduce<Date | null>(
        (latest, round) =>
          !latest || round.updatedAt > latest ? round.updatedAt : latest,
        null,
      ),
    }
  }

  // -------------------------------------------------------------------------
  // Client
  // -------------------------------------------------------------------------

  private async client(projectId: string, roundId?: string): Promise<Json> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        name: true,
        clientOrProduct: true,
        description: true,
        designIntent: { select: { statement: true } },
      },
    })
    const rounds = await this.prisma.designRound.findMany({
      where: { projectId, id: roundId, status: 'APPROVED' },
      include: {
        variants: {
          where: { status: 'APPROVED' },
          select: { label: true, name: true },
          orderBy: { createdAt: 'asc' },
        },
        feedbackLinks: {
          select: {
            theme: {
              select: {
                title: true,
                summary: true,
                category: true,
                severity: true,
              },
            },
          },
        },
        _count: { select: { acknowledgements: true, comments: true } },
      },
      orderBy: { roundNumber: 'asc' },
    })
    const testing = await this.testingTotals(
      projectId,
      rounds.map((round) => round.id),
    )

    return {
      audience: 'CLIENT',
      generatedAt: new Date(),
      project,
      rounds: rounds.map((round) => ({
        roundNumber: round.roundNumber,
        title: round.title,
        approvedAt: round.approvedAt,
        approvedDesigns: round.variants,
        // What user testing found that this round set out to fix (reviewed by the designer).
        improvementsFromTesting: round.feedbackLinks.map((link) => link.theme),
        testing: testing.get(round.id) ?? { sessions: 0, participants: 0 },
        acknowledgements: round._count.acknowledgements,
        comments: round._count.comments,
      })),
    }
  }

  // -------------------------------------------------------------------------
  // Developer
  // -------------------------------------------------------------------------

  private async developer(projectId: string, roundId?: string): Promise<Json> {
    const handoff = await this.handoff.handoff(projectId)
    const rounds = handoff.rounds.filter(
      (round) => roundId === undefined || round.id === roundId,
    )
    const risks = rounds.flatMap((round) =>
      round.variants.flatMap((variant) =>
        variant.technicalRisks.map((risk) => ({
          roundNumber: round.roundNumber,
          variant: variant.label ?? variant.name,
          risk,
        })),
      ),
    )

    return {
      audience: 'DEVELOPER',
      generatedAt: new Date(),
      designSystem: handoff.designSystem,
      designStandards: handoff.designStandards,
      platforms: handoff.platforms,
      brandColors: handoff.brandColors,
      rounds,
      technicalRisks: risks,
    }
  }

  // -------------------------------------------------------------------------
  // Designer
  // -------------------------------------------------------------------------

  /**
   * The designer's own view of the design evolution: per round, what was
   * tested, what the AI proposed, what the designer made of it and decided.
   */
  private async designer(projectId: string, roundId?: string): Promise<Json> {
    const rounds = await this.prisma.designRound.findMany({
      where: { projectId, id: roundId },
      include: {
        variants: {
          select: {
            id: true,
            label: true,
            name: true,
            status: true,
            parentVariantId: true,
            version: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        feedbackLinks: { select: { themeId: true, note: true } },
      },
      orderBy: { roundNumber: 'asc' },
    })
    const ids = rounds.map((round) => round.id)
    const [sessions, feedback, analyses, decisions, participants] =
      await Promise.all([
        this.prisma.testSession.findMany({
          where: { projectId, roundId: { in: ids } },
          select: { id: true, roundId: true, title: true, status: true },
        }),
        this.prisma.feedback.groupBy({
          by: ['sessionId', 'scope', 'skipped'],
          where: { session: { projectId, roundId: { in: ids } } },
          _count: { _all: true },
        }),
        this.prisma.feedbackAnalysis.findMany({
          where: { projectId, roundId: { in: ids } },
          include: {
            themes: {
              include: { _count: { select: { feedback: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.designDecision.findMany({
          where: { projectId, roundId: { in: ids } },
          orderBy: { createdAt: 'asc' },
          take: 1000,
        }),
        this.prisma.sessionParticipant.groupBy({
          by: ['sessionId', 'status'],
          where: { session: { projectId, roundId: { in: ids } } },
          _count: { _all: true },
        }),
      ])

    return {
      audience: 'DESIGNER',
      generatedAt: new Date(),
      rounds: rounds.map((round) => {
        const mine = sessions.filter((s) => s.roundId === round.id)
        const sessionIds = new Set(mine.map((s) => s.id))

        return {
          roundNumber: round.roundNumber,
          title: round.title,
          status: round.status,
          parentRoundId: round.parentRoundId,
          approvedAt: round.approvedAt,
          variants: round.variants,
          addressedThemeIds: round.feedbackLinks.map((link) => link.themeId),
          sessions: mine.map((session) => ({
            title: session.title,
            status: session.status,
            participants: Object.fromEntries(
              participants
                .filter((p) => p.sessionId === session.id)
                .map((p) => [p.status, p._count._all]),
            ),
          })),
          feedback: {
            written: this.sumFeedback(feedback, sessionIds, false),
            skipped: this.sumFeedback(feedback, sessionIds, true),
            byScope: {
              COMPONENT: this.sumFeedback(
                feedback,
                sessionIds,
                false,
                'COMPONENT',
              ),
              PAGE: this.sumFeedback(feedback, sessionIds, false, 'PAGE'),
            },
          },
          analyses: analyses
            .filter((a) => a.roundId === round.id)
            .map((analysis) => ({
              id: analysis.id,
              status: analysis.status,
              model: analysis.modelName,
              aiSummary: analysis.aiSummary,
              reviewedSummary: analysis.summary,
              summaryEdited: analysis.aiSummary !== analysis.summary,
              reviewedAt: analysis.reviewedAt,
              themes: analysis.themes.map((theme) => ({
                id: theme.id,
                origin: theme.origin,
                status: theme.status,
                title: theme.title,
                category: theme.category,
                severity: theme.severity,
                feedbackCount: theme._count.feedback,
                // The designer changed what the AI proposed.
                editedFromAi:
                  theme.origin === 'AI' &&
                  (theme.title !== theme.aiTitle ||
                    theme.summary !== theme.aiSummary ||
                    theme.category !== theme.aiCategory ||
                    theme.severity !== theme.aiSeverity),
                selectedForIteration: theme.selectedForIteration,
                wontFixReason: theme.wontFixReason,
              })),
            })),
          decisions: decisions
            .filter((d) => d.roundId === round.id)
            .map((d) => ({
              type: d.type,
              at: d.createdAt,
              themeId: d.themeId,
              variantId: d.variantId,
              resultingRoundId: d.resultingRoundId,
              rationale: d.rationale,
            })),
        }
      }),
    }
  }

  private sumFeedback(
    rows: Array<{
      sessionId: string
      scope: string
      skipped: boolean
      _count: { _all: number }
    }>,
    sessionIds: Set<string>,
    skipped: boolean,
    scope?: string,
  ): number {
    return rows
      .filter(
        (row) =>
          sessionIds.has(row.sessionId) &&
          row.skipped === skipped &&
          (scope === undefined || row.scope === scope),
      )
      .reduce((sum, row) => sum + row._count._all, 0)
  }

  /** Aggregate counts per round: completed sessions and participants who finished. */
  private async testingTotals(
    projectId: string,
    roundIds: string[],
  ): Promise<Map<string, { sessions: number; participants: number }>> {
    const sessions = await this.prisma.testSession.findMany({
      where: { projectId, roundId: { in: roundIds }, status: 'COMPLETED' },
      select: {
        roundId: true,
        _count: {
          select: { participants: { where: { status: 'COMPLETED' } } },
        },
      },
    })
    const totals = new Map<string, { sessions: number; participants: number }>()
    for (const session of sessions) {
      const total = totals.get(session.roundId) ?? {
        sessions: 0,
        participants: 0,
      }
      total.sessions += 1
      total.participants += session._count.participants
      totals.set(session.roundId, total)
    }

    return totals
  }
}
