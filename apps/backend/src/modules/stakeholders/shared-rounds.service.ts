import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateRoundCommentDto,
  RoundCommentDto,
  SharedRoundDetailDto,
  SharedRoundDto,
} from './dto/stakeholder.dto'

const LIST_INCLUDE = (userId: string) =>
  ({
    variants: {
      where: { status: 'APPROVED' },
      select: {
        id: true,
        label: true,
        name: true,
        uiLibrary: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    },
    _count: { select: { acknowledgements: true, comments: true } },
    acknowledgements: { where: { userId }, select: { userId: true } },
  }) satisfies Prisma.DesignRoundInclude

type SharedRow = Prisma.DesignRoundGetPayload<{
  include: ReturnType<typeof LIST_INCLUDE>
}>

/**
 * What stakeholders see of a round: only APPROVED rounds (a designer's
 * decision to share) and only their APPROVED variants. Drafts, generation
 * inputs, test results and analysis never appear here. Every lookup goes
 * through the project and requires the round to be approved, so an id of a
 * draft round is a 404.
 */
@Injectable()
export class SharedRoundsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    projectId: string,
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Page<SharedRoundDto>> {
    const where: Prisma.DesignRoundWhereInput = {
      projectId,
      status: 'APPROVED',
    }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.designRound.findMany({
          where,
          include: LIST_INCLUDE(userId),
          orderBy: { roundNumber: 'desc' },
          ...page,
        })

        return rows.map((row) => this.toDto(row))
      },
      () => this.prisma.designRound.count({ where }),
    )
  }

  async get(
    projectId: string,
    userId: string,
    roundId: string,
  ): Promise<SharedRoundDetailDto> {
    const row = await this.shared(projectId, userId, roundId)
    const variants = await this.prisma.uIVariant.findMany({
      where: { roundId, status: 'APPROVED' },
      select: {
        id: true,
        label: true,
        name: true,
        uiLibrary: true,
        status: true,
        html: true,
        design: true,
        accessibility: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      ...this.toDto(row),
      prototypes: variants,
    }
  }

  /** Idempotent: acknowledging twice keeps the first time. */
  async acknowledge(
    projectId: string,
    userId: string,
    roundId: string,
  ): Promise<SharedRoundDto> {
    await this.shared(projectId, userId, roundId)
    await this.prisma.roundAcknowledgement.upsert({
      where: { roundId_userId: { roundId, userId } },
      create: { roundId, userId },
      update: {},
    })

    return this.toDto(await this.shared(projectId, userId, roundId))
  }

  async comments(
    projectId: string,
    userId: string,
    roundId: string,
    query: PaginationQueryDto,
  ): Promise<Page<RoundCommentDto>> {
    await this.shared(projectId, userId, roundId)
    const where = { roundId }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.roundComment.findMany({
          where,
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
          ...page,
        })

        return rows.map(({ authorId, ...row }) => {
          void authorId

          return row
        })
      },
      () => this.prisma.roundComment.count({ where }),
    )
  }

  async comment(
    projectId: string,
    userId: string,
    roundId: string,
    dto: CreateRoundCommentDto,
  ): Promise<RoundCommentDto> {
    await this.shared(projectId, userId, roundId)
    const { authorId, ...comment } = await this.prisma.roundComment.create({
      data: { roundId, authorId: userId, body: dto.body.trim() },
      include: { author: { select: { id: true, name: true } } },
    })
    void authorId

    return comment
  }

  /** The approved round of the project, or 404. */
  private async shared(
    projectId: string,
    userId: string,
    roundId: string,
  ): Promise<SharedRow> {
    const row = await this.prisma.designRound.findFirst({
      where: { id: roundId, projectId },
      include: LIST_INCLUDE(userId),
    })
    if (!row || row.status === 'DRAFT' || row.status === 'ARCHIVED') {
      throw new NotFoundException('Round not found.')
    }
    if (!row.approvedAt) {
      throw new ConflictException('Round is not approved.')
    }

    return row
  }

  private toDto(row: SharedRow): SharedRoundDto {
    return {
      id: row.id,
      roundNumber: row.roundNumber,
      title: row.title,
      approvedAt: row.approvedAt as Date,
      variants: row.variants,
      acknowledgementCount: row._count.acknowledgements,
      commentCount: row._count.comments,
      acknowledgedByMe: row.acknowledgements.length > 0,
    }
  }
}
