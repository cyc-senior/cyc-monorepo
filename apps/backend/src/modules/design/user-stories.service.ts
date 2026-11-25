import { Injectable } from '@nestjs/common'

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

function toDto({ rounds, ...story }: StoryWithCycle): UserStoryDto {
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

  return { ...story, designCycle }
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
    return toDto(
      await this.prisma.userStory.create({
        data: { ...dto, projectId },
        include: WITH_CYCLE,
      }),
    )
  }

  async get(projectId: string, id: string): Promise<UserStoryDto> {
    return toDto(
      await this.prisma.userStory.findFirstOrThrow({
        where: { id, projectId },
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

    const { draftPrompt, ...rest } = dto
    return toDto(
      await this.prisma.userStory.update({
        where: { id },
        data: {
          ...rest,
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

  async remove(projectId: string, id: string): Promise<void> {
    await this.get(projectId, id)
    await this.prisma.userStory.delete({ where: { id } })
  }
}
