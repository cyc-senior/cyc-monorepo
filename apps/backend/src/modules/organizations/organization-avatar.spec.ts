import { BadRequestException } from '@nestjs/common'

import {
  ORG_AVATAR_MAX_BYTES,
  parseAvatarDataUrl,
  parseUploadedAvatar,
} from './organization-avatar'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('workspace picture validation', () => {
  it('decodes a PNG data URL', () => {
    expect(
      parseAvatarDataUrl(`data:image/png;base64,${PNG.toString('base64')}`),
    ).toMatchObject({ contentType: 'image/png', byteSize: PNG.length })
  })

  it('rejects non-image data URLs', () => {
    expect(() => parseAvatarDataUrl('https://example.com/a.png')).toThrow(
      BadRequestException,
    )
    expect(() => parseAvatarDataUrl('data:text/plain;base64,aGk=')).toThrow(
      BadRequestException,
    )
  })

  it('rejects oversized data URLs', () => {
    const huge = 'a'.repeat((ORG_AVATAR_MAX_BYTES + 1) * 2)

    expect(() => parseAvatarDataUrl(`data:image/png;base64,${huge}`)).toThrow(
      BadRequestException,
    )
  })

  it('accepts only PNG and JPG uploads', () => {
    const file = {
      mimetype: 'image/jpeg',
      size: PNG.length,
      buffer: PNG,
    }

    expect(parseUploadedAvatar(file).contentType).toBe('image/jpeg')
    expect(() =>
      parseUploadedAvatar({ ...file, mimetype: 'image/svg+xml' }),
    ).toThrow(BadRequestException)
    expect(() => parseUploadedAvatar(undefined)).toThrow(BadRequestException)
  })
})
