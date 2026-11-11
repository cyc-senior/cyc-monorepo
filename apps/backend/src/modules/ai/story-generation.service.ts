import {
  ConflictException,
  Injectable,
  Logger,
  MessageEvent,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Observable } from 'rxjs'

import {
  Page,
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { errorText, logEvent } from '../../common/logging/log-event'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { LlmClient } from '../generation/llm.client'
import { streamJob } from './ai-stream'
import { AiTaskEvents } from './ai-task.events'
import { AiTaskQueue } from './ai-task.queue'
import {
  CreateStoryGenerationDto,
  StoryGenerationDto,
} from './dto/story-generation.dto'
import { StoryDraftInput } from './story-drafter'

const FINAL: Record<string, string> = {
  SUCCEEDED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

const WITH_STORIES = {
  stories: { select: { id: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.StoryGenerationInclude

type Row = Prisma.StoryGenerationGetPayload<{ include: typeof WITH_STORIES }>

/**
 * Asks the text model to draft user stories and problem statements from the
 * project's design brief. The result is DRAFT stories (origin AI) that a
 * designer reviews, edits and marks READY; nothing is applied automatically.
 */
@Injectable()
export class StoryGenerationService {
  private readonly logger = new Logger(StoryGenerationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: AiTaskQueue,
    private readonly events: AiTaskEvents,
    private readonly llm: LlmClient,
  ) {}

  list(
    projectId: string,
    query: PaginationQueryDto,
  ): Promise<Page<StoryGenerationDto>> {
    const where = { projectId }

    return paginate(
      query,
      async (page) => {
        const rows = await this.prisma.storyGeneration.findMany({
          where,
          include: WITH_STORIES,
          orderBy: { createdAt: 'desc' },
          ...page,
        })

        return rows.map(toDto)
      },
      () => this.prisma.storyGeneration.count({ where }),
    )
  }

  async get(projectId: string, id: string): Promise<StoryGenerationDto> {
    return toDto(await this.find(projectId, id))
  }

  async create(
    projectId: string,
    userId: string,
    dto: CreateStoryGenerationDto,
  ): Promise<StoryGenerationDto> {
    const existing = await this.byIdempotencyKey(projectId, dto.idempotencyKey)
    if (existing) {
      return existing
    }
    if (!this.llm.configured) {
      throw new ServiceUnavailableException(
        'Story drafting is not configured on this server.',
      )
    }
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        designIntent: { select: { statement: true, toneOfVoice: true } },
        personas: {
          select: { name: true, shortDescription: true, goals: true },
          orderBy: { createdAt: 'asc' },
          take: 5,
        },
      },
    })
    const stories = await this.prisma.userStory.findMany({
      where: { projectId, status: { not: 'ARCHIVED' } },
      select: { title: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const input: Omit<StoryDraftInput, 'count'> = {
      project: {
        name: project.name,
        clientOrProduct: project.clientOrProduct,
        description: project.description,
        platforms: project.platforms,
      },
      designIntent: project.designIntent?.statement ?? null,
      toneOfVoice: project.designIntent?.toneOfVoice ?? null,
      personas: project.personas,
      existingStories: stories.map((story) => story.title),
      instruction: dto.instruction ?? null,
    }

    let row: Row
    try {
      row = await this.prisma.storyGeneration.create({
        data: {
          projectId,
          requestedById: userId,
          instruction: dto.instruction,
          count: dto.count ?? 3,
          idempotencyKey: dto.idempotencyKey,
          modelProvider: this.llm.provider,
          modelName: this.llm.analysisModel,
          inputSnapshot: input as unknown as Prisma.InputJsonObject,
        },
        include: WITH_STORIES,
      })
    } catch (error) {
      const raced = await this.byIdempotencyKey(projectId, dto.idempotencyKey)
      if (raced) {
        return raced
      }
      throw error
    }
    try {
      await this.queue.enqueue('story-generation', row.id)
    } catch (error) {
      await this.prisma.storyGeneration.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          error: errorText(error),
          finishedAt: new Date(),
        },
      })
      this.logger.error(
        logEvent('stories.enqueue_failed', {
          id: row.id,
          error: errorText(error),
        }),
      )
      throw new ServiceUnavailableException(
        'Could not queue the job; try again shortly.',
      )
    }

    return toDto(row)
  }

  async cancel(projectId: string, id: string): Promise<StoryGenerationDto> {
    await this.find(projectId, id)
    const cancelled = await this.prisma.storyGeneration.updateMany({
      where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
    if (cancelled.count === 0) {
      throw new ConflictException('The job has already finished.')
    }
    await this.queue.withdraw(id).catch(() => undefined)

    return this.get(projectId, id)
  }

  async stream(
    projectId: string,
    id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.find(projectId, id)

    return streamJob(
      this.events,
      id,
      async () => {
        const row = await this.prisma.storyGeneration.findUniqueOrThrow({
          where: { id },
          include: WITH_STORIES,
        })

        return {
          type: FINAL[row.status] ?? 'status',
          data: {
            jobId: id,
            status: row.status,
            error: row.error,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt,
            storyIds: row.stories.map((story) => story.id),
          },
        }
      },
      ['completed', 'failed', 'cancelled'],
    )
  }

  private find(projectId: string, id: string): Promise<Row> {
    return this.prisma.storyGeneration.findFirstOrThrow({
      where: { id, projectId },
      include: WITH_STORIES,
    })
  }

  private async byIdempotencyKey(
    projectId: string,
    key: string | undefined,
  ): Promise<StoryGenerationDto | null> {
    if (!key) {
      return null
    }
    const row = await this.prisma.storyGeneration.findUnique({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey: key } },
      include: WITH_STORIES,
    })

    return row ? toDto(row) : null
  }
}

function toDto({ stories, ...row }: Row): StoryGenerationDto {
  // The input snapshot stays server-side (it repeats the project brief).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputSnapshot, idempotencyKey, ...rest } = row

  return { ...rest, storyIds: stories.map((story) => story.id) }
}
