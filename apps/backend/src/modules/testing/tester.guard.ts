import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { isUUID } from 'class-validator'

import { logEvent } from '../../common/logging/log-event'
import { PrismaService } from '../../prisma/prisma.service'
import { JWT_ISSUER, TESTER_AUDIENCE } from '../auth/auth.constants'
import { TesterRequest, TesterTokenPayload } from './tester.types'

/**
 * Authenticates a session participant (a tester) on `/testing/...` routes.
 *
 * Nothing in the token is trusted beyond "this is participant X of session Y":
 * on every request the participant and session are re-read and must still be
 * allowed in — participant not revoked or withdrawn, session ACTIVE and inside
 * its [startsAt, expiresAt] window. So ending a session, expiring it or
 * revoking a person takes effect immediately, whatever tokens are out there.
 *
 * Route handlers are `@Public()` for the user JWT guard and use this one
 * instead; user tokens (another audience) are rejected here and tester tokens
 * are rejected by the user guard.
 */
@Injectable()
export class TesterGuard implements CanActivate {
  private readonly logger = new Logger(TesterGuard.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TesterRequest>()
    const payload = await this.verify(request)
    if (!isUUID(payload.sub) || !isUUID(payload.sid)) {
      throw new UnauthorizedException()
    }

    const participant = await this.prisma.sessionParticipant.findFirst({
      where: { id: payload.sub, sessionId: payload.sid },
      include: { session: true },
    })
    if (!participant) {
      throw new UnauthorizedException()
    }
    const { session } = participant
    const now = new Date()
    const open =
      session.status === 'ACTIVE' &&
      (!session.startsAt || session.startsAt <= now) &&
      session.expiresAt !== null &&
      session.expiresAt > now
    const allowed =
      participant.status !== 'REVOKED' && participant.status !== 'WITHDRAWN'
    if (!open || !allowed) {
      this.logger.warn(
        logEvent('testing.access_denied', {
          participant: participant.id,
          session: session.id,
          reason: allowed ? 'session_not_open' : participant.status,
        }),
      )
      throw new ForbiddenException(
        allowed
          ? 'This test session is not open.'
          : 'Your access to this test session has ended.',
      )
    }

    request.tester = {
      participantId: participant.id,
      sessionId: session.id,
      projectId: session.projectId,
      roundId: session.roundId,
      assignedVariantId: participant.assignedVariantId,
      consentVersion: session.consentVersion,
    }

    return true
  }

  private async verify(request: TesterRequest): Promise<TesterTokenPayload> {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException()
    }
    try {
      return await this.jwt.verifyAsync<TesterTokenPayload>(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: TESTER_AUDIENCE,
      })
    } catch {
      // Also covers user tokens (another audience) and expired tokens.
      throw new UnauthorizedException()
    }
  }
}
