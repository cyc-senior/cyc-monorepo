import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { inProject } from '../../common/scopes'
import { Prisma, UiLibrary } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  accessibilityReport,
  checkDesign,
} from '../design/document/check-design'
import { UI_KITS } from '../design/document/ui-kits'
import {
  CreateUIVariantDto,
  UIVariantDto,
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
    const { uiLibrary } = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { uiLibrary: true },
    })
    const { storyIds, design, ...fields } = dto
    const checked = this.checked(design, uiLibrary)
    await this.assertStoriesInProject(projectId, storyIds)

    const variant = await this.prisma.uIVariant.create({
      data: {
        ...fields,
        ...checked,
        roundId,
        uiLibrary,
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
   * `design` is checked against the variant's UI kit.
   */
  async update(
    projectId: string,
    id: string,
    dto: UpdateUIVariantDto,
  ): Promise<UIVariantDto> {
    const current = await this.get(projectId, id)
    await requireWritableRound(this.prisma, projectId, current.roundId)
    const { storyIds, design, ...fields } = dto
    const checked =
      design === undefined ? {} : this.checked(design, current.uiLibrary)
    await this.assertStoriesInProject(projectId, storyIds)

    const variant = await this.prisma.uIVariant.update({
      where: { id },
      data: {
        ...fields,
        ...checked,
        version: { increment: 1 },
        stories: storyIds && {
          set: storyIds.map((storyId) => ({ id: storyId })),
        },
      },
      include: WITH_STORIES,
    })

    return this.toDto(variant)
  }

  async remove(projectId: string, id: string): Promise<void> {
    await this.get(projectId, id)
    await this.prisma.uIVariant.delete({ where: { id } })
  }

  /**
   * Validates a design for the kit and returns it with its accessibility
   * report.
   *
   * @throws UnprocessableEntityException listing the issues when it fails the
   *   UI kit guardrail or WCAG 2.0 AA.
   */
  private checked(design: unknown, uiLibrary: UiLibrary) {
    const check = checkDesign(design, UI_KITS[uiLibrary])
    if (!check.passed || !check.document) {
      throw new UnprocessableEntityException({
        message: 'The design does not pass the UI kit and WCAG 2.0 AA checks.',
        issues: check.issues.filter((issue) => issue.severity === 'error'),
      })
    }

    return {
      design: check.document as unknown as Prisma.InputJsonObject,
      accessibility: accessibilityReport(
        check,
      ) as unknown as Prisma.InputJsonObject,
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
