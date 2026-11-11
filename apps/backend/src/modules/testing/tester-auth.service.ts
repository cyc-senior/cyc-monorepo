import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { sha256 } from '../../common/crypto'
import { logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import { PrismaService } from '../../prisma/prisma.service'
import { JWT_ISSUER, TESTER_AUDIENCE } from '../auth/auth.constants'
import { TesterTokenDto } from './dto/tester.dto'
import { TesterTokenPayload } from './tester.types'

/**
 * Exchanges an invitation token for a short-lived tester access token.
 *
 * The invitation is not a session in itself: every use re-checks the
 * participant, the session's status and its window, and the token it yields
 * expires with the session (and never after `TESTER_TOKEN_TTL_SECONDS`).
 */
@Injectable()
export class TesterAuthService {
  private readonly logger = new Logger(TesterAuthService.name)
  private readonly maxTtl: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxTtl = config.get('TESTER_TOKEN_TTL_SECONDS', { infer: true })
  }

  /**
   * @throws UnauthorizedException for an unknown invitation (nothing else is
   *   revealed to someone without a valid token).
   * @throws ForbiddenException when the invitation is genuine but the session
   *   is not open or the participant lost access.
   */
  async join(inviteToken: string): Promise<TesterTokenDto> {
    const participant = await this.prisma.sessionParticipant.findUnique({
      where: { inviteTokenHash: sha256(inviteToken) },
      include: { session: true },
    })
    if (!participant) {
      this.logger.warn(logEvent('testing.join_rejected', { reason: 'unknown' }))
      throw new UnauthorizedException('Invalid invitation.')
    }
    const { session } = participant
    const now = new Date()
    if (
      participant.status === 'REVOKED' ||
      participant.status === 'WITHDRAWN'
    ) {
      throw new ForbiddenException(
        'Your access to this test session has ended.',
      )
    }
    if (session.status === 'DRAFT') {
      throw new ForbiddenException('This test session has not started yet.')
    }
    if (session.status !== 'ACTIVE') {
      throw new ForbiddenException('This test session has ended.')
    }
    if (session.startsAt && session.startsAt > now) {
      throw new ForbiddenException('This test session has not started yet.')
    }
    if (!session.expiresAt || session.expiresAt <= now) {
      throw new ForbiddenException('This test session has expired.')
    }

    if (participant.status === 'INVITED') {
      await this.prisma.sessionParticipant.updateMany({
        where: { id: participant.id, status: 'INVITED' },
        data: { status: 'JOINED', joinedAt: now },
      })
    }

    const untilExpiry = Math.floor(
      (session.expiresAt.getTime() - now.getTime()) / 1000,
    )
    const expiresIn = Math.max(1, Math.min(this.maxTtl, untilExpiry))
    const payload: TesterTokenPayload = {
      sub: participant.id,
      sid: session.id,
    }
    const accessToken = await this.jwt.signAsync(payload, {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: TESTER_AUDIENCE,
      expiresIn,
    })
    this.logger.log(
      logEvent('testing.joined', {
        participant: participant.id,
        session: session.id,
      }),
    )

    return { accessToken, tokenType: 'Bearer', expiresIn }
  }
}
