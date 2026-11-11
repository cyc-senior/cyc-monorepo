import { ConflictException, Injectable } from '@nestjs/common'

import { recordDecision } from '../../common/decisions'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { createNextRound } from '../rounds/round-state'
import {
  AddressedThemeDto,
  DecisionDto,
  DecisionQueryDto,
  IterationDto,
  RoundTraceDto,
  StartIterationDto,
} from './dto/iteration.dto'

const THEME_FIELDS = {
  id: true,
  title: true,
  summary: true,
  category: true,
  severity: true,
  designerNote: true,
  _count: { select: { feedback: true } },
} satisfies Prisma.FeedbackThemeSelect

type ThemeRow = Prisma.FeedbackThemeGetPayload<{ select: typeof THEME_FIELDS }>

/**
 * Closes the loop from feedback to the next design: the designer selected
 * reviewed themes; starting the iteration opens the next round, records which
 * themes it addresses and why, and (optionally) carries variants forward with
 * their lineage. Decisions are append-only.
 */
@Injectable()
export class IterationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Opens the round that follows `roundId`, addressing the themes the designer
   * selected from APPROVED analyses of that round. Themes already addressed by
   * an earlier iteration are not addressed twice, so repeating the call finds
   * nothing left and fails instead of opening a duplicate round.
   *
   * @throws ConflictException when the round is archived, or no selected theme is left.
   */
  async start(
    projectId: string,
    roundId: string,
    userId: string,
    dto: StartIterationDto,
  ): Promise<IterationDto> {
    const source = await this.prisma.designRound.findFirstOrThrow({
      where: { id: roundId, projectId },
    })
    if (source.status === 'ARCHIVED') {
      throw new ConflictException('An archived round cannot be iterated.')
    }

    return this.prisma.$transaction(async (tx) => {
      const themes = await tx.feedbackTheme.findMany({
        where: {
          selectedForIteration: true,
          status: 'ACCEPTED',
          analysis: { projectId, roundId, status: 'APPROVED' },
          roundLinks: { none: {} },
        },
        select: THEME_FIELDS,
        orderBy: { selectedAt: 'asc' },
      })
      if (themes.length === 0) {
        throw new ConflictException(
          'Select at least one accepted theme of an approved analysis that has not been addressed yet.',
        )
      }

      const round = await createNextRound(tx, projectId, {
        title: dto.title,
        parentRoundId: roundId,
      })
      await tx.roundFeedbackLink.createMany({
        data: themes.map((theme) => ({
          roundId: round.id,
          themeId: theme.id,
          note: theme.designerNote,
        })),
      })
      const carriedVariantIds = await this.carryForward(
        tx,
        projectId,
        roundId,
        round.id,
        dto.carryForwardVariantIds,
      )
      await recordDecision(tx, {
        projectId,
        roundId,
        type: 'ITERATION_STARTED',
        resultingRoundId: round.id,
        decidedById: userId,
        rationale: dto.rationale,
      })

      return {
        round,
        addressed: themes.map((theme) => this.toAddressed(theme)),
        carriedVariantIds,
      }
    })
  }

  /** Explains a round: what it addresses, what it contains, what was decided. */
  async trace(projectId: string, roundId: string): Promise<RoundTraceDto> {
    const round = await this.prisma.designRound.findFirstOrThrow({
      where: { id: roundId, projectId },
      include: {
        feedbackLinks: { select: { theme: { select: THEME_FIELDS } } },
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
        childRounds: { select: { id: true }, orderBy: { roundNumber: 'asc' } },
        decisions: { orderBy: { createdAt: 'asc' }, take: 500 },
      },
    })

    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      status: round.status,
      parentRoundId: round.parentRoundId,
      addressed: round.feedbackLinks.map((link) =>
        this.toAddressed(link.theme),
      ),
      variants: round.variants,
      decisions: round.decisions,
      childRoundIds: round.childRounds.map((child) => child.id),
    }
  }

  /** The project's decision history, newest first. */
  decisions(
    projectId: string,
    query: DecisionQueryDto,
  ): Promise<Page<DecisionDto>> {
    const where: Prisma.DesignDecisionWhereInput = {
      projectId,
      roundId: query.roundId,
      type: query.type,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.designDecision.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.designDecision.count({ where }),
    )
  }

  /**
   * Copies variants of the source round into the new round as READY drafts
   * (never APPROVED: the new round needs its own approvals).
   */
  private async carryForward(
    tx: Prisma.TransactionClient,
    projectId: string,
    fromRoundId: string,
    toRoundId: string,
    variantIds: string[] | undefined,
  ): Promise<string[]> {
    if (!variantIds?.length) {
      return []
    }
    const variants = await tx.uIVariant.findMany({
      where: {
        id: { in: variantIds },
        roundId: fromRoundId,
        round: { projectId },
        status: { not: 'ARCHIVED' },
      },
      include: { stories: { select: { id: true } } },
    })
    if (variants.length !== new Set(variantIds).size) {
      throw new ConflictException(
        'carryForwardVariantIds must be non-archived variants of the round being iterated.',
      )
    }
    const created: string[] = []
    for (const variant of variants) {
      const copy = await tx.uIVariant.create({
        data: {
          roundId: toRoundId,
          parentVariantId: variant.id,
          name: variant.name,
          label: variant.label,
          uiLibrary: variant.uiLibrary,
          html: variant.html,
          design: (variant.design as Prisma.InputJsonObject) ?? Prisma.DbNull,
          accessibility: variant.accessibility as Prisma.InputJsonObject,
          status: 'READY',
          stories: { connect: variant.stories },
        },
        select: { id: true },
      })
      created.push(copy.id)
    }

    return created
  }

  private toAddressed(theme: ThemeRow): AddressedThemeDto {
    return {
      themeId: theme.id,
      title: theme.title,
      summary: theme.summary,
      category: theme.category,
      severity: theme.severity,
      designerNote: theme.designerNote,
      feedbackCount: theme._count.feedback,
    }
  }
}
