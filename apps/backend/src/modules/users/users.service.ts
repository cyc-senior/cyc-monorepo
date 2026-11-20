import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EnvironmentVariables } from '../../config/env.validation'
import { AuthProvider, User } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  parseUploadedAvatar,
  UploadedAvatar,
} from '../workspaces/workspace-avatar'

export interface ExternalProfile {
  provider: AuthProvider
  providerAccountId: string
  email: string
  emailVerified: boolean
  name?: string | null
  image?: string | null
}

@Injectable()
export class UsersService {
  private readonly apiUrl: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.apiUrl = config
      .get('API_PUBLIC_URL', { infer: true })
      .replace(/\/$/, '')
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  /**
   * Updates the profile fields the user may edit themselves. Setting `image`
   * (to a URL, or to null to remove the photo) replaces any uploaded photo.
   */
  async update(
    id: string,
    data: { name?: string; image?: string | null },
  ): Promise<User> {
    if (data.image === undefined) {
      return this.prisma.user.update({ where: { id }, data })
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.userAvatar.deleteMany({ where: { userId: id } })
      return tx.user.update({
        where: { id },
        data: { ...data, avatarKey: null },
      })
    })
  }

  /**
   * Replaces the uploaded photo (or adds the first one) and rotates its key.
   * `image` is set to the photo's URL so every place that already reads
   * `user.image` (member lists, project owners) shows the upload.
   */
  uploadPicture(id: string, file: UploadedAvatar | undefined): Promise<User> {
    const avatar = parseUploadedAvatar(file)
    const key = randomUUID()

    return this.prisma.user.update({
      where: { id },
      data: {
        avatarKey: key,
        image: `${this.apiUrl}/users/${id}/picture?key=${encodeURIComponent(key)}`,
        avatar: { upsert: { create: avatar, update: avatar } },
      },
    })
  }

  /**
   * The bytes behind an uploaded photo's URL. Public by design (an `<img>` has
   * no bearer token), so the URL carries an unguessable key that every upload
   * and removal rotates.
   */
  async picture(
    id: string,
    key: string,
  ): Promise<{ contentType: string; data: Uint8Array } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        avatarKey: true,
        avatar: { select: { contentType: true, data: true } },
      },
    })
    if (!user?.avatar || user.avatarKey !== key) {
      return null
    }

    return user.avatar
  }

  /**
   * Resolves the local user for an external identity, creating the user and/or
   * linking the account on first sign-in. Callers must only pass profiles whose
   * email has been verified by the provider, since linking is done by email.
   */
  async findOrCreateFromProfile(profile: ExternalProfile): Promise<User> {
    const { provider, providerAccountId } = profile

    const linked = await this.prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    })
    if (linked) {
      return linked.user
    }

    return this.prisma.user.upsert({
      where: { email: profile.email },
      update: {
        accounts: { create: { provider, providerAccountId } },
      },
      create: {
        email: profile.email,
        emailVerified: profile.emailVerified,
        name: profile.name,
        image: profile.image,
        accounts: { create: { provider, providerAccountId } },
      },
    })
  }
}
