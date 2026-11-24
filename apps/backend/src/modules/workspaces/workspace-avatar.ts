import { BadRequestException } from '@nestjs/common'

/** Avatars are small; keep the blob (and its base64 form) bounded. */
export const WORKSPACE_AVATAR_MAX_BYTES = 1024 * 1024

const ALLOWED_TYPES = ['image/png', 'image/jpeg'] as const

type ContentType = (typeof ALLOWED_TYPES)[number]

const DATA_URL = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/

export interface AvatarData {
  contentType: ContentType
  data: Uint8Array<ArrayBuffer>
  byteSize: number
}

export interface UploadedAvatar {
  mimetype: string
  size: number
  buffer: Uint8Array<ArrayBuffer>
}

/** Validates and decodes the optional `avatarUrl` accepted at creation. */
export function parseAvatarDataUrl(value: string): AvatarData {
  const match = DATA_URL.exec(value)
  if (!match) {
    throw new BadRequestException(
      'avatarUrl must be a data URL of a PNG or JPEG image.',
    )
  }
  const decoded = Buffer.from(match[2], 'base64')
  assertSize(decoded.length)
  const data = new Uint8Array(decoded.byteLength)
  data.set(decoded)

  return { contentType: match[1] as ContentType, data, byteSize: data.length }
}

/** Validates a multipart upload before its bytes reach the database. */
export function parseUploadedAvatar(
  file: UploadedAvatar | undefined,
): AvatarData {
  if (!file) {
    throw new BadRequestException('A picture file is required.')
  }
  if (!ALLOWED_TYPES.includes(file.mimetype as ContentType)) {
    throw new BadRequestException('Only PNG and JPG pictures are supported.')
  }
  assertSize(file.size)

  const data = new Uint8Array(file.buffer.byteLength)
  data.set(file.buffer)

  return {
    contentType: file.mimetype as ContentType,
    data,
    byteSize: file.size,
  }
}

function assertSize(size: number): void {
  if (size === 0 || size > WORKSPACE_AVATAR_MAX_BYTES) {
    throw new BadRequestException(
      `A picture must be between 1 byte and ${WORKSPACE_AVATAR_MAX_BYTES} bytes.`,
    )
  }
}
