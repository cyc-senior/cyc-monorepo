import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { ProjectRole } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { MembersService } from './members.service'

const PROJECT = 'project-1'

describe('MembersService', () => {
  const tx = {
    $executeRaw: jest.fn(),
    projectMember: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    user: { findFirst: jest.fn() },
    projectMember: { create: jest.fn() },
  }
  const service = new MembersService(prisma as unknown as PrismaService)

  const actor = (role: ProjectRole, userId = 'actor') => ({ userId, role })
  const member = (role: ProjectRole, userId = 'target') => ({
    id: 'm-1',
    projectId: PROJECT,
    userId,
    role,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    tx.projectMember.update.mockImplementation(({ data }) => ({ ...data }))
  })

  it('reports an unregistered email', async () => {
    prisma.user.findFirst.mockResolvedValue(null)

    await expect(
      service.add(PROJECT, { email: 'a@b.c', role: 'PRODUCT_OWNER' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  describe('changeRole', () => {
    it('refuses to demote the last designer', async () => {
      tx.projectMember.findFirst.mockResolvedValue(member('DESIGNER'))
      tx.projectMember.count.mockResolvedValue(0)

      await expect(
        service.changeRole(PROJECT, 'm-1', 'PROJECT_MANAGER'),
      ).rejects.toBeInstanceOf(ConflictException)
      expect(tx.projectMember.update).not.toHaveBeenCalled()
    })

    it('demotes a designer when another remains, under a lock', async () => {
      tx.projectMember.findFirst.mockResolvedValue(member('DESIGNER'))
      tx.projectMember.count.mockResolvedValue(1)

      await service.changeRole(PROJECT, 'm-1', 'PRODUCT_OWNER')

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
      expect(tx.projectMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'PRODUCT_OWNER' } }),
      )
    })

    it('reports a member of another project as missing', async () => {
      tx.projectMember.findFirst.mockResolvedValue(null)

      await expect(
        service.changeRole(PROJECT, 'm-1', 'DESIGNER'),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(tx.projectMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'm-1', projectId: PROJECT },
      })
    })
  })

  describe('remove', () => {
    it('lets any member leave', async () => {
      tx.projectMember.findFirst.mockResolvedValue(
        member('PRODUCT_OWNER', 'me'),
      )

      await service.remove(PROJECT, actor('PRODUCT_OWNER', 'me'), 'm-1')

      expect(tx.projectMember.delete).toHaveBeenCalledWith({
        where: { id: 'm-1' },
      })
    })

    it('does not let a read-only member remove someone else', async () => {
      tx.projectMember.findFirst.mockResolvedValue(member('PRODUCT_OWNER'))

      await expect(
        service.remove(PROJECT, actor('PROJECT_MANAGER'), 'm-1'),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(tx.projectMember.delete).not.toHaveBeenCalled()
    })

    it('does not let the last designer leave', async () => {
      tx.projectMember.findFirst.mockResolvedValue(member('DESIGNER', 'me'))
      tx.projectMember.count.mockResolvedValue(0)

      await expect(
        service.remove(PROJECT, actor('DESIGNER', 'me'), 'm-1'),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('lets a designer remove another designer when one remains', async () => {
      tx.projectMember.findFirst.mockResolvedValue(member('DESIGNER'))
      tx.projectMember.count.mockResolvedValue(1)

      await service.remove(PROJECT, actor('DESIGNER'), 'm-1')

      expect(tx.projectMember.delete).toHaveBeenCalled()
    })
  })
})
