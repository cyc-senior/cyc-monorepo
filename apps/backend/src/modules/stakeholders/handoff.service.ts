import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { accessibilitySummary, elementUsage } from './design-insights'
import {
  HandoffDto,
  HandoffSpecDto,
  HandoffVariantDto,
} from './dto/stakeholder.dto'

/** Approved rounds shown in one handoff. */
const MAX_ROUNDS = 50

/**
 * The development handoff: what a developer needs to build the approved
 * designs — design system, platforms, brand colors, the HTML itself, which
 * elements each design uses, and the technical risks left in it. Approved rounds and approved variants only.
 */
@Injectable()
export class HandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async handoff(projectId: string): Promise<HandoffDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { platforms: true, designIntent: true },
    })
    const intent = project.designIntent
    const rounds = await this.prisma.designRound.findMany({
      where: { projectId, status: 'APPROVED' },
      include: {
        variants: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { roundNumber: 'desc' },
      take: MAX_ROUNDS,
    })

    return {
      designSystem: intent?.designSystem ?? null,
      designStandards: intent?.designStandards ?? [],
      platforms: project.platforms,
      brandColors: {
        primary: intent?.primaryColor ?? null,
        secondary: intent?.secondaryColor ?? null,
        accent: intent?.accentColor ?? null,
      },
      brandGuidelines: intent?.brandGuidelines ?? null,
      rounds: rounds.map((round) => ({
        id: round.id,
        roundNumber: round.roundNumber,
        title: round.title,
        approvedAt: round.approvedAt as Date,
        variants: round.variants.map((variant) => this.toHandoff(variant)),
      })),
    }
  }

  /** The full specification of one approved variant of an approved round. */
  async spec(projectId: string, variantId: string): Promise<HandoffSpecDto> {
    const variant = await this.prisma.uIVariant.findFirstOrThrow({
      where: {
        id: variantId,
        status: 'APPROVED',
        round: { projectId, status: 'APPROVED' },
      },
    })

    return {
      ...this.toHandoff(variant),
      roundId: variant.roundId,
      html: variant.html,
      design: variant.design,
      accessibilityReport: variant.accessibility,
    }
  }

  private toHandoff(variant: {
    id: string
    label: string | null
    name: string
    uiLibrary: HandoffVariantDto['uiLibrary']
    html: string | null
    accessibility: unknown
  }): HandoffVariantDto {
    const accessibility = accessibilitySummary(variant.accessibility)
    const { warningMessages, ...summary } = accessibility

    return {
      id: variant.id,
      label: variant.label,
      name: variant.name,
      uiLibrary: variant.uiLibrary,
      format: variant.html ? 'HTML' : 'LEGACY_JSON',
      elementUsage: elementUsage(variant.html),
      accessibility: summary,
      technicalRisks: [
        ...warningMessages,
        ...summary.autoFixed.map((fix) => `Auto-fixed: ${fix}`),
      ],
    }
  }
}
