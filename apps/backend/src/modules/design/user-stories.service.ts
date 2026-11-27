import { BadRequestException, Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateUserStoryDto,
  StoryDesignCycleDto,
  UpdateUserStoryDto,
  UserStoryDto,
  UserStoryQueryDto,
} from './dto/user-story.dto'

/** The latest design round of a story, with what its design cycle needs. */
const WITH_CYCLE = {
  personas: { select: { personaId: true }, orderBy: { createdAt: 'asc' } },
  rounds: {
    orderBy: { roundNumber: 'desc' },
    take: 1,
    select: {
      id: true,
      roundNumber: true,
      status: true,
      variants: {
        where: { status: { not: 'ARCHIVED' } },
        select: { status: true },
      },
      generationJobs: {
        where: { status: { in: ['QUEUED', 'RUNNING'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, baseVariantId: true },
      },
    },
  },
} satisfies Prisma.UserStoryInclude

type StoryWithCycle = Prisma.UserStoryGetPayload<{ include: typeof WITH_CYCLE }>

function toDto({ rounds, personas, ...story }: StoryWithCycle): UserStoryDto {
  const round = rounds[0]
  const designCycle: StoryDesignCycleDto | null = round
    ? {
        roundId: round.id,
        roundNumber: round.roundNumber,
        roundStatus: round.status,
        variantCount: round.variants.length,
        approvedCount: round.variants.filter((v) => v.status === 'APPROVED')
          .length,
        activeJob: round.generationJobs[0]
          ? {
              id: round.generationJobs[0].id,
              status: round.generationJobs[0].status,
              refinement: round.generationJobs[0].baseVariantId !== null,
            }
          : null,
      }
    : null

  return {
    ...story,
    personaIds: personas.map((p) => p.personaId),
    designCycle,
  }
}

@Injectable()
export class UserStoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    projectId: string,
    query: UserStoryQueryDto,
  ): Promise<Page<UserStoryDto>> {
    const where: Prisma.UserStoryWhereInput = {
      projectId,
      status: query.status,
      deletedAt: null,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.userStory
          .findMany({
            where,
            include: WITH_CYCLE,
            orderBy: { createdAt: 'desc' },
            ...page,
          })
          .then((stories) => stories.map(toDto)),
      () => this.prisma.userStory.count({ where }),
    )
  }

  async create(
    projectId: string,
    dto: CreateUserStoryDto,
  ): Promise<UserStoryDto> {
    const { personaIds, ...data } = dto
    const personas = await this.personaLinks(projectId, personaIds)
    return toDto(
      await this.prisma.userStory.create({
        data: {
          ...data,
          projectId,
          ...(personas ? { personas: { create: personas } } : {}),
        },
        include: WITH_CYCLE,
      }),
    )
  }

  /**
   * The story-persona links for `personaIds` (deduplicated), or undefined to
   * leave them unchanged.
   * @throws BadRequestException if a persona is not of this project.
   */
  private async personaLinks(
    projectId: string,
    personaIds: string[] | undefined,
  ): Promise<Array<{ personaId: string }> | undefined> {
    if (personaIds === undefined) return undefined
    const unique = [...new Set(personaIds)]
    if (unique.length > 0) {
      const found = await this.prisma.userPersona.count({
        where: { projectId, id: { in: unique } },
      })
      if (found !== unique.length) {
        throw new BadRequestException(
          'personaIds must all be user personas of this project.',
        )
      }
    }
    return unique.map((personaId) => ({ personaId }))
  }

  async get(projectId: string, id: string): Promise<UserStoryDto> {
    return toDto(
      await this.prisma.userStory.findFirstOrThrow({
        where: { id, projectId, deletedAt: null },
        include: WITH_CYCLE,
      }),
    )
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateUserStoryDto,
  ): Promise<UserStoryDto> {
    await this.get(projectId, id)

    const { draftPrompt, personaIds, ...rest } = dto
    const personas = await this.personaLinks(projectId, personaIds)
    return toDto(
      await this.prisma.userStory.update({
        where: { id },
        data: {
          ...rest,
          ...(personas ? { personas: { deleteMany: {}, create: personas } } : {}),
          ...(draftPrompt === undefined
            ? {}
            : {
                draftPrompt:
                  draftPrompt === null
                    ? Prisma.JsonNull
                    : (draftPrompt as Prisma.InputJsonValue),
              }),
        },
        include: WITH_CYCLE,
      }),
    )
  }

  /**
   * Soft delete: the story (and its rounds, from the design pages) is hidden
   * but kept for a future recycle bin. Its queued or running generations are
   * cancelled so no more LLM work is done for it; the worker aborts on its
   * next cancellation check.
   */
  async remove(projectId: string, id: string, userId: string): Promise<void> {
    await this.get(projectId, id)
    await this.prisma.$transaction([
      this.prisma.userStory.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: userId },
      }),
      this.prisma.generationJob.updateMany({
        where: {
          round: { storyId: id, projectId },
          status: { in: ['QUEUED', 'RUNNING'] },
        },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      }),
    ])
  }
}
