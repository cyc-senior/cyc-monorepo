import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'

import { recordDecision } from '../../common/decisions'
import { lockKey } from '../../common/db-lock'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateDesignRoundDto,
  DesignRoundDto,
  DesignRoundQueryDto,
  UpdateDesignRoundDto,
} from './dto/design-round.dto'
import { createNextRound } from './round-state'

@Injectable()
export class RoundsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    projectId: string,
    query: DesignRoundQueryDto,
  ): Promise<Page<DesignRoundDto>> {
    const where: Prisma.DesignRoundWhereInput = {
      projectId,
      status: query.status,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.designRound.findMany({
          where,
          orderBy: { roundNumber: 'desc' },
          ...page,
        }),
      () => this.prisma.designRound.count({ where }),
    )
  }

  /** Creates the next round; numbers are sequential per project. */
  async create(
    projectId: string,
    dto: CreateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    if (dto.parentRoundId) {
      await this.get(projectId, dto.parentRoundId)
    }

    return this.prisma.$transaction((tx) =>
      createNextRound(tx, projectId, {
        title: dto.title,
        parentRoundId: dto.parentRoundId,
      }),
    )
  }

  get(projectId: string, id: string): Promise<DesignRoundDto> {
    return this.prisma.designRound.findFirstOrThrow({
      where: { id, projectId },
    })
  }

  /**
   * Updates title, parent or status.
   *
   * @throws BadRequestException when asked to set APPROVED, or a parent that is
   *   not an earlier round of the project.
   * @throws ConflictException when the round is approved (frozen apart from
   *   archiving).
   */
  async update(
    projectId: string,
    id: string,
    dto: UpdateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    const round = await this.get(projectId, id)

    if (dto.status === 'APPROVED') {
      throw new BadRequestException(
        'Use the approve endpoint to approve a round.',
      )
    }
    const approved = round.status === 'APPROVED' || round.approvedAt !== null
    if (approved && !this.isArchiveOnly(dto)) {
      throw new ConflictException(
        'An approved round is frozen; it can only be archived.',
      )
    }
    if (dto.parentRoundId) {
      const parent = await this.get(projectId, dto.parentRoundId)
      if (parent.roundNumber >= round.roundNumber) {
        throw new BadRequestException(
          'The parent must be an earlier round of the project.',
        )
      }
    }

    return this.prisma.designRound.update({ where: { id }, data: dto })
  }

  /**
   * Approves the round once; it is frozen afterwards and becomes visible to
   * stakeholders (client, developer, project manager). The approval is
   * recorded in the decision history in the same transaction.
   *
   * @throws ConflictException when already approved/archived, or while a test
   *   session of the round is still running.
   */
  async approve(
    projectId: string,
    id: string,
    userId: string,
  ): Promise<DesignRoundDto> {
    await this.get(projectId, id)

    await this.prisma.$transaction(async (tx) => {
      const running = await tx.testSession.count({
        where: { roundId: id, status: 'ACTIVE' },
      })
      if (running > 0) {
        throw new ConflictException(
          'End the round’s running test sessions before approving it.',
        )
      }
      // Conditional update: two concurrent approvals cannot both succeed.
      const claimed = await tx.designRound.updateMany({
        where: { id, projectId, status: { notIn: ['APPROVED', 'ARCHIVED'] } },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      })
      if (claimed.count === 0) {
        throw new ConflictException(
          'The round is already approved or archived.',
        )
      }
      await recordDecision(tx, {
        projectId,
        roundId: id,
        type: 'ROUND_APPROVED',
        decidedById: userId,
      })
    })

    return this.get(projectId, id)
  }

  /**
   * Deletes the round with its jobs and variants.
   *
   * @throws ConflictException for an approved round, one with test sessions,
   *   or the project's last one.
   */
  async remove(projectId: string, id: string): Promise<void> {
    const round = await this.get(projectId, id)
    if (round.approvedAt) {
      throw new ConflictException('An approved round cannot be deleted.')
    }
    const sessions = await this.prisma.testSession.count({
      where: { roundId: id },
    })
    if (sessions > 0) {
      // Test results are research data; archive the round instead.
      throw new ConflictException(
        'A round with test sessions cannot be deleted; archive it instead.',
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `project-rounds:${projectId}`)
      if ((await tx.designRound.count({ where: { projectId } })) <= 1) {
        throw new ConflictException('A project must keep at least one round.')
      }
      await tx.designRound.delete({ where: { id } })
    })
  }

  private isArchiveOnly(dto: UpdateDesignRoundDto): boolean {
    const fields = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    )

    return fields.length === 1 && dto.status === 'ARCHIVED'
  }
}
