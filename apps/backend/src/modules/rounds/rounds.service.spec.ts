import { BadRequestException, ConflictException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { RoundsService } from './rounds.service'

describe('RoundsService', () => {
  const prisma = {
    designRound: {
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  }
  const service = new RoundsService(prisma as unknown as PrismaService)
  const round = (overrides = {}) => ({
    id: 'r-2',
    projectId: 'p-1',
    roundNumber: 2,
    status: 'DRAFT',
    approvedAt: null,
    ...overrides,
  })

  beforeEach(() => {
    jest.resetAllMocks()
    prisma.designRound.update.mockResolvedValue({})
  })

  describe('update', () => {
    it('only approves through the approve endpoint', async () => {
      prisma.designRound.findFirstOrThrow.mockResolvedValue(round())

      await expect(
        service.update('p-1', 'r-2', { status: 'APPROVED' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('freezes an approved round apart from archiving it', async () => {
      prisma.designRound.findFirstOrThrow.mockResolvedValue(
        round({ status: 'APPROVED', approvedAt: new Date() }),
      )

      await expect(
        service.update('p-1', 'r-2', { title: 'renamed' }),
      ).rejects.toBeInstanceOf(ConflictException)
      await expect(
        service.update('p-1', 'r-2', { status: 'ARCHIVED', title: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException)
      await service.update('p-1', 'r-2', { status: 'ARCHIVED' })
      expect(prisma.designRound.update).toHaveBeenCalledTimes(1)
    })

    it('keeps an archived-after-approval round from being reopened', async () => {
      prisma.designRound.findFirstOrThrow.mockResolvedValue(
        round({ status: 'ARCHIVED', approvedAt: new Date() }),
      )

      await expect(
        service.update('p-1', 'r-2', { status: 'DRAFT' }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('requires the parent to be an earlier round', async () => {
      prisma.designRound.findFirstOrThrow
        .mockResolvedValueOnce(round({ roundNumber: 2 }))
        .mockResolvedValueOnce(round({ id: 'r-3', roundNumber: 3 }))

      await expect(
        service.update('p-1', 'r-2', { parentRoundId: 'r-3' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('approve', () => {
    it('records the approver', async () => {
      prisma.designRound.findFirstOrThrow.mockResolvedValue(round())
      prisma.designRound.updateMany.mockResolvedValue({ count: 1 })

      await service.approve('p-1', 'r-2', 'user-1')

      expect(prisma.designRound.updateMany).toHaveBeenCalledWith({
        where: { id: 'r-2', status: { notIn: ['APPROVED', 'ARCHIVED'] } },
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedById: 'user-1',
          approvedAt: expect.any(Date),
        }),
      })
    })

    it('loses the race gracefully when already approved', async () => {
      prisma.designRound.findFirstOrThrow.mockResolvedValue(round())
      prisma.designRound.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        service.approve('p-1', 'r-2', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })
})
