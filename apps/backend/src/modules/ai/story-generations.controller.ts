import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Post,
  Query,
  Sse,
} from '@nestjs/common'
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger'
import { Observable } from 'rxjs'

import { NoCache } from '../../cache/no-cache.decorator'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import {
  ApiPaginatedResponse,
  Page,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateStoryGenerationDto,
  StoryGenerationDto,
} from './dto/story-generation.dto'
import { StoryGenerationService } from './story-generation.service'

/** AI-drafted user stories and problem statements. */
@ApiTags('user-stories')
@AuditEntity('StoryGeneration')
@NoCache()
@Controller('projects/:projectId/story-generations')
export class StoryGenerationsController {
  constructor(private readonly generations: StoryGenerationService) {}

  /** List story drafting jobs of the project. */
  @Get()
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(StoryGenerationDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<StoryGenerationDto>> {
    return this.generations.list(projectId, query)
  }

  /**
   * Draft user stories and problem statements with the AI.
   *
   * @remarks Queues a job (answers 202). The stories appear as DRAFT user
   * stories (origin AI) for a designer to edit and set READY. Follow it with
   * `GET .../story-generations/{id}/events` (SSE).
   * @throws {503} The model is not configured, or the queue is unreachable.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Authorize(Permission.DesignWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStoryGenerationDto,
  ): Promise<StoryGenerationDto> {
    return this.generations.create(projectId, userId, dto)
  }

  /** Get a story drafting job. */
  @Get(':generationId')
  @Authorize(Permission.DesignRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('generationId') generationId: string,
  ): Promise<StoryGenerationDto> {
    return this.generations.get(projectId, generationId)
  }

  /** Follow a story drafting job live (server-sent events; same events as analyses). */
  @Sse(':generationId/events')
  @Authorize(Permission.DesignRead)
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      '`text/event-stream`: `progress`, `status`, then `completed` / `failed` / `cancelled`, plus `heartbeat` every 15 s.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  events(
    @UuidParam('projectId') projectId: string,
    @UuidParam('generationId') generationId: string,
  ): Promise<Observable<MessageEvent>> {
    return this.generations.stream(projectId, generationId)
  }

  /**
   * Cancel a queued or running job.
   *
   * @throws {409} Already finished.
   */
  @Post(':generationId/cancel')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.DesignWrite)
  @AuditAction('cancel')
  cancel(
    @UuidParam('projectId') projectId: string,
    @UuidParam('generationId') generationId: string,
  ): Promise<StoryGenerationDto> {
    return this.generations.cancel(projectId, generationId)
  }
}
