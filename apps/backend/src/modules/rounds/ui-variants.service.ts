import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'

import { recordDecision } from '../../common/decisions'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { inProject } from '../../common/scopes'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { checkHtml } from '../design/html/check-html'
import {
  CreateUIVariantDto,
  UIVariantDto,
  UIVariantHistoryDto,
  UIVariantQueryDto,
  UpdateUIVariantDto,
} from './dto/ui-variant.dto'
import { requireWritableRound } from './round-state'

const WITH_STORIES = {
  stories: { select: { id: true } },
} satisfies Prisma.UIVariantInclude

type VariantWithStories = Prisma.UIVariantGetPayload<{
  include: typeof WITH_STORIES
}>

@Injectable()
export class UIVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    projectId: string,
    roundId: string,
    query: UIVariantQueryDto,
  ): Promise<Page<UIVariantDto>> {
    await this.prisma.designRound.findFirstOrThrow({
      where: { id: roundId, projectId },
    })
    const where: Prisma.UIVariantWhereInput = { roundId, status: query.status }

    return paginate(
      query,
      async (page) => {
        const variants = await this.prisma.uIVariant.findMany({
          where,
          include: WITH_STORIES,
          orderBy: { createdAt: 'asc' },
          ...page,
        })

        return variants.map((variant) => this.toDto(variant))
      },
      () => this.prisma.uIVariant.count({ where }),
    )
  }

  async create(
    projectId: string,
    roundId: string,
    dto: CreateUIVariantDto,
  ): Promise<UIVariantDto> {
    await requireWritableRound(this.prisma, projectId, roundId)
    const context = await this.context(projectId)
    const { storyIds, html, ...fields } = dto
    const checked = this.checked(html, context)
    await this.assertStoriesInProject(projectId, storyIds)

    const variant = await this.prisma.uIVariant.create({
      data: {
        ...fields,
        ...checked,
        roundId,
        uiLibrary: context.designSystem,
        stories: storyIds && { connect: storyIds.map((id) => ({ id })) },
      },
      include: WITH_STORIES,
    })

    return this.toDto(variant)
  }

  async get(projectId: string, id: string): Promise<UIVariantDto> {
    const variant = await this.prisma.uIVariant.findFirstOrThrow({
      where: { id, ...inProject.variant(projectId) },
      include: WITH_STORIES,
    })

    return this.toDto(variant)
  }

  /**
   * Applies the change and bumps `version`; `storyIds` replaces the set. A new
   * `html` is sanitized and checked again.
   */
  async update(
    projectId: string,
    id: string,
    dto: UpdateUIVariantDto,
  ): Promise<UIVariantDto> {
    const current = await this.get(projectId, id)
    await requireWritableRound(this.prisma, projectId, current.roundId)
    const { storyIds, html, ...fields } = dto
    if (html !== undefined || fields.status !== undefined) {
      // What participants test must not change under them or afterwards.
      await this.assertNotInSession(id, 'edited')
    }
    const checked =
      html === undefined
        ? {}
        : this.checked(html, await this.context(projectId))
    await this.assertStoriesInProject(projectId, storyIds)

    // A changed design is a different design: the old approval no longer applies.
    const loseApproval =
      current.status === 'APPROVED' &&
      (html !== undefined || fields.status !== undefined)
    const variant = await this.prisma.uIVariant.update({
      where: { id },
      data: {
        ...fields,
        ...checked,
        ...(loseApproval
          ? {
              status: fields.status ?? 'READY',
              approvedAt: null,
              approvedById: null,
            }
          : {}),
        version: { increment: 1 },
        stories: storyIds && {
          set: storyIds.map((storyId) => ({ id: storyId })),
        },
      },
      include: WITH_STORIES,
    })

    return this.toDto(variant)
  }

  /**
   * Approves a READY variant. Only this explicit designer action can set
   * APPROVED — generation never does — and only approved variants can be put
   * in front of testers.
   *
   * @throws ConflictException when the variant is not READY, or its round is frozen.
   */
  async approve(
    projectId: string,
    id: string,
    userId: string,
    rationale?: string,
  ): Promise<UIVariantDto> {
    const current = await this.get(projectId, id)
    await requireWritableRound(this.prisma, projectId, current.roundId)

    await this.prisma.$transaction(async (tx) => {
      // Conditional update: two concurrent approvals cannot both succeed.
      const claimed = await tx.uIVariant.updateMany({
        where: { id, status: 'READY', ...inProject.variant(projectId) },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      })
      if (claimed.count === 0) {
        throw new ConflictException(
          'Only a READY variant can be approved (it may already be approved).',
        )
      }
      await recordDecision(tx, {
        projectId,
        roundId: current.roundId,
        type: 'VARIANT_APPROVED',
        variantId: id,
        decidedById: userId,
        rationale,
      })
    })

    return this.get(projectId, id)
  }

  /** The variant and its ancestors (refinements and earlier iterations). */
  async history(projectId: string, id: string): Promise<UIVariantHistoryDto> {
    const lineage: UIVariantDto[] = []
    const seen = new Set<string>()
    let nextId: string | null = id
    while (nextId && !seen.has(nextId) && lineage.length < 50) {
      seen.add(nextId)
      const variant = await this.get(projectId, nextId)
      lineage.push(variant)
      nextId = variant.parentVariantId
    }

    return { lineage }
  }

  /**
   * @throws ConflictException when the variant is (or was) under test: test
   *   results must keep pointing at the design that was tested.
   */
  async remove(projectId: string, id: string): Promise<void> {
    await this.get(projectId, id)
    await this.assertNotInSession(id, 'deleted')
    await this.prisma.uIVariant.delete({ where: { id } })
  }

  private async assertNotInSession(
    variantId: string,
    action: string,
  ): Promise<void> {
    const sessions = await this.prisma.sessionVariant.count({
      where: { variantId },
    })
    if (sessions > 0) {
      throw new ConflictException(
        `This variant is part of a test session and cannot be ${action}. Refine it into a new variant instead.`,
      )
    }
  }

  /** What a design is checked against: the project's platforms and brand colors. */
  private async context(projectId: string) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { platforms: true, designIntent: true },
    })
    const intent = project.designIntent

    return {
      platforms: project.platforms,
      designSystem: intent?.designSystem ?? 'SHADCN',
      brandColors: [
        intent?.primaryColor,
        intent?.secondaryColor,
        intent?.accentColor,
      ].filter((color): color is string => Boolean(color)),
    }
  }

  /**
   * Sanitizes the HTML and returns it with its accessibility report.
   *
   * @throws UnprocessableEntityException listing the issues when it fails the
   *   structure, WCAG 2.1 AA markup or platform checks.
   */
  private checked(
    html: string,
    context: Awaited<ReturnType<UIVariantsService['context']>>,
  ) {
    const check = checkHtml(html, context)
    if (!check.report.passed) {
      throw new UnprocessableEntityException({
        message: 'The design does not pass the HTML and accessibility checks.',
        issues: check.report.issues.filter(
          (issue) => issue.severity === 'error',
        ),
      })
    }

    return {
      html: check.html,
      accessibility: check.report as unknown as Prisma.InputJsonObject,
    }
  }

  private async assertStoriesInProject(
    projectId: string,
    storyIds: string[] | undefined,
  ): Promise<void> {
    if (!storyIds?.length) {
      return
    }
    const unique = new Set(storyIds)
    const found = await this.prisma.userStory.count({
      where: { id: { in: [...unique] }, projectId },
    })
    if (found !== unique.size) {
      throw new BadRequestException(
        'storyIds must all be user stories of this project.',
      )
    }
  }

  private toDto({ stories, ...variant }: VariantWithStories): UIVariantDto {
    return { ...variant, storyIds: stories.map(({ id }) => id) }
  }
}
