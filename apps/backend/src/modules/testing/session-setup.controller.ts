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
import {
  AuditAction,
  AuditEntity,
  AuditNoBody,
} from '../audit/audit.decorators'
import {
  CreateTestTaskDto,
  InviteParticipantsDto,
  ParticipantDto,
  ParticipantInvitationDto,
  ParticipantQueryDto,
  TestTaskDto,
  UpdateTestTaskDto,
} from './dto/test-session.dto'
import { ParticipantsService } from './participants.service'
import { TestTasksService } from './test-tasks.service'

/** Tasks and participants of a test session (what is tested, and by whom). */
@ApiTags('test-sessions')
@AuditEntity('TestSession')
@NoCache()
@Controller('projects/:projectId/test-sessions/:sessionId')
export class SessionSetupController {
  constructor(
    private readonly tasks: TestTasksService,
    private readonly participants: ParticipantsService,
  ) {}

  /** List the session's tasks in order. */
  @Get('tasks')
  @Authorize(Permission.TestingRead)
  listTasks(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
  ): Promise<TestTaskDto[]> {
    return this.tasks.list(projectId, sessionId)
  }

  /**
   * Add a task.
   *
   * @throws {409} The session is not a draft, or has the maximum of 30 tasks.
   */
  @Post('tasks')
  @Authorize(Permission.TestingManage)
  @AuditAction('add_task')
  createTask(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Body() dto: CreateTestTaskDto,
  ): Promise<TestTaskDto> {
    return this.tasks.create(projectId, sessionId, dto)
  }

  /**
   * Edit or move a task.
   *
   * @throws {409} The session is not a draft.
   */
  @Patch('tasks/:taskId')
  @Authorize(Permission.TestingManage)
  @AuditAction('update_task')
  updateTask(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @UuidParam('taskId') taskId: string,
    @Body() dto: UpdateTestTaskDto,
  ): Promise<TestTaskDto> {
    return this.tasks.update(projectId, sessionId, taskId, dto)
  }

  /**
   * Remove a task.
   *
   * @throws {409} The session is not a draft.
   */
  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.TestingManage)
  @AuditAction('remove_task')
  removeTask(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @UuidParam('taskId') taskId: string,
  ): Promise<void> {
    return this.tasks.remove(projectId, sessionId, taskId)
  }

  /** List the session's participants. */
  @Get('participants')
  @Authorize(Permission.TestingRead)
  @ApiPaginatedResponse(ParticipantDto)
  listParticipants(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Query() query: ParticipantQueryDto,
  ): Promise<Page<ParticipantDto>> {
    return this.participants.list(projectId, sessionId, query)
  }

  /**
   * Invite testers.
   *
   * @remarks Each email becomes a participant of this session only, with a
   * secret invitation (shown once; only its hash is stored). `assignment`
   * places people without an explicit `assignedVariantId`: `ALL` = every
   * variant (comparative), `BALANCED` = the least-used variant (A/B).
   * Invitations stop working when the session ends or expires.
   * @throws {400} A variant is outside the session.
   * @throws {409} Someone is already invited, or the session is closed/full.
   */
  @Post('participants')
  @AuditNoBody()
  @Authorize(Permission.TestingManage)
  @AuditAction('invite')
  invite(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @Body() dto: InviteParticipantsDto,
  ): Promise<ParticipantInvitationDto[]> {
    return this.participants.invite(projectId, sessionId, dto)
  }

  /**
   * Issue a new invitation.
   *
   * @remarks The previous link stops working.
   * @throws {409} The participant finished, left or was revoked.
   */
  @Post('participants/:participantId/invitation')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.TestingManage)
  @AuditAction('reissue_invitation')
  reissue(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @UuidParam('participantId') participantId: string,
  ): Promise<ParticipantInvitationDto> {
    return this.participants.reissue(projectId, sessionId, participantId)
  }

  /**
   * Revoke a participant's access.
   *
   * @remarks Takes effect on their next request. What they submitted is kept.
   * @throws {409} Already finished or left.
   */
  @Post('participants/:participantId/revoke')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.TestingManage)
  @AuditAction('revoke')
  revoke(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @UuidParam('participantId') participantId: string,
  ): Promise<ParticipantDto> {
    return this.participants.revoke(projectId, sessionId, participantId)
  }

  /**
   * Delete a participant who has not joined.
   *
   * @throws {409} They joined: revoke instead.
   */
  @Delete('participants/:participantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.TestingManage)
  removeParticipant(
    @UuidParam('projectId') projectId: string,
    @UuidParam('sessionId') sessionId: string,
    @UuidParam('participantId') participantId: string,
  ): Promise<void> {
    return this.participants.remove(projectId, sessionId, participantId)
  }
}
