import { BadRequestException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { UsersService } from './users.service'

const ID = '11111111-1111-4111-8111-111111111111'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function makeService(prisma: unknown) {
  const config = {
    get: jest.fn().mockReturnValue('http://api.test/api/'),
  }

  return new UsersService(
    prisma as PrismaService,
    config as unknown as ConstructorParameters<typeof UsersService>[1],
  )
}

describe('UsersService profile photo', () => {
  it('stores an upload and points image at its public URL', async () => {
    const update = jest.fn().mockResolvedValue({ id: ID })
    const service = makeService({ user: { update } })

    await service.uploadPicture(ID, {
      mimetype: 'image/png',
      size: PNG.length,
      buffer: PNG,
    })

    const { data } = update.mock.calls[0][0]
    expect(data.avatarKey).toEqual(expect.any(String))
    expect(data.image).toBe(
      `http://api.test/api/users/${ID}/picture?key=${data.avatarKey}`,
    )
    expect(data.avatar.upsert.create).toMatchObject({
      contentType: 'image/png',
      byteSize: PNG.length,
    })
  })

  it('rejects unsupported files before touching the database', () => {
    const update = jest.fn()
    const service = makeService({ user: { update } })

    expect(() =>
      service.uploadPicture(ID, {
        mimetype: 'image/svg+xml',
        size: PNG.length,
        buffer: PNG,
      }),
    ).toThrow(BadRequestException)
    expect(() => service.uploadPicture(ID, undefined)).toThrow(
      BadRequestException,
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('only serves the picture for the current key', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      avatarKey: 'secret',
      avatar: { contentType: 'image/png', data: PNG },
    })
    const service = makeService({ user: { findUnique } })

    await expect(service.picture(ID, 'secret')).resolves.toMatchObject({
      contentType: 'image/png',
    })
    await expect(service.picture(ID, 'stale')).resolves.toBeNull()
    await expect(service.picture(ID, '')).resolves.toBeNull()
  })

  it('returns null when the user has no uploaded photo', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ avatarKey: null, avatar: null })

    await expect(
      makeService({ user: { findUnique } }).picture(ID, ''),
    ).resolves.toBeNull()
  })

  it('drops the uploaded photo when image is set or cleared', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
    const update = jest.fn().mockResolvedValue({ id: ID })
    const tx = { userAvatar: { deleteMany }, user: { update } }
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      user: { update: jest.fn() },
    }

    await makeService(prisma).update(ID, { image: null })

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: ID } })
    expect(update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { image: null, avatarKey: null },
    })
  })

  it('keeps the uploaded photo when only the name changes', async () => {
    const update = jest.fn().mockResolvedValue({ id: ID })
    const prisma = { $transaction: jest.fn(), user: { update } }

    await makeService(prisma).update(ID, { name: 'Ada' })

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { name: 'Ada' },
    })
  })
})
