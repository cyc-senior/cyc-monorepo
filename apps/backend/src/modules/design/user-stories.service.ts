import { Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateUserStoryDto,
  UpdateUserStoryDto,
  UserStoryDto,
  UserStoryQueryDto,
} from './dto/user-story.dto'

@Injectable()
export class UserStoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    projectId: string,
    query: UserStoryQueryDto,
  ): Promise<Page<UserStoryDto>> {
    const where: Prisma.UserStoryWhereInput = {
      projectId,
      status: query.status,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.userStory.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page,
        }),
      () => this.prisma.userStory.count({ where }),
    )
  }

  create(projectId: string, dto: CreateUserStoryDto): Promise<UserStoryDto> {
    return this.prisma.userStory.create({ data: { ...dto, projectId } })
  }

  get(projectId: string, id: string): Promise<UserStoryDto> {
    return this.prisma.userStory.findFirstOrThrow({ where: { id, projectId } })
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateUserStoryDto,
  ): Promise<UserStoryDto> {
    await this.get(projectId, id)

    return this.prisma.userStory.update({ where: { id }, data: dto })
  }

  async remove(projectId: string, id: string): Promise<void> {
    await this.get(projectId, id)
    await this.prisma.userStory.delete({ where: { id } })
  }
}
