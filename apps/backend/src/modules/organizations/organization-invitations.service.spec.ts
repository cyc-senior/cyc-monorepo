import { ForbiddenException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { OrganizationInvitationsService } from './organization-invitations.service'
import {
  INVITATION_TTL_DAYS,
  OrganizationMembersService,
} from './organization-members.service'

const ORG = '11111111-1111-4111-8111-111111111111'
const ID = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'

describe('pending organization invitations', () => {
  it('creates a pending invitation when the email has no account', async () => {
    const create = jest.fn().mockResolvedValue({ id: ID, email: 'new@b.c' })
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      organizationInvitation: { create },
    }

    const result = await new OrganizationMembersService(
      prisma as unknown as PrismaService,
    ).add(ORG, { email: 'NEW@B.C', role: 'MEMBER' }, USER)

    expect(result).toMatchObject({ id: ID })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          email: 'new@b.c',
          invitedById: USER,
        }),
      }),
    )
    // The expiry is a real future date, about TTL_DAYS away.
    const { expiresAt } = create.mock.calls[0][0].data
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(
      (INVITATION_TTL_DAYS - 1) * 86_400_000,
    )
  })

  it('refuses to accept an invitation for another email', async () => {
    const tx = {
      organizationInvitation: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ID,
          organizationId: ORG,
          email: 'other@b.c',
          role: 'MEMBER',
          expiresAt: null,
        }),
      },
    }
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    }

    await expect(
      new OrganizationInvitationsService(
        prisma as unknown as PrismaService,
      ).accept(ID, { id: USER, email: 'me@b.c' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('turns an invitation into membership and removes it', async () => {
    const member = { id: 'm-1', organizationId: ORG, userId: USER }
    const tx = {
      organizationInvitation: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ID,
          organizationId: ORG,
          email: 'me@b.c',
          role: 'ADMIN',
          expiresAt: null,
        }),
        delete: jest.fn(),
      },
      organizationMember: { create: jest.fn().mockResolvedValue(member) },
    }
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    }

    const result = await new OrganizationInvitationsService(
      prisma as unknown as PrismaService,
    ).accept(ID, { id: USER, email: 'ME@B.C' })

    expect(result).toEqual(member)
    expect(tx.organizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { organizationId: ORG, userId: USER, role: 'ADMIN' },
      }),
    )
    expect(tx.organizationInvitation.delete).toHaveBeenCalledWith({
      where: { id: ID },
    })
  })
})
