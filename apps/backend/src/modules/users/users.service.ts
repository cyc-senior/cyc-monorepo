import { Injectable } from '@nestjs/common'

import { AuthProvider, User } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

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
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  /** Updates the profile fields the user may edit themselves. */
  update(
    id: string,
    data: { name?: string; image?: string | null },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data })
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
