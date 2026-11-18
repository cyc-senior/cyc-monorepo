import { randomUUID } from 'node:crypto'

import { ConflictException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { EnvironmentVariables } from '../../config/env.validation'
import { OrganizationRole, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateOrganizationDto,
  OrganizationDto,
  OrganizationQueryDto,
  OrganizationWithRoleDto,
  UpdateOrganizationDto,
} from './dto/organization.dto'
import {
  parseAvatarDataUrl,
  parseUploadedAvatar,
  UploadedAvatar,
} from './organization-avatar'

/** Only the avatar's type is needed to build its URL, never its bytes. */
const ORG_FIELDS = {
  id: true,
  name: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  avatarKey: true,
  avatar: { select: { contentType: true } },
} satisfies Prisma.OrganizationSelect

type OrganizationRow = Prisma.OrganizationGetPayload<{
  select: typeof ORG_FIELDS
}>

@Injectable()
export class OrganizationsService {
  private readonly apiUrl: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.apiUrl = config
      .get('API_PUBLIC_URL', { infer: true })
      .replace(/\/$/, '')
  }

  /** Organizations the user belongs to, with their role in each. */
  list(
    userId: string,
    query: OrganizationQueryDto,
  ): Promise<Page<OrganizationWithRoleDto>> {
    const where = { userId }

    return paginate(
      query,
      async (page) => {
        const memberships = await this.prisma.organizationMember.findMany({
          where,
          include: { organization: { select: ORG_FIELDS } },
          orderBy: { organization: { createdAt: 'desc' } },
          ...page,
        })

        return memberships.map(({ organization, role }) => ({
          ...this.toDto(organization),
          role,
        }))
      },
      () => this.prisma.organizationMember.count({ where }),
    )
  }

  /** Creates an organization; the creator becomes its ADMIN. */
  async create(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationWithRoleDto> {
    const avatar = dto.avatarUrl ? parseAvatarDataUrl(dto.avatarUrl) : null

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          createdById: userId,
          avatar: avatar ? { create: avatar } : undefined,
        },
        select: ORG_FIELDS,
      })
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId, role: 'ADMIN' },
      })

      return { ...this.toDto(organization), role: 'ADMIN' as OrganizationRole }
    })
  }

  async get(
    id: string,
    role: OrganizationRole,
  ): Promise<OrganizationWithRoleDto> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id },
      select: ORG_FIELDS,
    })

    return { ...this.toDto(organization), role }
  }

  update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    return this.prisma.organization
      .update({
        where: { id },
        data: { name: dto.name },
        select: ORG_FIELDS,
      })
      .then((organization) => this.toDto(organization))
  }

  /** Replaces the picture (or adds the first one) and rotates its public key. */
  uploadPicture(
    organizationId: string,
    file: UploadedAvatar | undefined,
  ): Promise<string> {
    const avatar = parseUploadedAvatar(file)
    const key = randomUUID()

    return this.prisma.organization
      .update({
        where: { id: organizationId },
        data: {
          avatarKey: key,
          avatar: {
            upsert: {
              create: avatar,
              update: avatar,
            },
          },
        },
        select: { avatarKey: true },
      })
      .then(({ avatarKey }) => this.pictureUrl(organizationId, avatarKey))
  }

  /**
   * The bytes behind `avatarUrl`. Public by design (an `<img>` has no bearer
   * token), so the URL carries an unguessable key that upload/removal rotates.
   */
  async picture(
    organizationId: string,
    key: string,
  ): Promise<{ contentType: string; data: Uint8Array } | null> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        avatarKey: true,
        avatar: { select: { contentType: true, data: true } },
      },
    })
    if (!organization?.avatar || organization.avatarKey !== key) {
      return null
    }

    return organization.avatar
  }

  /**
   * Deletes an organization that has no projects.
   *
   * @throws ConflictException while it still owns projects (their data must
   *   not disappear as a side effect).
   */
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const projects = await tx.project.count({
        where: { organizationId: id },
      })
      if (projects > 0) {
        throw new ConflictException(
          'Delete or move the organization’s projects first.',
        )
      }
      await tx.organization.delete({ where: { id } })
    })
  }

  private toDto(organization: OrganizationRow): OrganizationDto {
    const { id, name, createdById, createdAt, updatedAt, avatarKey } =
      organization

    return {
      id,
      name,
      createdById,
      createdAt,
      updatedAt,
      avatarUrl: this.pictureUrl(id, avatarKey),
    }
  }

  private pictureUrl(
    organizationId: string,
    avatarKey: string | null,
  ): string | null {
    return avatarKey
      ? `${this.apiUrl}/organizations/${organizationId}/picture?key=${encodeURIComponent(avatarKey)}`
      : null
  }
}
