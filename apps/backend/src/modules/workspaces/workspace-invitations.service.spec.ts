import { ForbiddenException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { WorkspaceInvitationsService } from './workspace-invitations.service'
import {
  INVITATION_TTL_DAYS,
  WorkspaceMembersService,
} from './workspace-members.service'

const WORKSPACE = '11111111-1111-4111-8111-111111111111'
const ID = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'

describe('pending workspace invitations', () => {
  it('creates a pending invitation when the email has no account', async () => {
    const create = jest.fn().mockResolvedValue({ id: ID, email: 'new@b.c' })
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      workspaceInvitation: { create },
    }

    const result = await new WorkspaceMembersService(
      prisma as unknown as PrismaService,
    ).add(WORKSPACE, { email: 'NEW@B.C', role: 'MEMBER' }, USER)

    expect(result).toMatchObject({ id: ID })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: WORKSPACE,
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
      workspaceInvitation: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ID,
          workspaceId: WORKSPACE,
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
      new WorkspaceInvitationsService(
        prisma as unknown as PrismaService,
      ).accept(ID, { id: USER, email: 'me@b.c' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('turns an invitation into membership and removes it', async () => {
    const member = { id: 'm-1', workspaceId: WORKSPACE, userId: USER }
    const tx = {
      workspaceInvitation: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ID,
          workspaceId: WORKSPACE,
          email: 'me@b.c',
          role: 'ADMIN',
          expiresAt: null,
        }),
        delete: jest.fn(),
      },
      workspaceMember: { create: jest.fn().mockResolvedValue(member) },
    }
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    }

    const result = await new WorkspaceInvitationsService(
      prisma as unknown as PrismaService,
    ).accept(ID, { id: USER, email: 'ME@B.C' })

    expect(result).toEqual(member)
    expect(tx.workspaceMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { workspaceId: WORKSPACE, userId: USER, role: 'ADMIN' },
      }),
    )
    expect(tx.workspaceInvitation.delete).toHaveBeenCalledWith({
      where: { id: ID },
    })
  })
})
