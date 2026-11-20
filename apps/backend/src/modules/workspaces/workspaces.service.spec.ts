import { PrismaService } from '../../prisma/prisma.service'
import { WorkspacesService } from './workspaces.service'

const ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-01-01T00:00:00Z')

function makeService(prisma: unknown) {
  const config = {
    get: jest.fn().mockReturnValue('http://api.test/api/'),
  }

  return new WorkspacesService(
    prisma as PrismaService,
    config as unknown as ConstructorParameters<typeof WorkspacesService>[1],
  )
}

describe('WorkspacesService avatars', () => {
  it('exposes a public URL for an uploaded picture', async () => {
    const prisma = {
      workspace: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ID,
          name: 'Studio',
          createdById: null,
          createdAt: NOW,
          updatedAt: NOW,
          avatarKey: 'secret-key',
          avatar: { contentType: 'image/png' },
        }),
      },
    }

    const dto = await makeService(prisma).get(ID, 'ADMIN')

    expect(dto.avatarUrl).toBe(
      `http://api.test/api/workspaces/${ID}/picture?key=secret-key`,
    )
    expect(dto.role).toBe('ADMIN')
  })

  it('returns null until a picture exists', async () => {
    const prisma = {
      workspace: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: ID,
          name: 'Studio',
          createdById: null,
          createdAt: NOW,
          updatedAt: NOW,
          avatarKey: null,
          avatar: null,
        }),
      },
    }

    expect((await makeService(prisma).get(ID, 'MEMBER')).avatarUrl).toBeNull()
  })

  describe('create', () => {
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    function makeCreate() {
      const create = jest.fn().mockImplementation(({ data }) => ({
        id: ID,
        name: data.name,
        createdById: data.createdById,
        createdAt: NOW,
        updatedAt: NOW,
        avatarKey: data.avatarKey ?? null,
        avatar: data.avatar ? { contentType: 'image/png' } : null,
      }))
      const tx = {
        workspace: { create },
        workspaceMember: { create: jest.fn() },
      }
      const prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      }

      return { create, service: makeService(prisma) }
    }

    it('gives a picture supplied at creation a public URL', async () => {
      const { create, service } = makeCreate()

      const dto = await service.create(ID, {
        name: 'Studio',
        avatarUrl: `data:image/png;base64,${PNG.toString('base64')}`,
      })

      const { data } = create.mock.calls[0][0]
      expect(data.avatarKey).toEqual(expect.any(String))
      expect(data.avatar.create).toMatchObject({ contentType: 'image/png' })
      expect(dto.avatarUrl).toBe(
        `http://api.test/api/workspaces/${ID}/picture?key=${data.avatarKey}`,
      )
      expect(dto.role).toBe('ADMIN')
    })

    it('has no picture URL when none is supplied', async () => {
      const { create, service } = makeCreate()

      const dto = await service.create(ID, { name: 'Studio' })

      expect(create.mock.calls[0][0].data.avatarKey).toBeUndefined()
      expect(dto.avatarUrl).toBeNull()
    })
  })

  it('rotates the picture key on upload', async () => {
    const update = jest.fn().mockResolvedValue({ avatarKey: 'new-key' })
    const prisma = { workspace: { update } }
    const bytes = new Uint8Array([1, 2, 3])
    bytes.set([1, 2, 3])

    const url = await makeService(prisma).uploadPicture(ID, {
      mimetype: 'image/png',
      size: bytes.length,
      buffer: bytes,
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID },
        data: expect.objectContaining({
          avatarKey: expect.any(String),
          avatar: {
            upsert: {
              create: expect.objectContaining({ byteSize: 3 }),
              update: expect.objectContaining({ byteSize: 3 }),
            },
          },
        }),
      }),
    )
    expect(url).toContain('key=new-key')
  })

  it('only serves bytes when the key matches', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      avatarKey: 'right-key',
      avatar: { contentType: 'image/png', data: new Uint8Array([1]) },
    })
    const service = makeService({ workspace: { findUnique } })

    expect(await service.picture(ID, 'right-key')).not.toBeNull()
    expect(await service.picture(ID, 'wrong-key')).toBeNull()
  })
})
