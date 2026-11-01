import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'

import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from './auth.service'

describe('AuthService', () => {
  const user = { id: 'user-1', email: 'a@example.com' }
  const prisma = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  }
  const jwtService = { signAsync: jest.fn().mockResolvedValue('access.jwt') }
  const config = {
    get: jest.fn((key: string) =>
      key === 'REFRESH_TOKEN_TTL_DAYS' ? 30 : 900,
    ),
  }
  let service: AuthService

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile()
    service = moduleRef.get(AuthService)
  })

  describe('issueTokens', () => {
    it('signs an access token and stores only the refresh token hash', async () => {
      const tokens = await service.issueTokens(user)

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      })
      expect(tokens).toMatchObject({
        accessToken: 'access.jwt',
        tokenType: 'Bearer',
        expiresIn: 900,
      })
      const { data } = prisma.refreshToken.create.mock.calls[0][0]
      expect(data.tokenHash).not.toBe(tokens.refreshToken)
      expect(data.userId).toBe(user.id)
    })
  })

  describe('refresh', () => {
    const stored = {
      id: 'rt-1',
      familyId: 'family-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    }

    it('rotates a valid token within the same family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored)
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

      await service.refresh('raw-token')

      expect(prisma.refreshToken.create.mock.calls[0][0].data.familyId).toBe(
        'family-1',
      )
    })

    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)

      await expect(service.refresh('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    })

    it('revokes the whole family when a rotated token is reused', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...stored,
        revokedAt: new Date(),
      })

      await expect(service.refresh('reused')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId: 'family-1', revokedAt: null },
        }),
      )
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...stored,
        expiresAt: new Date(Date.now() - 1),
      })

      await expect(service.refresh('old')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    })

    it('rejects when a concurrent request already claimed the token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored)
      prisma.refreshToken.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 })

      await expect(service.refresh('raced')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('revokes the family of a token owned by the user', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({ familyId: 'family-1' })

      await service.logout(user.id, 'raw-token')

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId: 'family-1', revokedAt: null },
        }),
      )
    })

    it('is a no-op for an unknown token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null)

      await service.logout(user.id, 'unknown')

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
    })
  })
})
