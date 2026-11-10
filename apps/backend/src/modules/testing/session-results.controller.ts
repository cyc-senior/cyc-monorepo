import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { NoCache } from '../../cache/no-cache.decorator'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import {
  ApiPaginatedResponse,
  Page,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import {
  ConsentQueryDto,
  ConsentRecordDto,
  FeedbackDto,
  FeedbackQueryDto,
  InteractionEventDto,
  InteractionEventQueryDto,
  TaskRunDto,
} from './dto/test-session.dto'
import { SessionResultsService } from './session-results.service'

/** The raw output of a session. Read-only, designers only. */
@ApiTags('test-sessions')
@NoCache()
@Controller('projects/:projectId/test-sessions/:sessionId')
export class SessionResultsController {
  constructor(private readonly results: SessionResultsService) {}

  /**
   * Raw participant feedback, exactly as submitted.
   *
   * @remarks Participants are shown by id only (no email). This is the
   * original data: AI analysis and designer edits are kept elsewhere and
   * never replace it.
   */
  @Get('feedback')
  @Authorize(Permission.FeedbackRead)
  @ApiPaginatedResponse(FeedbackDto)
  feedback(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Query() query: FeedbackQueryDto,
  ): Promise<Page<FeedbackDto>> {
    return this.results.feedback(projectId, sessionId, query)
  }

  /** Interaction events (clicks, navigation, ...) in time order. */
  @Get('events')
  @Authorize(Permission.FeedbackRead)
  @ApiPaginatedResponse(InteractionEventDto)
  events(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Query() query: InteractionEventQueryDto,
  ): Promise<Page<InteractionEventDto>> {
    return this.results.events(projectId, sessionId, query)
  }

  /** Task runs: who did which task on which variant, and how long it took. */
  @Get('task-runs')
  @Authorize(Permission.TestingRead)
  @ApiPaginatedResponse(TaskRunDto)
  taskRuns(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<TaskRunDto>> {
    return this.results.taskRuns(projectId, sessionId, query)
  }

  /**
   * PDPA consent history of the session (every decision, newest first).
   *
   * @remarks Evidence of consent: which participant, which notice version
   * and text hash, what they decided, when.
   */
  @Get('consents')
  @Authorize(Permission.TestingRead)
  @ApiPaginatedResponse(ConsentRecordDto)
  consents(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Query() query: ConsentQueryDto,
  ): Promise<Page<ConsentRecordDto>> {
    return this.results.consents(projectId, sessionId, query)
  }
}
