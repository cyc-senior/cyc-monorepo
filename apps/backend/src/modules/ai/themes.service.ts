import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'

import { recordDecision } from '../../common/decisions'
import { lockKey } from '../../common/db-lock'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { FeedbackSeverity, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateThemeDto,
  MergeThemesDto,
  SplitThemeDto,
  ThemeDto,
  ThemeQueryDto,
  UpdateThemeDto,
} from './dto/analysis.dto'

const WITH_FEEDBACK = {
  feedback: { select: { feedbackId: true } },
} satisfies Prisma.FeedbackThemeInclude

type ThemeRow = Prisma.FeedbackThemeGetPayload<{
  include: typeof WITH_FEEDBACK
}>

const SEVERITY_ORDER: FeedbackSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

/**
 * The designer's review of an analysis: edit, accept/reject, split, merge,
 * add, mark won't-fix, select for the next iteration. The AI's own values
 * (`ai*` columns) and the participants' raw feedback are never touched; what
 * changes is the grouping and the designer's wording on top of them.
 *
 * Every operation is scoped to an analysis of the project and serialized by a
 * per-analysis lock, so concurrent edits cannot interleave.
 */
@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    projectId: string,
    analysisId: string,
    query: ThemeQueryDto,
  ): Promise<Page<ThemeDto>> {
    await this.analysis(this.prisma, projectId, analysisId)
    const where: Prisma.FeedbackThemeWhereInput = {
      analysisId,
      status: query.status,
      category: query.category,
      severity: query.severity,
    }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.feedbackTheme.findMany({
          where,
          include: WITH_FEEDBACK,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          ...page,
        })

        return rows.map((row) => this.toDto(row))
      },
      () => this.prisma.feedbackTheme.count({ where }),
    )
  }

  async get(
    projectId: string,
    analysisId: string,
    id: string,
  ): Promise<ThemeDto> {
    await this.analysis(this.prisma, projectId, analysisId)

    return this.toDto(await this.findTheme(this.prisma, analysisId, id))
  }

  /** A theme the designer writes themselves, from feedback of the analysis. */
  create(
    projectId: string,
    analysisId: string,
    dto: CreateThemeDto,
  ): Promise<ThemeDto> {
    return this.inReview(projectId, analysisId, async (tx, analysis) => {
      const feedbackIds = this.inputIds(
        analysis.inputFeedbackIds,
        dto.feedbackIds,
      )
      const theme = await tx.feedbackTheme.create({
        data: {
          analysisId,
          origin: 'DESIGNER',
          status: 'ACCEPTED',
          title: dto.title,
          summary: dto.summary,
          category: dto.category,
          severity: dto.severity,
          labels: dto.labels ?? [],
        },
      })
      await tx.themeFeedback.createMany({
        data: feedbackIds.map((feedbackId) => ({
          themeId: theme.id,
          feedbackId,
        })),
      })

      return this.toDto(await this.findTheme(tx, analysisId, theme.id))
    })
  }

  update(
    projectId: string,
    analysisId: string,
    id: string,
    dto: UpdateThemeDto,
  ): Promise<ThemeDto> {
    return this.inReview(projectId, analysisId, async (tx) => {
      const theme = await this.findTheme(tx, analysisId, id)
      this.assertOpen(theme)
      await tx.feedbackTheme.update({ where: { id }, data: dto })

      return this.toDto(await this.findTheme(tx, analysisId, id))
    })
  }

  /** Folds several themes into one new theme; the originals stay as MERGED. */
  merge(
    projectId: string,
    analysisId: string,
    dto: MergeThemesDto,
  ): Promise<ThemeDto> {
    return this.inReview(projectId, analysisId, async (tx) => {
      const themes = await tx.feedbackTheme.findMany({
        where: { analysisId, id: { in: dto.themeIds } },
        include: WITH_FEEDBACK,
      })
      if (themes.length !== dto.themeIds.length) {
        throw new BadRequestException(
          'themeIds must be themes of this analysis.',
        )
      }
      themes.forEach((theme) => this.assertOpen(theme))
      const ordered = dto.themeIds.map(
        (id) => themes.find((theme) => theme.id === id) as ThemeRow,
      )
      const first = ordered[0]
      const severity = ordered
        .map((theme) => theme.severity)
        .sort(
          (a, b) => SEVERITY_ORDER.indexOf(b) - SEVERITY_ORDER.indexOf(a),
        )[0]

      const merged = await tx.feedbackTheme.create({
        data: {
          analysisId,
          origin: 'DESIGNER',
          status: 'ACCEPTED',
          title: dto.title ?? first.title,
          summary:
            dto.summary ?? ordered.map((theme) => theme.summary).join(' '),
          category: first.category,
          severity,
          labels: [...new Set(ordered.flatMap((theme) => theme.labels))].slice(
            0,
            6,
          ),
        },
      })
      const feedbackIds = [
        ...new Set(
          ordered.flatMap((theme) => theme.feedback.map((f) => f.feedbackId)),
        ),
      ]
      await tx.themeFeedback.createMany({
        data: feedbackIds.map((feedbackId) => ({
          themeId: merged.id,
          feedbackId,
        })),
      })
      await tx.feedbackTheme.updateMany({
        where: { id: { in: dto.themeIds } },
        data: {
          status: 'MERGED',
          mergedIntoId: merged.id,
          selectedForIteration: false,
          selectedAt: null,
        },
      })

      return this.toDto(await this.findTheme(tx, analysisId, merged.id))
    })
  }

  /** Moves some of a theme's feedback into a new theme. */
  split(
    projectId: string,
    analysisId: string,
    id: string,
    dto: SplitThemeDto,
  ): Promise<ThemeDto> {
    return this.inReview(projectId, analysisId, async (tx) => {
      const theme = await this.findTheme(tx, analysisId, id)
      this.assertOpen(theme)
      const own = new Set(theme.feedback.map((f) => f.feedbackId))
      if (!dto.feedbackIds.every((feedbackId) => own.has(feedbackId))) {
        throw new BadRequestException(
          'feedbackIds must all belong to the theme being split.',
        )
      }
      if (dto.feedbackIds.length >= own.size) {
        throw new BadRequestException(
          'Leave at least one feedback item in the original theme.',
        )
      }

      const created = await tx.feedbackTheme.create({
        data: {
          analysisId,
          origin: 'DESIGNER',
          status: 'ACCEPTED',
          title: dto.title,
          summary: dto.summary ?? theme.summary,
          category: theme.category,
          severity: theme.severity,
          labels: theme.labels,
        },
      })
      await tx.themeFeedback.deleteMany({
        where: { themeId: id, feedbackId: { in: dto.feedbackIds } },
      })
      await tx.themeFeedback.createMany({
        data: dto.feedbackIds.map((feedbackId) => ({
          themeId: created.id,
          feedbackId,
        })),
      })

      return this.toDto(await this.findTheme(tx, analysisId, created.id))
    })
  }

  /**
   * Records the decision not to fix this. The reason is mandatory and becomes
   * part of the decision history. Allowed while reviewing and after approval.
   */
  async wontFix(
    projectId: string,
    analysisId: string,
    id: string,
    userId: string,
    reason: string,
  ): Promise<ThemeDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `analysis:${analysisId}`)
      const analysis = await this.analysis(tx, projectId, analysisId)
      if (analysis.status !== 'READY' && analysis.status !== 'APPROVED') {
        throw new ConflictException(
          'Decisions can only be made on a READY or APPROVED analysis.',
        )
      }
      const theme = await this.findTheme(tx, analysisId, id)
      if (theme.status === 'MERGED') {
        throw new ConflictException('This theme was merged into another.')
      }
      await tx.feedbackTheme.update({
        where: { id },
        data: {
          status: 'WONT_FIX',
          wontFixReason: reason,
          selectedForIteration: false,
          selectedAt: null,
        },
      })
      await recordDecision(tx, {
        projectId,
        roundId: analysis.roundId,
        type: 'FEEDBACK_WONT_FIX',
        analysisId,
        themeId: id,
        decidedById: userId,
        rationale: reason,
      })

      return this.toDto(await this.findTheme(tx, analysisId, id))
    })
  }

  /**
   * Selects an ACCEPTED theme of an APPROVED analysis for the next iteration.
   * The AI never selects; only this call does.
   */
  select(
    projectId: string,
    analysisId: string,
    id: string,
    userId: string,
    rationale?: string,
  ): Promise<ThemeDto> {
    return this.setSelected(projectId, analysisId, id, userId, true, rationale)
  }

  deselect(
    projectId: string,
    analysisId: string,
    id: string,
    userId: string,
    rationale?: string,
  ): Promise<ThemeDto> {
    return this.setSelected(projectId, analysisId, id, userId, false, rationale)
  }

  private setSelected(
    projectId: string,
    analysisId: string,
    id: string,
    userId: string,
    selected: boolean,
    rationale?: string,
  ): Promise<ThemeDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `analysis:${analysisId}`)
      const analysis = await this.analysis(tx, projectId, analysisId)
      if (analysis.status !== 'APPROVED') {
        throw new ConflictException(
          'Approve the analysis before selecting feedback for the next iteration.',
        )
      }
      const theme = await this.findTheme(tx, analysisId, id)
      if (selected && theme.status !== 'ACCEPTED') {
        throw new ConflictException('Only an ACCEPTED theme can be selected.')
      }
      await tx.feedbackTheme.update({
        where: { id },
        data: {
          selectedForIteration: selected,
          selectedAt: selected ? new Date() : null,
        },
      })
      await recordDecision(tx, {
        projectId,
        roundId: analysis.roundId,
        type: selected ? 'FEEDBACK_SELECTED' : 'FEEDBACK_DESELECTED',
        analysisId,
        themeId: id,
        decidedById: userId,
        rationale,
      })

      return this.toDto(await this.findTheme(tx, analysisId, id))
    })
  }

  /**
   * Runs `work` in a transaction under the analysis lock, only while the
   * analysis awaits review (READY): after that its content is the record of
   * what the designer approved.
   */
  private inReview<T>(
    projectId: string,
    analysisId: string,
    work: (
      tx: Prisma.TransactionClient,
      analysis: Awaited<ReturnType<ThemesService['analysis']>>,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `analysis:${analysisId}`)
      const analysis = await this.analysis(tx, projectId, analysisId)
      if (analysis.status !== 'READY') {
        throw new ConflictException(
          'Themes can only be changed while the analysis awaits review (READY).',
        )
      }

      return work(tx, analysis)
    })
  }

  private analysis(
    db: Prisma.TransactionClient | PrismaService,
    projectId: string,
    analysisId: string,
  ) {
    return db.feedbackAnalysis.findFirstOrThrow({
      where: { id: analysisId, projectId },
      select: {
        id: true,
        roundId: true,
        status: true,
        inputFeedbackIds: true,
      },
    })
  }

  private findTheme(
    db: Prisma.TransactionClient | PrismaService,
    analysisId: string,
    id: string,
  ) {
    return db.feedbackTheme.findFirstOrThrow({
      where: { id, analysisId },
      include: WITH_FEEDBACK,
    })
  }

  private assertOpen(theme: ThemeRow): void {
    if (theme.status === 'MERGED') {
      throw new ConflictException('This theme was merged into another.')
    }
  }

  /** Feedback ids must be among those the analysis was created from. */
  private inputIds(input: Prisma.JsonValue, requested: string[]): string[] {
    const allowed = new Set(input as string[])
    if (!requested.every((id) => allowed.has(id))) {
      throw new BadRequestException(
        'feedbackIds must all be feedback covered by this analysis.',
      )
    }

    return [...new Set(requested)]
  }

  private toDto({ feedback, ...theme }: ThemeRow): ThemeDto {
    return { ...theme, feedbackIds: feedback.map((f) => f.feedbackId) }
  }
}
