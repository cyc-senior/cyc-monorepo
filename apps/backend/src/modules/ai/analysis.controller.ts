import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common'
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger'
import { Observable } from 'rxjs'

import { NoCache } from '../../cache/no-cache.decorator'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AnalysisService } from './analysis.service'
import {
  AnalysisDto,
  AnalysisQueryDto,
  CreateAnalysisDto,
  DecideAnalysisDto,
  UpdateAnalysisDto,
} from './dto/analysis.dto'

const EVENTS_DESCRIPTION = `\`text/event-stream\` of this analysis job. Events (\`data\` is JSON):
- \`progress\` — \`{ jobId, stage, receivedChars? }\`; stage is started | loading | analysing | validating | saving.
- \`status\` — \`{ jobId, status, error, startedAt, finishedAt }\`, sent first and on every change while QUEUED/RUNNING.
- \`completed\` / \`failed\` / \`cancelled\` — the final state; the stream then ends. \`completed\` means the analysis is READY for review.
- \`heartbeat\` — every 15 s.`

/**
 * AI analysis of raw test feedback. The AI proposes (themes, summary); a
 * designer reviews, edits and approves. Raw feedback is never modified.
 */
@ApiTags('feedback-analysis')
@AuditEntity('FeedbackAnalysis')
@NoCache()
@Controller('projects/:projectId/analyses')
export class AnalysisController {
  constructor(private readonly analyses: AnalysisService) {}

  /** List the project's feedback analyses (newest first). */
  @Get()
  @Authorize(Permission.AnalysisRead)
  @ApiPaginatedResponse(AnalysisDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: AnalysisQueryDto,
  ): Promise<Page<AnalysisDto>> {
    return this.analyses.list(projectId, query)
  }

  /**
   * Analyse the feedback of a round with the AI.
   *
   * @remarks Queues a job (answers 202 at once). The feedback to analyse is
   * fixed now: written comments of the round's (or one session's) participants
   * who have not withdrawn. Participant identities are never sent to the
   * model, and contact details in free text are masked. Follow it with
   * `GET .../analyses/{analysisId}/events` (SSE). The result waits in READY
   * for a designer to review.
   * @throws {400} No written feedback yet, or more than 300 items.
   * @throws {503} The model is not configured, or the queue is unreachable.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Authorize(Permission.AnalysisWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAnalysisDto,
  ): Promise<AnalysisDto> {
    return this.analyses.create(projectId, userId, dto)
  }

  /** Get an analysis (summary, insights, status). Its themes: `.../themes`. */
  @Get(':analysisId')
  @Authorize(Permission.AnalysisRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
  ): Promise<AnalysisDto> {
    return this.analyses.get(projectId, analysisId)
  }

  /** Follow an analysis job live (server-sent events). */
  @Sse(':analysisId/events')
  @Authorize(Permission.AnalysisRead)
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: EVENTS_DESCRIPTION,
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  events(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
  ): Promise<Observable<MessageEvent>> {
    return this.analyses.stream(projectId, analysisId)
  }

  /**
   * Edit the reviewed summary and insights.
   *
   * @remarks The AI's own text stays in `aiSummary` / `aiInsights`.
   * @throws {409} Not READY.
   */
  @Patch(':analysisId')
  @Authorize(Permission.AnalysisWrite)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @Body() dto: UpdateAnalysisDto,
  ): Promise<AnalysisDto> {
    return this.analyses.update(projectId, analysisId, dto)
  }

  /**
   * Approve the analysis (a designer's decision).
   *
   * @remarks Every theme must have been decided first. Only an approved
   * analysis can feed the next iteration.
   * @throws {409} Not READY, or themes are still undecided.
   */
  @Post(':analysisId/approve')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.AnalysisWrite)
  @AuditAction('approve')
  approve(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DecideAnalysisDto,
  ): Promise<AnalysisDto> {
    return this.analyses.approve(projectId, analysisId, userId, dto.rationale)
  }

  /**
   * Reject the analysis.
   *
   * @throws {409} Not READY.
   */
  @Post(':analysisId/reject')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.AnalysisWrite)
  @AuditAction('reject')
  reject(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DecideAnalysisDto,
  ): Promise<AnalysisDto> {
    return this.analyses.reject(projectId, analysisId, userId, dto.rationale)
  }

  /**
   * Cancel a queued or running analysis.
   *
   * @throws {409} Already finished.
   */
  @Post(':analysisId/cancel')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.AnalysisWrite)
  @AuditAction('cancel')
  cancel(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
  ): Promise<AnalysisDto> {
    return this.analyses.cancel(projectId, analysisId)
  }
}
