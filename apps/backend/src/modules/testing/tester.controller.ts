import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { FeedbackDto, TaskRunDto } from './dto/test-session.dto'
import {
  FinishTaskDto,
  RecordConsentDto,
  RecordEventsDto,
  StartTaskDto,
  SubmitFeedbackDto,
  TesterConsentDto,
  TesterPrototypeDto,
  TesterSessionDto,
  WithdrawConsentDto,
} from './dto/tester.dto'
import { Tester } from './tester.decorator'
import { TesterGuard } from './tester.guard'
import { TesterService } from './tester.service'
import { TesterContext } from './tester.types'

const MINUTE = 60_000

/** The authenticated part of the testing API (tester token required). */
@ApiTags('testing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid tester token.' })
@Public()
@UseGuards(TesterGuard)
@Controller('testing')
export class TesterController {
  constructor(private readonly tester: TesterService) {}

  /** The session as the participant sees it: consent, their prototypes and tasks. */
  @Get('session')
  session(@Tester() ctx: TesterContext): Promise<TesterSessionDto> {
    return this.tester.session(ctx)
  }

  /** The consent notice and the participant's latest decision. */
  @Get('consent')
  consent(@Tester() ctx: TesterContext): Promise<TesterConsentDto> {
    return this.tester.consent(ctx)
  }

  /**
   * Accept or decline the PDPA notice.
   *
   * @remarks Recorded for this session and notice version only. Nothing else
   * works until consent is GRANTED.
   * @throws {409} The notice changed since it was loaded.
   */
  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 20, windowMs: MINUTE, by: 'participant' })
  recordConsent(
    @Tester() ctx: TesterContext,
    @Body() dto: RecordConsentDto,
  ): Promise<TesterConsentDto> {
    return this.tester.recordConsent(ctx, dto)
  }

  /**
   * Withdraw consent and leave the session.
   *
   * @remarks Access ends immediately.
   */
  @Post('consent/withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 5, windowMs: MINUTE, by: 'participant' })
  withdraw(
    @Tester() ctx: TesterContext,
    @Body() dto: WithdrawConsentDto,
  ): Promise<void> {
    return this.tester.withdrawConsent(ctx, dto)
  }

  /** Mark the onboarding as done (requires consent). */
  @Post('onboarding/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  completeOnboarding(@Tester() ctx: TesterContext): Promise<void> {
    return this.tester.completeOnboarding(ctx)
  }

  /**
   * The design to render for one of the participant's prototypes.
   *
   * @throws {403} Consent not given.
   * @throws {404} Not a prototype of this participant's group.
   */
  @Get('variants/:variantId')
  prototype(
    @Tester() ctx: TesterContext,
    @UuidParam('variantId') variantId: string,
  ): Promise<TesterPrototypeDto> {
    return this.tester.prototype(ctx, variantId)
  }

  /**
   * Start (or resume) a task.
   *
   * @throws {403} Consent or onboarding missing.
   * @throws {409} The task was already finished on this prototype.
   */
  @Post('tasks/:taskId/start')
  @HttpCode(HttpStatus.OK)
  startTask(
    @Tester() ctx: TesterContext,
    @UuidParam('taskId') taskId: string,
    @Body() dto: StartTaskDto,
  ): Promise<TaskRunDto> {
    return this.tester.startTask(ctx, taskId, dto)
  }

  /**
   * Finish a task run as completed or abandoned.
   *
   * @throws {404} Not the participant's run.
   * @throws {409} Already finished.
   */
  @Post('task-runs/:runId/finish')
  @HttpCode(HttpStatus.OK)
  finishTask(
    @Tester() ctx: TesterContext,
    @UuidParam('runId') runId: string,
    @Body() dto: FinishTaskDto,
  ): Promise<TaskRunDto> {
    return this.tester.finishTask(ctx, runId, dto)
  }

  /** Send a batch (≤ 100) of interaction events. All or none are stored. */
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ limit: 120, windowMs: MINUTE, by: 'participant' })
  events(
    @Tester() ctx: TesterContext,
    @Body() dto: RecordEventsDto,
  ): Promise<{ accepted: number }> {
    return this.tester.recordEvents(ctx, dto)
  }

  /**
   * Give feedback on a component or a whole screen, or skip.
   *
   * @remarks Stored exactly as written and never edited afterwards.
   */
  @Post('feedback')
  @RateLimit({ limit: 60, windowMs: MINUTE, by: 'participant' })
  submitFeedback(
    @Tester() ctx: TesterContext,
    @Body() dto: SubmitFeedbackDto,
  ): Promise<FeedbackDto> {
    return this.tester.submitFeedback(ctx, dto)
  }

  /** The participant's own submissions. */
  @Get('feedback')
  ownFeedback(@Tester() ctx: TesterContext): Promise<FeedbackDto[]> {
    return this.tester.ownFeedback(ctx)
  }

  /** Finish participating. */
  @Post('complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  complete(@Tester() ctx: TesterContext): Promise<void> {
    return this.tester.complete(ctx)
  }
}
