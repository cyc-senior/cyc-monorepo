import { PrismaService } from '../../prisma/prisma.service'
import { OrganizationsService } from './organizations.service'

const ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-01-01T00:00:00Z')

function makeService(prisma: unknown) {
  const config = {
    get: jest.fn().mockReturnValue('http://api.test/api/'),
  }

  return new OrganizationsService(
    prisma as PrismaService,
    config as unknown as ConstructorParameters<typeof OrganizationsService>[1],
  )
}

describe('OrganizationsService avatars', () => {
  it('exposes a public URL for an uploaded picture', async () => {
    const prisma = {
      organization: {
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
      `http://api.test/api/organizations/${ID}/picture?key=secret-key`,
    )
    expect(dto.role).toBe('ADMIN')
  })

  it('returns null until a picture exists', async () => {
    const prisma = {
      organization: {
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

  it('rotates the picture key on upload', async () => {
    const update = jest.fn().mockResolvedValue({ avatarKey: 'new-key' })
    const prisma = { organization: { update } }
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
    const service = makeService({ organization: { findUnique } })

    expect(await service.picture(ID, 'right-key')).not.toBeNull()
    expect(await service.picture(ID, 'wrong-key')).toBeNull()
  })
})
