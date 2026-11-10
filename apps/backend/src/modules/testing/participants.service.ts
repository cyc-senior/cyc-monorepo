import { randomBytes } from 'node:crypto'

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { generateToken, sha256 } from '../../common/crypto'
import { lockKey } from '../../common/db-lock'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { EnvironmentVariables } from '../../config/env.validation'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  InviteParticipantsDto,
  ParticipantDto,
  ParticipantInvitationDto,
  ParticipantQueryDto,
} from './dto/test-session.dto'
import { MAX_PARTICIPANTS_PER_SESSION } from './testing.constants'

type ParticipantRow = Prisma.SessionParticipantGetPayload<object>

/**
 * Who may enter a session and which variant they test. A participant exists
 * only because a designer added them; the invitation token is the one way in,
 * is stored hashed, and is shown once.
 */
@Injectable()
export class ParticipantsService {
  private readonly frontendUrl: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.frontendUrl = config
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/$/, '')
  }

  async list(
    projectId: string,
    sessionId: string,
    query: ParticipantQueryDto,
  ): Promise<Page<ParticipantDto>> {
    const session = await this.session(projectId, sessionId)
    const where: Prisma.SessionParticipantWhereInput = {
      sessionId,
      status: query.status,
    }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.sessionParticipant.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          ...page,
        })
        const granted = await this.grantedIds(
          sessionId,
          session.consentVersion,
          rows.map((row) => row.id),
        )

        return rows.map((row) => this.toDto(row, granted.has(row.id)))
      },
      () => this.prisma.sessionParticipant.count({ where }),
    )
  }

  /**
   * Adds participants and issues each an invitation. Emails identify
   * participants within this session only.
   *
   * @throws ConflictException for an email already invited, a closed session or
   *   a full session.
   * @throws BadRequestException for a variant outside the session.
   */
  async invite(
    projectId: string,
    sessionId: string,
    dto: InviteParticipantsDto,
  ): Promise<ParticipantInvitationDto[]> {
    const session = await this.session(projectId, sessionId)
    if (session.status !== 'DRAFT' && session.status !== 'ACTIVE') {
      throw new ConflictException('This session no longer takes participants.')
    }
    const emails = dto.participants.map((p) => p.email)
    if (new Set(emails).size !== emails.length) {
      throw new BadRequestException('Each email can appear only once.')
    }
    const groups = session.variants.map((v) => v.variantId)
    for (const participant of dto.participants) {
      if (
        participant.assignedVariantId &&
        !groups.includes(participant.assignedVariantId)
      ) {
        throw new BadRequestException(
          'assignedVariantId must be a variant of this session.',
        )
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `session-participants:${sessionId}`)
      const existing = await tx.sessionParticipant.count({
        where: { sessionId },
      })
      if (existing + emails.length > MAX_PARTICIPANTS_PER_SESSION) {
        throw new ConflictException(
          `A session can have at most ${MAX_PARTICIPANTS_PER_SESSION} participants.`,
        )
      }
      const taken = await tx.sessionParticipant.count({
        where: { sessionId, email: { in: emails } },
      })
      if (taken > 0) {
        throw new ConflictException(
          'Some of these people are already participants of this session.',
        )
      }
      const load = await this.loads(tx, sessionId, groups)

      const invitations: ParticipantInvitationDto[] = []
      for (const input of dto.participants) {
        const assigned =
          input.assignedVariantId ??
          (dto.assignment === 'BALANCED' ? this.leastLoaded(load) : null)
        if (assigned) {
          load.set(assigned, (load.get(assigned) ?? 0) + 1)
        }
        const token = generateToken()
        const row = await tx.sessionParticipant.create({
          data: {
            sessionId,
            email: input.email,
            displayName: input.displayName,
            assignedVariantId: assigned,
            inviteTokenHash: sha256(token),
          },
        })
        invitations.push(this.toInvitation(row, token))
      }

      return invitations
    })
  }

  /**
   * Replaces the participant's invitation; the old link stops working.
   *
   * @throws ConflictException when the participant has finished or lost access.
   */
  async reissue(
    projectId: string,
    sessionId: string,
    id: string,
  ): Promise<ParticipantInvitationDto> {
    await this.session(projectId, sessionId)
    const token = generateToken()
    const updated = await this.prisma.sessionParticipant.updateMany({
      where: {
        id,
        sessionId,
        status: { in: ['INVITED', 'JOINED'] },
        session: { status: { in: ['DRAFT', 'ACTIVE'] } },
      },
      data: { inviteTokenHash: sha256(token), inviteIssuedAt: new Date() },
    })
    if (updated.count === 0) {
      await this.prisma.sessionParticipant.findFirstOrThrow({
        where: { id, sessionId },
      })
      throw new ConflictException(
        'This participant can no longer be re-invited.',
      )
    }
    const row = await this.prisma.sessionParticipant.findUniqueOrThrow({
      where: { id },
    })

    return this.toInvitation(row, token)
  }

  /**
   * Removes a participant's access immediately (their tokens fail on the next
   * request). What they already submitted is kept.
   */
  async revoke(
    projectId: string,
    sessionId: string,
    id: string,
  ): Promise<ParticipantDto> {
    const session = await this.session(projectId, sessionId)
    const updated = await this.prisma.sessionParticipant.updateMany({
      where: { id, sessionId, status: { in: ['INVITED', 'JOINED'] } },
      data: {
        status: 'REVOKED',
        // An unguessable replacement: the old invitation can never match again.
        inviteTokenHash: sha256(randomBytes(32).toString('hex')),
      },
    })
    if (updated.count === 0) {
      await this.prisma.sessionParticipant.findFirstOrThrow({
        where: { id, sessionId },
      })
      throw new ConflictException('This participant already finished or left.')
    }
    const row = await this.prisma.sessionParticipant.findUniqueOrThrow({
      where: { id },
    })
    const granted = await this.grantedIds(sessionId, session.consentVersion, [
      id,
    ])

    return this.toDto(row, granted.has(id))
  }

  /** Deletes a participant who never joined (nothing to keep). */
  async remove(
    projectId: string,
    sessionId: string,
    id: string,
  ): Promise<void> {
    await this.session(projectId, sessionId)
    const deleted = await this.prisma.sessionParticipant.deleteMany({
      where: { id, sessionId, status: 'INVITED' },
    })
    if (deleted.count === 0) {
      await this.prisma.sessionParticipant.findFirstOrThrow({
        where: { id, sessionId },
      })
      throw new ConflictException(
        'Only participants who have not joined can be deleted; revoke access instead.',
      )
    }
  }

  private session(projectId: string, sessionId: string) {
    return this.prisma.testSession.findFirstOrThrow({
      where: { id: sessionId, projectId },
      select: {
        id: true,
        status: true,
        consentVersion: true,
        variants: { select: { variantId: true } },
      },
    })
  }

  /** Participants per variant, for balanced assignment. */
  private async loads(
    tx: Prisma.TransactionClient,
    sessionId: string,
    groups: string[],
  ): Promise<Map<string, number>> {
    const counts = await tx.sessionParticipant.groupBy({
      by: ['assignedVariantId'],
      where: {
        sessionId,
        status: { not: 'REVOKED' },
        assignedVariantId: { not: null },
      },
      _count: { _all: true },
    })
    const load = new Map(groups.map((id) => [id, 0]))
    for (const row of counts) {
      load.set(row.assignedVariantId, row._count._all)
    }

    return load
  }

  private leastLoaded(load: Map<string, number>): string {
    return [...load.entries()].sort((a, b) => a[1] - b[1])[0][0]
  }

  /** Ids (of `ids`) whose newest consent for the session's version is GRANTED. */
  private async grantedIds(
    sessionId: string,
    consentVersion: string,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set()
    }
    const latest = await this.prisma.consentRecord.findMany({
      where: { sessionId, consentVersion, participantId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      distinct: ['participantId'],
      select: { participantId: true, decision: true },
    })

    return new Set(
      latest
        .filter((record) => record.decision === 'GRANTED')
        .map((record) => record.participantId),
    )
  }

  private toDto(row: ParticipantRow, consentGranted: boolean): ParticipantDto {
    // The invitation hash never leaves the server.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inviteTokenHash, ...rest } = row

    return { ...rest, consentGranted }
  }

  private toInvitation(
    row: ParticipantRow,
    token: string,
  ): ParticipantInvitationDto {
    return {
      ...this.toDto(row, false),
      inviteToken: token,
      inviteUrl: `${this.frontendUrl}/test/join#token=${token}`,
    }
  }
}
