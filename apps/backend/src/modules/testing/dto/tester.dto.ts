import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

import { JsonOutput } from '../../../common/decorators/json-field.decorator'
import {
  ConsentDecision,
  FeedbackScope,
  InteractionType,
  ParticipantStatus,
  TaskRunStatus,
  TestSessionStatus,
} from '../../../generated/prisma/client'
import { MAX_EVENTS_PER_BATCH } from '../testing.constants'

export class JoinSessionDto {
  /** The invitation token from the link a designer sent you. */
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string
}

export class TesterTokenDto {
  /** Send as `Authorization: Bearer` on every `/testing/...` call. */
  accessToken: string

  /** @example 'Bearer' */
  tokenType: 'Bearer'

  /** Seconds until it expires (never later than the session deadline). */
  expiresIn: number
}

export class RecordConsentDto {
  /** Must equal the session's current `consent.version`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  consentVersion: string

  @ApiProperty({ enum: ['GRANTED', 'DECLINED'] })
  @IsIn(['GRANTED', 'DECLINED'])
  decision: 'GRANTED' | 'DECLINED'
}

export class WithdrawConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  consentVersion: string
}

export class TesterConsentDto {
  version: string

  /** The notice to show. */
  text: string

  /** Latest decision of this participant for this session and version; null = none yet. */
  @ApiProperty({ enum: ConsentDecision, enumName: 'ConsentDecision' })
  decision: ConsentDecision | null

  decidedAt: Date | null
}

export class TesterVariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  label: string | null

  name: string
}

export class TesterTaskRunDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  variantId: string

  @ApiProperty({ enum: TaskRunStatus, enumName: 'TaskRunStatus' })
  status: TaskRunStatus
}

export class TesterTaskDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  position: number

  title: string

  instructions: string

  /** Your runs of this task, per variant. */
  @ApiProperty({ type: () => [TesterTaskRunDto] })
  runs: TesterTaskRunDto[]
}

export class TesterSessionDto {
  title: string

  description: string | null

  @ApiProperty({ enum: TestSessionStatus, enumName: 'TestSessionStatus' })
  status: TestSessionStatus

  expiresAt: Date | null

  @ApiProperty({ enum: ParticipantStatus, enumName: 'ParticipantStatus' })
  participantStatus: ParticipantStatus

  /** Whether the onboarding step has been completed. */
  onboarded: boolean

  consent: TesterConsentDto

  /** The variants you test (one for an A/B group, several for a comparison). */
  variants: TesterVariantDto[]

  /** Empty until consent is granted. */
  tasks: TesterTaskDto[]
}

export class TesterPrototypeDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  label: string | null

  name: string

  /** Design system the design follows (`SHADCN` or `MUI`). */
  uiLibrary: string

  /** The prototype: a sanitized HTML document. Render it in `<iframe sandbox srcdoc>`. */
  html: string | null

  @JsonOutput(
    'Legacy JSON design (prototypes made before HTML generation); null otherwise.',
  )
  design: Record<string, unknown> | null
}

export class StartTaskDto {
  /** Required when you test several variants; ignored for an assigned group. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantId?: string
}

export class FinishTaskDto {
  @ApiProperty({ enum: ['COMPLETED', 'ABANDONED'] })
  @IsIn(['COMPLETED', 'ABANDONED'])
  status: 'COMPLETED' | 'ABANDONED'
}

export class InteractionEventInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  taskRunId?: string

  @ApiProperty({ enum: InteractionType, enumName: 'InteractionType' })
  @IsEnum(InteractionType)
  type: InteractionType

  /** Top-level frame (screen) of the design. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  screenId?: string

  /** Node of the design the event is about. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nodeId?: string

  /** Small structured detail (coordinates, route, ...). Never typed text. Max 2 KB. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  /** When it happened on the device. */
  @Type(() => Date)
  @IsDate()
  occurredAt: Date
}

export class RecordEventsDto {
  @ApiProperty({ type: [InteractionEventInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EVENTS_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => InteractionEventInputDto)
  events: InteractionEventInputDto[]
}

export class SubmitFeedbackDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  taskRunId?: string

  /** COMPONENT feedback is about one node (`nodeId`); PAGE feedback about a screen or the whole prototype. */
  @ApiProperty({ enum: FeedbackScope, enumName: 'FeedbackScope' })
  @IsEnum(FeedbackScope)
  scope: FeedbackScope

  @IsOptional()
  @IsString()
  @MaxLength(200)
  screenId?: string

  /** Required for COMPONENT feedback. */
  @ValidateIf((dto: SubmitFeedbackDto) => dto.scope === 'COMPONENT')
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nodeId?: string

  /** 1 (very poor) – 5 (very good). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number

  /** Your words. Required unless `skipped`. */
  @ValidateIf((dto: SubmitFeedbackDto) => !dto.skipped)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  comment?: string

  /** You chose not to give feedback here. */
  @IsOptional()
  @IsBoolean()
  skipped?: boolean
}
