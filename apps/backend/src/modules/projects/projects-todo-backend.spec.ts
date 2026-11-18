import { PrismaService } from '../../prisma/prisma.service'
import { ProjectsService } from './projects.service'

describe('project frontend TODO support', () => {
  it('adds dashboard summary fields to listed projects', async () => {
    const prisma = {
      projectMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: 'DESIGNER',
            project: {
              id: '11111111-1111-4111-8111-111111111111',
              organizationId: '22222222-2222-4222-8222-222222222222',
              name: 'KMUTT Library',
              clientOrProduct: 'KMUTT Library',
              description: null,
              platforms: ['DESKTOP', 'MOBILE'],
              status: 'ACTIVE',
              createdById: '33333333-3333-4333-8333-333333333333',
              createdAt: new Date(),
              updatedAt: new Date(),
              designIntent: { id: 'intent-1' },
              rounds: [
                {
                  roundNumber: 2,
                  status: 'APPROVED',
                  _count: { variants: 2 },
                  variants: [{ thumbnailUrl: 'https://cdn.test/preview.png' }],
                },
                {
                  roundNumber: 1,
                  status: 'APPROVED',
                  _count: { variants: 1 },
                  variants: [],
                },
              ],
              testSessions: [
                {
                  status: 'ACTIVE',
                  participants: [{ status: 'JOINED' }, { status: 'INVITED' }],
                },
              ],
              members: [
                {
                  user: {
                    id: '33333333-3333-4333-8333-333333333333',
                    name: 'Ploy',
                    image: null,
                  },
                },
              ],
              analyses: [],
              userStories: [],
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    }

    const page = await new ProjectsService(
      prisma as unknown as PrismaService,
    ).list('33333333-3333-4333-8333-333333333333', {
      limit: 50,
      offset: 0,
    })

    expect(page.data[0]).toMatchObject({
      role: 'DESIGNER',
      activeRound: 'Round 2 of 2',
      testerProgress: { current: 1, total: 2 },
      variantCount: 2,
      statusBadge: { label: 'In testing', type: 'in-progress' },
      requiresAttention: false,
      members: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Ploy',
          image: null,
        },
      ],
      thumbnailUrl: 'https://cdn.test/preview.png',
    })
  })

  it('creates a project without platforms (the database default applies)', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'New project',
      clientOrProduct: 'Client',
      description: null,
      platforms: ['DESKTOP'],
      status: 'ACTIVE',
      createdById: '33333333-3333-4333-8333-333333333333',
      createdAt: new Date(),
      updatedAt: new Date(),
      designIntent: null,
      rounds: [],
      testSessions: [],
      members: [],
      analyses: [],
      userStories: [],
    }
    const tx = {
      project: { create: jest.fn().mockResolvedValue(created) },
      projectMember: { create: jest.fn() },
    }
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    }

    const result = await new ProjectsService(
      prisma as unknown as PrismaService,
    ).create(
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
      { name: 'New project', clientOrProduct: 'Client' },
    )

    expect(tx.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New project',
          clientOrProduct: 'Client',
        }),
      }),
    )
    expect(result).toMatchObject({
      role: 'DESIGNER',
      activeRound: 'Draft',
      variantCount: 0,
      requiresAttention: true,
      statusBadge: { label: 'Prompt & context', type: 'warning' },
    })
  })
})
