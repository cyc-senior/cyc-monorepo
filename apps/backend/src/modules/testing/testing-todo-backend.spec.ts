import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { EnvironmentVariables } from '../../config/env.validation'
import { PrismaService } from '../../prisma/prisma.service'
import { hashInviteToken } from './invite-token'
import { MySessionsService } from './my-sessions.service'
import { SessionLookupService } from './session-lookup.service'
import { TesterAuthService } from './tester-auth.service'

const USER = '33333333-3333-4333-8333-333333333333'
const OTHER = '44444444-4444-4444-8444-444444444444'
const SESSION = '55555555-5555-4555-8555-555555555555'

describe('testing frontend TODO support', () => {
  describe('join', () => {
    const openSession = {
      id: SESSION,
      status: 'ACTIVE' as const,
      startsAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }

    function serviceFor(participant: Record<string, unknown>) {
      const prisma = {
        sessionParticipant: {
          findUnique: jest.fn().mockResolvedValue(participant),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      }
      const jwt = { signAsync: jest.fn().mockResolvedValue('tester.jwt') }
      const config = { get: jest.fn().mockReturnValue(900) }
      const service = new TesterAuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        config as unknown as ConfigService<EnvironmentVariables, true>,
      )

      return { service, prisma, jwt }
    }

    it('looks up a code case-insensitively and claims it for the signed-in user', async () => {
      const { service, prisma, jwt } = serviceFor({
        id: 'p-1',
        userId: null,
        status: 'INVITED',
        session: openSession,
      })

      await expect(
        service.join(' AbCdEf ', { id: USER, email: 'me@b.c' }),
      ).resolves.toMatchObject({ accessToken: 'tester.jwt' })
      expect(prisma.sessionParticipant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inviteTokenHash: hashInviteToken(' AbCdEf ') },
        }),
      )
      expect(prisma.sessionParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER }),
        }),
      )
      expect(prisma.sessionParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'JOINED' }),
        }),
      )
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'p-1', sid: SESSION },
        expect.any(Object),
      )
    })

    it('refuses an invitation claimed by another account', async () => {
      const { service } = serviceFor({
        id: 'p-1',
        userId: OTHER,
        status: 'JOINED',
        session: openSession,
      })

      await expect(
        service.join('code', { id: USER, email: 'me@b.c' }),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('keeps anonymous joins working', async () => {
      const { service, prisma } = serviceFor({
        id: 'p-1',
        userId: null,
        status: 'INVITED',
        session: openSession,
      })

      await service.join('code', null)

      expect(prisma.sessionParticipant.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: expect.anything() } }),
      )
      expect(prisma.sessionParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'JOINED' }),
        }),
      )
    })
  })

  describe('lookup', () => {
    it("returns the preview and flags another user's claimed invitation", async () => {
      const prisma = {
        sessionParticipant: {
          findUnique: jest.fn().mockResolvedValue({
            userId: OTHER,
            session: {
              title: 'Checkout',
              expiresAt: new Date('2030-11-03T10:00:00.000Z'),
              project: {
                name: 'Fintech checkout',
                platforms: ['MOBILE'],
                organization: { name: 'Studio workspace' },
              },
              tasks: [{ title: 'Book a study room' }],
            },
          }),
        },
      }

      const result = await new SessionLookupService(
        prisma as unknown as PrismaService,
      ).lookup('k7mq-4xpd', { id: USER, email: 'me@b.c' })

      expect(result).toMatchObject({
        code: 'K7MQ-4XPD',
        workspaceName: 'Studio workspace',
        projectName: 'Fintech checkout',
        taskName: 'Book a study room',
        platform: 'Mobile',
        expiresAt: '2030-11-03T10:00:00.000Z',
        isTakenByOther: true,
      })
    })

    it('404s for an unknown code', async () => {
      const prisma = {
        sessionParticipant: { findUnique: jest.fn().mockResolvedValue(null) },
      }

      await expect(
        new SessionLookupService(prisma as unknown as PrismaService).lookup(
          'nope',
          null,
        ),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('my sessions', () => {
    it('maps a joined scheduled session for the dashboard', async () => {
      const startsAt = new Date('2030-10-30T10:00:00.000Z')
      const joinedAt = new Date('2030-10-29T09:00:00.000Z')
      const prisma = {
        sessionParticipant: {
          findMany: jest.fn().mockResolvedValue([
            {
              joinedAt,
              completedAt: null,
              session: {
                id: SESSION,
                title: 'Checkout',
                status: 'DRAFT',
                startsAt,
                expiresAt: null,
                endedAt: null,
                round: {
                  roundNumber: 2,
                  project: {
                    rounds: [{ id: 'r1' }, ...Array(4).fill({ id: 'r' })],
                  },
                },
              },
              taskRuns: [],
              events: [],
              feedback: [],
            },
          ]),
        },
      }

      const result = await new MySessionsService(
        prisma as unknown as PrismaService,
      ).list(USER)

      expect(prisma.sessionParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER, status: { in: ['JOINED', 'COMPLETED'] } },
        }),
      )
      expect(result).toEqual([
        {
          id: SESSION,
          title: 'Checkout',
          status: 'SCHEDULED',
          currentRound: 2,
          totalRounds: 5,
          lastActiveTime: joinedAt.toISOString(),
          opensAt: startsAt.toISOString(),
        },
      ])
    })
  })
})
