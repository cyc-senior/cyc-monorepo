import { randomUUID } from 'node:crypto'

import { ConflictException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { EnvironmentVariables } from '../../config/env.validation'
import { WorkspaceRole, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateWorkspaceDto,
  WorkspaceDto,
  WorkspaceQueryDto,
  WorkspaceWithRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto'
import {
  parseAvatarDataUrl,
  parseUploadedAvatar,
  UploadedAvatar,
} from './workspace-avatar'

/** Only the avatar's type is needed to build its URL, never its bytes. */
const WORKSPACE_FIELDS = {
  id: true,
  name: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  avatarKey: true,
  avatar: { select: { contentType: true } },
} satisfies Prisma.WorkspaceSelect

type WorkspaceRow = Prisma.WorkspaceGetPayload<{
  select: typeof WORKSPACE_FIELDS
}>

@Injectable()
export class WorkspacesService {
  private readonly apiUrl: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.apiUrl = config
      .get('API_PUBLIC_URL', { infer: true })
      .replace(/\/$/, '')
  }

  /** Workspaces the user belongs to, with their role in each. */
  list(
    userId: string,
    query: WorkspaceQueryDto,
  ): Promise<Page<WorkspaceWithRoleDto>> {
    const where = { userId }

    return paginate(
      query,
      async (page) => {
        const memberships = await this.prisma.workspaceMember.findMany({
          where,
          include: { workspace: { select: WORKSPACE_FIELDS } },
          orderBy: { workspace: { createdAt: 'desc' } },
          ...page,
        })

        return memberships.map(({ workspace, role }) => ({
          ...this.toDto(workspace),
          role,
        }))
      },
      () => this.prisma.workspaceMember.count({ where }),
    )
  }

  /** Creates a workspace; the creator becomes its ADMIN. */
  async create(
    userId: string,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceWithRoleDto> {
    const avatar = dto.avatarUrl ? parseAvatarDataUrl(dto.avatarUrl) : null

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          createdById: userId,
          avatarKey: avatar ? randomUUID() : undefined,
          avatar: avatar ? { create: avatar } : undefined,
        },
        select: WORKSPACE_FIELDS,
      })
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: 'ADMIN' },
      })

      return { ...this.toDto(workspace), role: 'ADMIN' as WorkspaceRole }
    })
  }

  async get(id: string, role: WorkspaceRole): Promise<WorkspaceWithRoleDto> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id },
      select: WORKSPACE_FIELDS,
    })

    return { ...this.toDto(workspace), role }
  }

  update(id: string, dto: UpdateWorkspaceDto): Promise<WorkspaceDto> {
    return this.prisma.workspace
      .update({
        where: { id },
        data: { name: dto.name },
        select: WORKSPACE_FIELDS,
      })
      .then((workspace) => this.toDto(workspace))
  }

  /** Replaces the picture (or adds the first one) and rotates its public key. */
  uploadPicture(
    workspaceId: string,
    file: UploadedAvatar | undefined,
  ): Promise<string> {
    const avatar = parseUploadedAvatar(file)
    const key = randomUUID()

    return this.prisma.workspace
      .update({
        where: { id: workspaceId },
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
      .then(({ avatarKey }) => this.pictureUrl(workspaceId, avatarKey))
  }

  /**
   * The bytes behind `avatarUrl`. Public by design (an `<img>` has no bearer
   * token), so the URL carries an unguessable key that upload/removal rotates.
   */
  async picture(
    workspaceId: string,
    key: string,
  ): Promise<{ contentType: string; data: Uint8Array } | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        avatarKey: true,
        avatar: { select: { contentType: true, data: true } },
      },
    })
    if (!workspace?.avatar || workspace.avatarKey !== key) {
      return null
    }

    return workspace.avatar
  }

  /**
   * Deletes a workspace that has no projects.
   *
   * @throws ConflictException while it still owns projects (their data must
   *   not disappear as a side effect).
   */
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const projects = await tx.project.count({
        where: { workspaceId: id },
      })
      if (projects > 0) {
        throw new ConflictException(
          'Delete or move the workspace’s projects first.',
        )
      }
      await tx.workspace.delete({ where: { id } })
    })
  }

  private toDto(workspace: WorkspaceRow): WorkspaceDto {
    const { id, name, createdById, createdAt, updatedAt, avatarKey } = workspace

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
    workspaceId: string,
    avatarKey: string | null,
  ): string | null {
    return avatarKey
      ? `${this.apiUrl}/workspaces/${workspaceId}/picture?key=${encodeURIComponent(avatarKey)}`
      : null
  }
}
