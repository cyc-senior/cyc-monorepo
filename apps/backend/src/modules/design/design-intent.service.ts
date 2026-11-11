import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { DesignIntentDto, PutDesignIntentDto } from './dto/design-intent.dto'

@Injectable()
export class DesignIntentService {
  constructor(private readonly prisma: PrismaService) {}

  /** @throws NotFoundException while the intent has not been defined. */
  async get(projectId: string): Promise<DesignIntentDto> {
    const intent = await this.prisma.designIntent.findUnique({
      where: { projectId },
    })
    if (!intent) {
      throw new NotFoundException(
        'The design intent of this project has not been defined yet.',
      )
    }

    return intent
  }

  /**
   * Defines or replaces the design intent. Omitted optional fields are
   * cleared; `version` goes up on every change so generation jobs can tell
   * which intent they were made from.
   */
  put(projectId: string, dto: PutDesignIntentDto): Promise<DesignIntentDto> {
    const data = {
      statement: dto.statement ?? null,
      designSystem: dto.designSystem,
      designStandards: dto.designStandards ?? ['WCAG 2.1 AA'],
      designGuidelines: dto.designGuidelines ?? null,
      primaryColor: dto.primaryColor.toUpperCase(),
      secondaryColor: dto.secondaryColor.toUpperCase(),
      accentColor: dto.accentColor.toUpperCase(),
      brandGuidelines: dto.brandGuidelines ?? null,
      toneOfVoice: dto.toneOfVoice ?? null,
    }

    return this.prisma.designIntent.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: { ...data, version: { increment: 1 } },
    })
  }
}
