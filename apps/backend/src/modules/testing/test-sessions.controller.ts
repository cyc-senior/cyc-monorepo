import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { NoCache } from '../../cache/no-cache.decorator'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateTestSessionDto,
  EndTestSessionDto,
  SessionProgressDto,
  TestSessionDto,
  TestSessionQueryDto,
  UpdateTestSessionDto,
} from './dto/test-session.dto'
import { SessionResultsService } from './session-results.service'
import { TestSessionsService } from './test-sessions.service'

@ApiTags('test-sessions')
@AuditEntity('TestSession')
// Live data (participants act while designers watch): always read fresh.
@NoCache()
@Controller('projects/:projectId/test-sessions')
export class TestSessionsController {
  constructor(
    private readonly sessions: TestSessionsService,
    private readonly results: SessionResultsService,
  ) {}

  /** List the project's test sessions. */
  @Get()
  @Authorize(Permission.TestingRead)
  @ApiPaginatedResponse(TestSessionDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: TestSessionQueryDto,
  ): Promise<Page<TestSessionDto>> {
    return this.sessions.list(projectId, query)
  }

  /**
   * Create a draft test session.
   *
   * @remarks Tests APPROVED variants of one round (one = usability test,
   * several = comparative test). Add tasks and participants, then activate.
   * `expiresAt` is required to activate and at most 60 days away.
   * @throws {400} A variant is not an APPROVED variant of the round.
   * @throws {409} The round is approved or archived.
   */
  @Post()
  @Authorize(Permission.TestingManage)
  create(
    @UuidParam('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTestSessionDto,
  ): Promise<TestSessionDto> {
    return this.sessions.create(projectId, userId, dto)
  }

  /** Get a test session. */
  @Get(':sessionId')
  @Authorize(Permission.TestingRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
  ): Promise<TestSessionDto> {
    return this.sessions.get(projectId, sessionId)
  }

  /**
   * Update a session.
   *
   * @remarks Drafts change freely. Once active only the title, description and
   * deadline can change.
   * @throws {409} The session has ended, or a draft-only field was sent.
   */
  @Patch(':sessionId')
  @Authorize(Permission.TestingManage)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Body() dto: UpdateTestSessionDto,
  ): Promise<TestSessionDto> {
    return this.sessions.update(projectId, sessionId, dto)
  }

  /**
   * Open the session to its participants.
   *
   * @throws {400} No future deadline, or no tasks.
   * @throws {409} Not a draft.
   */
  @Post(':sessionId/activate')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.TestingManage)
  @AuditAction('activate')
  activate(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
  ): Promise<TestSessionDto> {
    return this.sessions.activate(projectId, sessionId)
  }

  /**
   * End the session.
   *
   * @remarks Participants lose access at once; the end is recorded in the
   * decision history.
   * @throws {409} Not active.
   */
  @Post(':sessionId/end')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.TestingManage)
  @AuditAction('end')
  end(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EndTestSessionDto,
  ): Promise<TestSessionDto> {
    return this.sessions.end(projectId, sessionId, userId, dto.rationale)
  }

  /**
   * Cancel a draft or active session.
   *
   * @throws {409} Already ended.
   */
  @Post(':sessionId/cancel')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.TestingManage)
  @AuditAction('cancel')
  cancel(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @CurrentUser('id') userId: string,
  ): Promise<TestSessionDto> {
    return this.sessions.cancel(projectId, sessionId, userId)
  }

  /**
   * Delete a draft session.
   *
   * @throws {409} Not a draft: run sessions are research data.
   */
  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.TestingManage)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
  ): Promise<void> {
    return this.sessions.remove(projectId, sessionId)
  }

  /** How far participants are: status counts, consent and task completion. */
  @Get(':sessionId/progress')
  @Authorize(Permission.TestingRead)
  progress(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
  ): Promise<SessionProgressDto> {
    return this.results.progress(projectId, sessionId)
  }
}
