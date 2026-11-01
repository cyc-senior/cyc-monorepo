import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { EnvironmentVariables } from '../../config/env.validation'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthTokensDto } from './dto/auth-tokens.dto'
import { AuthenticatedUser } from './interfaces/authenticated-user.interface'
import { JwtPayload } from './interfaces/jwt-payload.interface'

const DAY_MS = 24 * 60 * 60 * 1000

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Starts a new refresh-token family (i.e. a new login). */
  issueTokens(user: AuthenticatedUser): Promise<AuthTokensDto> {
    return this.createTokens(user, randomUUID())
  }

  /**
   * Exchanges a refresh token for a new pair. Tokens are single-use: presenting
   * an already-rotated token is treated as theft and revokes the whole family.
   */
  async refresh(rawToken: string): Promise<AuthTokensDto> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      include: { user: true },
    })
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token.')
    }

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId)
      throw new UnauthorizedException('Invalid refresh token.')
    }
    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired.')
    }

    // Claim and re-issue in one transaction so a failure while issuing the new
    // pair rolls the claim back instead of leaving the user without a valid
    // refresh token.
    const tokens = await this.prisma.$transaction(async (tx) => {
      await this.lockFamily(tx, stored.familyId)

      // Atomic claim: only one concurrent request can rotate a given token.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      if (claimed.count === 0) {
        return null
      }

      return this.createTokens(
        { id: stored.user.id, email: stored.user.email },
        stored.familyId,
        tx,
      )
    })
    if (!tokens) {
      await this.revokeFamily(stored.familyId)
      throw new UnauthorizedException('Invalid refresh token.')
    }

    return tokens
  }

  /** Ends the session the refresh token belongs to. Idempotent. */
  async logout(userId: string, rawToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hash(rawToken), userId },
    })
    if (stored) {
      await this.revokeFamily(stored.familyId)
    }
  }

  /**
   * Signs an access JWT and persists a new refresh token (hash only) in the
   * given family.
   *
   * @param db - Transaction client to write with; defaults to the shared client.
   */
  private async createTokens(
    user: AuthenticatedUser,
    familyId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<AuthTokensDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email }
    const refreshToken = randomBytes(48).toString('base64url')
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true })

    await db.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      },
    })

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
    }
  }

  /** Revokes every live token of the family, serialized against rotation. */
  private revokeFamily(familyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockFamily(tx, familyId)

      return tx.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    })
  }

  /**
   * Takes a transaction-scoped lock on the family. Rotation and revocation both
   * hold it, so a revocation can never run between a rotation's claim and its
   * commit: under READ COMMITTED it would otherwise wait on the claimed row and
   * then miss the successor inserted by the rotation, leaving a live session.
   */
  private async lockFamily(
    tx: Prisma.TransactionClient,
    familyId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))`
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
