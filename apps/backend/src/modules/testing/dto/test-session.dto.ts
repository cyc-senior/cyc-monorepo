import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator'

import { EmailField } from '../../../common/decorators/email-field.decorator'
import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import {
  ConsentDecision,
  FeedbackScope,
  InteractionType,
  ParticipantStatus,
  TaskRunStatus,
  TestSessionStatus,
} from '../../../generated/prisma/client'
import {
  MAX_PARTICIPANTS_PER_REQUEST,
  MAX_SESSION_VARIANTS,
  MAX_TASKS_PER_SESSION,
} from '../testing.constants'

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export class CreateTestSessionDto {
  /** Design round whose approved variants are tested. */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roundId: string

  /** @example 'Checkout – first impressions' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  /**
   * APPROVED variants of the round to put in front of testers (1–4). One
   * variant is a usability test, several make it a comparative test.
   */
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SESSION_VARIANTS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  variantIds: string[]

  /** Identifies the version of `consentText`. Defaults to the platform's PDPA notice. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  consentVersion?: string

  /** The PDPA notice participants must accept. Defaults to the platform's notice. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  consentText?: string

  /** Participants cannot enter before this. Defaults to the activation time. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date

  /** After this, nobody can enter or continue. Required to activate; at most 60 days out. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date
}

export class UpdateTestSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  /** Only while the session is a draft. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  consentVersion?: string

  /** Only while the session is a draft (consent already given must stay valid). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  consentText?: string

  /** Only while the session is a draft. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date

  /** While active, the deadline can be moved (not past 60 days from activation). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date
}

export class EndTestSessionDto {
  /** Why the session ended (kept in the decision history). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string
}

export class TestSessionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roundId?: string

  @ApiPropertyOptional({
    enum: TestSessionStatus,
    enumName: 'TestSessionStatus',
  })
  @IsOptional()
  @IsEnum(TestSessionStatus)
  status?: TestSessionStatus
}

export class SessionVariantDto {
  @ApiProperty({ format: 'uuid' })
  variantId: string

  /** "A", "B", ... in the order the variants were given. */
  label: string | null

  /** The variant's name. */
  name: string
}

export class TestSessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  @ApiProperty({ format: 'uuid' })
  roundId: string

  title: string

  description: string | null

  @ApiProperty({ enum: TestSessionStatus, enumName: 'TestSessionStatus' })
  status: TestSessionStatus

  /** An ACTIVE session past its deadline: nobody can enter or continue. */
  expired: boolean

  consentVersion: string

  consentText: string

  startsAt: Date | null

  expiresAt: Date | null

  activatedAt: Date | null

  endedAt: Date | null

  createdAt: Date

  updatedAt: Date

  variants: SessionVariantDto[]

  taskCount: number

  participantCount: number
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export class CreateTestTaskDto {
  /** @example 'Buy a pair of shoes' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string

  /** What the participant is asked to do. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  instructions: string

  /** What counts as success (for the designer; shown to nobody else). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  successCriteria?: string
}

export class UpdateTestTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  instructions?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  successCriteria?: string

  /** 1-based place in the list; the other tasks shift. */
  @IsOptional()
  @IsIn(Array.from({ length: MAX_TASKS_PER_SESSION }, (_, i) => i + 1))
  position?: number
}

export class TestTaskDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  sessionId: string

  position: number

  title: string

  instructions: string

  successCriteria: string | null

  createdAt: Date

  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export class InviteParticipantDto {
  @EmailField()
  email: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string

  /** A variant of the session (A/B between groups). Omit to let `assignment` decide. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedVariantId?: string
}

export class InviteParticipantsDto {
  @ApiProperty({ type: [InviteParticipantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARTICIPANTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => InviteParticipantDto)
  participants: InviteParticipantDto[]

  /**
   * How participants without an explicit variant are placed: `ALL` — they test
   * every variant (comparative, within-subjects); `BALANCED` — each gets the
   * variant with the fewest participants (A/B, between-subjects).
   */
  @ApiPropertyOptional({ enum: ['ALL', 'BALANCED'], default: 'ALL' })
  @IsOptional()
  @IsIn(['ALL', 'BALANCED'])
  assignment?: 'ALL' | 'BALANCED'
}

export class ParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  sessionId: string

  @ApiProperty({ format: 'email' })
  email: string

  displayName: string | null

  @ApiProperty({ enum: ParticipantStatus, enumName: 'ParticipantStatus' })
  status: ParticipantStatus

  @ApiProperty({ format: 'uuid' })
  assignedVariantId: string | null

  inviteIssuedAt: Date

  joinedAt: Date | null

  onboardedAt: Date | null

  completedAt: Date | null

  withdrawnAt: Date | null

  /** Whether the participant's latest consent for this session is GRANTED. */
  consentGranted: boolean
}

export class ParticipantInvitationDto extends ParticipantDto {
  /**
   * The secret invitation token. Shown **once**: only its hash is stored, so
   * it cannot be recovered (issue a new one with `POST .../invite`).
   */
  inviteToken: string

  /**
   * Link to give the participant. The token sits in the URL fragment, which
   * browsers do not send to servers, proxies or referrers.
   */
  inviteUrl: string
}

export class ParticipantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ParticipantStatus,
    enumName: 'ParticipantStatus',
  })
  @IsOptional()
  @IsEnum(ParticipantStatus)
  status?: ParticipantStatus
}

export class ConsentRecordDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  participantId: string

  consentVersion: string

  /** SHA-256 of the notice text that was shown. */
  textHash: string

  @ApiProperty({ enum: ConsentDecision, enumName: 'ConsentDecision' })
  decision: ConsentDecision

  createdAt: Date
}

export class ConsentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  participantId?: string
}

// ---------------------------------------------------------------------------
// Progress and raw results (designers)
// ---------------------------------------------------------------------------

export class TaskProgressDto {
  @ApiProperty({ format: 'uuid' })
  taskId: string

  title: string

  inProgress: number

  completed: number

  abandoned: number
}

export class SessionProgressDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string

  /** Participants by status (`INVITED`, `JOINED`, `COMPLETED`, `WITHDRAWN`, `REVOKED`). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: { INVITED: 2, JOINED: 3, COMPLETED: 5, WITHDRAWN: 0, REVOKED: 0 },
  })
  participants: Record<ParticipantStatus, number>

  consentGranted: number

  consentDeclined: number

  /** Per task: runs by status. */
  @ApiProperty({ type: () => [TaskProgressDto] })
  tasks: TaskProgressDto[]

  feedbackCount: number

  skippedFeedbackCount: number

  eventCount: number
}

export class FeedbackQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  participantId?: string

  @ApiPropertyOptional({ enum: FeedbackScope, enumName: 'FeedbackScope' })
  @IsOptional()
  @IsEnum(FeedbackScope)
  scope?: FeedbackScope
}

export class FeedbackDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  sessionId: string

  /** Pseudonymous: the participant's email is not part of feedback views. */
  @ApiProperty({ format: 'uuid' })
  participantId: string

  @ApiProperty({ format: 'uuid' })
  variantId: string

  @ApiProperty({ format: 'uuid' })
  taskRunId: string | null

  @ApiProperty({ enum: FeedbackScope, enumName: 'FeedbackScope' })
  scope: FeedbackScope

  screenId: string | null

  nodeId: string | null

  rating: number | null

  /** The participant's own words, exactly as submitted. */
  comment: string | null

  skipped: boolean

  createdAt: Date
}

export class InteractionEventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  participantId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantId?: string

  @ApiPropertyOptional({ enum: InteractionType, enumName: 'InteractionType' })
  @IsOptional()
  @IsEnum(InteractionType)
  type?: InteractionType
}

export class InteractionEventDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  participantId: string

  @ApiProperty({ format: 'uuid' })
  variantId: string

  @ApiProperty({ format: 'uuid' })
  taskRunId: string | null

  @ApiProperty({ enum: InteractionType, enumName: 'InteractionType' })
  type: InteractionType

  screenId: string | null

  nodeId: string | null

  @JsonOutput('Small structured detail of the event.')
  metadata: Record<string, unknown>

  occurredAt: Date
}

export class TaskRunDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  taskId: string

  @ApiProperty({ format: 'uuid' })
  participantId: string

  @ApiProperty({ format: 'uuid' })
  variantId: string

  @ApiProperty({ enum: TaskRunStatus, enumName: 'TaskRunStatus' })
  status: TaskRunStatus

  startedAt: Date

  finishedAt: Date | null

  durationMs: number | null
}
