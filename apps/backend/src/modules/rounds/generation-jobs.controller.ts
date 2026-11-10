import {
  Body,
  Controller,
  Delete,
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
  CreateGenerationJobDto,
  GenerationJobDto,
} from './dto/generation-job.dto'
import { GenerationJobsService } from './generation-jobs.service'

const EVENTS_DESCRIPTION = `\`text/event-stream\` of this job. Events (\`data\` is JSON):
- \`status\` — \`{ jobId, status, error, startedAt, finishedAt, variantIds }\`, sent first and on every change while QUEUED/RUNNING.
- \`progress\` — \`{ jobId, stage, variant, of, attempt, receivedChars?, errors? }\`; stage is started | generating | checking | repairing | saving.
- \`completed\` / \`failed\` / \`cancelled\` — the final state (same shape as \`status\`); the stream then ends.
- \`heartbeat\` — every 15 s.`

@ApiTags('generation-jobs')
@AuditEntity('GenerationJob')
@Controller('projects/:projectId')
export class GenerationJobsController {
  constructor(private readonly jobs: GenerationJobsService) {}

  /** List the generation jobs of a round. */
  @Get('rounds/:roundId/generation-jobs')
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(GenerationJobDto)
  list(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<GenerationJobDto>> {
    return this.jobs.list(projectId, roundId, query)
  }

  /**
   * Generate designs with the LLM.
   *
   * @remarks Queues a job (answers 202 at once) that designs `variantCount`
   * alternatives from the project's design intent with its UI kit (shadcn or
   * MUI) as guardrail: Figma-like JSON documents, each checked against the kit
   * and WCAG 2.0 AA and repaired by the model until it passes. Follow it with
   * `GET .../generation-jobs/{jobId}/events` (SSE). Passing designs become
   * READY variants of the round.
   * @throws {409} The round is approved or archived.
   * @throws {503} Generation is not configured, or the queue is unreachable.
   */
  @Post('rounds/:roundId/generation-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @Authorize(Permission.DesignWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGenerationJobDto,
  ): Promise<GenerationJobDto> {
    return this.jobs.create(projectId, roundId, userId, dto)
  }

  /** Get a generation job. */
  @Get('generation-jobs/:jobId')
  @Authorize(Permission.DesignRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('jobId') jobId: string,
  ): Promise<GenerationJobDto> {
    return this.jobs.get(projectId, jobId)
  }

  /**
   * Follow a generation job live (server-sent events).
   *
   * @remarks Send the bearer token as usual (use a fetch-based EventSource;
   * the browser's `EventSource` cannot set headers). Reconnecting is safe:
   * the stream always starts with the current state.
   */
  @Sse('generation-jobs/:jobId/events')
  @Authorize(Permission.DesignRead)
  @NoCache()
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: EVENTS_DESCRIPTION,
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  events(
    @UuidParam('projectId') projectId: string,
    @UuidParam('jobId') jobId: string,
  ): Promise<Observable<MessageEvent>> {
    return this.jobs.stream(projectId, jobId)
  }

  /**
   * Cancel a queued or running job.
   *
   * @remarks A running job stops within seconds and saves no variant.
   * @throws {409} The job has already finished.
   */
  @Post('generation-jobs/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.DesignWrite)
  @AuditAction('cancel')
  cancel(
    @UuidParam('projectId') projectId: string,
    @UuidParam('jobId') jobId: string,
  ): Promise<GenerationJobDto> {
    return this.jobs.cancel(projectId, jobId)
  }

  /**
   * Delete a finished generation job.
   *
   * @remarks Variants it produced are kept, detached from the job.
   * @throws {409} The job is still queued or running.
   */
  @Delete('generation-jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.DesignWrite)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('jobId') jobId: string,
  ): Promise<void> {
    return this.jobs.remove(projectId, jobId)
  }
}
