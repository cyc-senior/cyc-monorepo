import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'

import { recordDecision } from '../../common/decisions'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma, TestSessionStatus } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { requireWritableRound } from '../rounds/round-state'
import {
  CreateTestSessionDto,
  TestSessionDto,
  TestSessionQueryDto,
  UpdateTestSessionDto,
} from './dto/test-session.dto'
import {
  DEFAULT_CONSENT_TEXT,
  DEFAULT_CONSENT_VERSION,
  MAX_SESSION_DAYS,
} from './testing.constants'

const DAY_MS = 24 * 60 * 60 * 1000
const GROUP_LABELS = 'ABCDEFGH'

const INCLUDE = {
  variants: {
    select: {
      variantId: true,
      label: true,
      variant: { select: { name: true } },
    },
    orderBy: { label: 'asc' },
  },
  _count: { select: { tasks: true, participants: true } },
} satisfies Prisma.TestSessionInclude

type SessionRow = Prisma.TestSessionGetPayload<{ include: typeof INCLUDE }>

/**
 * Designer-side lifecycle of a test session: DRAFT → ACTIVE → COMPLETED (or
 * CANCELLED). Every lookup goes through the project; only APPROVED variants
 * of a still-writable round can be tested.
 */
@Injectable()
export class TestSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    projectId: string,
    query: TestSessionQueryDto,
  ): Promise<Page<TestSessionDto>> {
    const where: Prisma.TestSessionWhereInput = {
      projectId,
      roundId: query.roundId,
      status: query.status,
    }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.testSession.findMany({
          where,
          include: INCLUDE,
          orderBy: { createdAt: 'desc' },
          ...page,
        })

        return rows.map((row) => this.toDto(row))
      },
      () => this.prisma.testSession.count({ where }),
    )
  }

  async get(projectId: string, id: string): Promise<TestSessionDto> {
    return this.toDto(await this.find(projectId, id))
  }

  /**
   * Creates a DRAFT session for approved variants of a round.
   *
   * @throws ConflictException when the round is frozen.
   * @throws BadRequestException when a variant is not an APPROVED variant of the round.
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreateTestSessionDto,
  ): Promise<TestSessionDto> {
    await requireWritableRound(this.prisma, projectId, dto.roundId)
    this.assertFutureDeadline(dto.expiresAt)
    this.assertWindow(dto.startsAt, dto.expiresAt)
    const approved = await this.prisma.uIVariant.findMany({
      where: {
        id: { in: dto.variantIds },
        roundId: dto.roundId,
        status: 'APPROVED',
      },
      select: { id: true },
    })
    if (approved.length !== dto.variantIds.length) {
      throw new BadRequestException(
        'variantIds must all be APPROVED variants of the round. Approve a variant before testing it.',
      )
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const session = await tx.testSession.create({
        data: {
          projectId,
          roundId: dto.roundId,
          title: dto.title,
          description: dto.description,
          consentVersion: dto.consentVersion ?? DEFAULT_CONSENT_VERSION,
          consentText: dto.consentText ?? DEFAULT_CONSENT_TEXT,
          startsAt: dto.startsAt,
          expiresAt: dto.expiresAt,
          createdById: userId,
        },
        select: { id: true },
      })
      await tx.sessionVariant.createMany({
        data: dto.variantIds.map((variantId, index) => ({
          sessionId: session.id,
          roundId: dto.roundId,
          variantId,
          label: GROUP_LABELS[index],
        })),
      })

      return session.id
    })

    return this.get(projectId, id)
  }

  /**
   * Drafts can change freely. Once active only the title, description and
   * deadline can change: the consent text and the variants are what
   * participants already agreed to and are testing.
   */
  async update(
    projectId: string,
    id: string,
    dto: UpdateTestSessionDto,
  ): Promise<TestSessionDto> {
    const session = await this.find(projectId, id)
    if (session.status !== 'DRAFT' && session.status !== 'ACTIVE') {
      throw new ConflictException(
        `A ${session.status.toLowerCase()} session can no longer be changed.`,
      )
    }
    const frozen = [dto.consentText, dto.consentVersion, dto.startsAt].some(
      (value) => value !== undefined,
    )
    if (session.status === 'ACTIVE' && frozen) {
      throw new ConflictException(
        'Consent and start time cannot change once the session is active.',
      )
    }
    this.assertFutureDeadline(dto.expiresAt)
    const startsAt = dto.startsAt ?? session.startsAt ?? undefined
    const expiresAt = dto.expiresAt ?? session.expiresAt ?? undefined
    this.assertWindow(startsAt, expiresAt, session.activatedAt ?? undefined)

    await this.prisma.testSession.update({ where: { id }, data: dto })

    return this.get(projectId, id)
  }

  /**
   * Opens the session to its participants.
   *
   * @throws ConflictException when it is not a draft.
   * @throws BadRequestException without a future deadline or without tasks.
   */
  async activate(projectId: string, id: string): Promise<TestSessionDto> {
    const session = await this.find(projectId, id)
    const now = new Date()
    if (!session.expiresAt || session.expiresAt <= now) {
      throw new BadRequestException(
        'Set a deadline (expiresAt) in the future before activating.',
      )
    }
    if (session._count.tasks === 0) {
      throw new BadRequestException('Add at least one task before activating.')
    }
    this.assertWindow(session.startsAt ?? now, session.expiresAt, now)

    await this.prisma.$transaction(async (tx) => {
      // Variants are re-checked: they must still be the approved designs.
      const approved = await tx.sessionVariant.count({
        where: { sessionId: id, variant: { status: 'APPROVED' } },
      })
      if (approved !== session.variants.length) {
        throw new ConflictException(
          'A variant of this session is no longer approved.',
        )
      }
      const claimed = await tx.testSession.updateMany({
        where: { id, projectId, status: 'DRAFT' },
        data: {
          status: 'ACTIVE',
          activatedAt: now,
          startsAt: session.startsAt ?? now,
        },
      })
      if (claimed.count === 0) {
        throw new ConflictException('Only a draft session can be activated.')
      }
    })

    return this.get(projectId, id)
  }

  /**
   * Ends an active session (participants lose access at once). The end is
   * recorded in the decision history.
   */
  async end(
    projectId: string,
    id: string,
    userId: string,
    rationale?: string,
  ): Promise<TestSessionDto> {
    const session = await this.find(projectId, id)

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.testSession.updateMany({
        where: { id, projectId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', endedAt: new Date(), endedById: userId },
      })
      if (claimed.count === 0) {
        throw new ConflictException('Only an active session can be ended.')
      }
      await recordDecision(tx, {
        projectId,
        roundId: session.roundId,
        type: 'SESSION_ENDED',
        sessionId: id,
        decidedById: userId,
        rationale,
      })
    })

    return this.get(projectId, id)
  }

  /** Aborts a draft or active session without it counting as completed. */
  async cancel(
    projectId: string,
    id: string,
    userId: string,
  ): Promise<TestSessionDto> {
    await this.find(projectId, id)
    const claimed = await this.prisma.testSession.updateMany({
      where: { id, projectId, status: { in: ['DRAFT', 'ACTIVE'] } },
      data: { status: 'CANCELLED', endedAt: new Date(), endedById: userId },
    })
    if (claimed.count === 0) {
      throw new ConflictException('The session has already ended.')
    }

    return this.get(projectId, id)
  }

  /**
   * Deletes a draft. Once a session has run its results are research data and
   * stay (end or cancel it instead).
   */
  async remove(projectId: string, id: string): Promise<void> {
    await this.find(projectId, id)
    const deleted = await this.prisma.testSession.deleteMany({
      where: { id, projectId, status: 'DRAFT' },
    })
    if (deleted.count === 0) {
      throw new ConflictException('Only a draft session can be deleted.')
    }
  }

  /** The session of the project or 404; the only way sessions are looked up. */
  find(projectId: string, id: string): Promise<SessionRow> {
    return this.prisma.testSession.findFirstOrThrow({
      where: { id, projectId },
      include: INCLUDE,
    })
  }

  private assertFutureDeadline(expiresAt: Date | undefined): void {
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future.')
    }
  }

  private assertWindow(
    startsAt: Date | undefined,
    expiresAt: Date | undefined,
    activatedAt?: Date,
  ): void {
    if (startsAt && expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException('expiresAt must be after startsAt.')
    }
    if (expiresAt) {
      const limit =
        (activatedAt ?? new Date()).getTime() + MAX_SESSION_DAYS * DAY_MS
      if (expiresAt.getTime() > limit) {
        throw new BadRequestException(
          `A session can stay open for at most ${MAX_SESSION_DAYS} days.`,
        )
      }
    }
  }

  private toDto(row: SessionRow): TestSessionDto {
    const { variants, _count, ...session } = row

    return {
      ...session,
      status: session.status as TestSessionStatus,
      expired:
        session.status === 'ACTIVE' &&
        session.expiresAt !== null &&
        session.expiresAt <= new Date(),
      variants: variants.map((v) => ({
        variantId: v.variantId,
        label: v.label,
        name: v.variant.name,
      })),
      taskCount: _count.tasks,
      participantCount: _count.participants,
    }
  }
}
