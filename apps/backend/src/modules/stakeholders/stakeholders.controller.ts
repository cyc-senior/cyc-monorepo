import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { NoCache } from '../../cache/no-cache.decorator'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import {
  ApiPaginatedResponse,
  Page,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto'
import { Access } from '../access/access.decorator'
import { AccessContext } from '../access/access.types'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateRoundCommentDto,
  HandoffDto,
  HandoffSpecDto,
  ProjectStatusDto,
  RoundCommentDto,
  SharedRoundDetailDto,
  SharedRoundDto,
} from './dto/stakeholder.dto'
import { HandoffService } from './handoff.service'
import { ProjectInsightsService } from './project-insights.service'
import { SharedRoundsService } from './shared-rounds.service'

/**
 * Stakeholder views of a project. They show approved rounds and aggregates
 * only — never drafts, generation inputs, participants, raw feedback or
 * consent records.
 */
@ApiTags('stakeholders')
@AuditEntity('SharedRound')
@Controller('projects/:projectId')
export class StakeholdersController {
  constructor(
    private readonly rounds: SharedRoundsService,
    private readonly handoff: HandoffService,
    private readonly insights: ProjectInsightsService,
  ) {}

  /** List the approved (shared) rounds. */
  @Get('shared-rounds')
  @Authorize(Permission.SharedRoundRead)
  @ApiPaginatedResponse(SharedRoundDto)
  list(
    @UuidParam('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<SharedRoundDto>> {
    return this.rounds.list(projectId, userId, query)
  }

  /**
   * Get an approved round with its approved prototypes.
   *
   * @throws {404} The round does not exist, or is not approved.
   */
  @Get('shared-rounds/:roundId')
  @Authorize(Permission.SharedRoundRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
  ): Promise<SharedRoundDetailDto> {
    return this.rounds.get(projectId, userId, roundId)
  }

  /**
   * Acknowledge a shared round (clients).
   *
   * @remarks Idempotent.
   */
  @Post('shared-rounds/:roundId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.SharedRoundRespond)
  @AuditAction('acknowledge')
  acknowledge(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
  ): Promise<SharedRoundDto> {
    return this.rounds.acknowledge(projectId, userId, roundId)
  }

  /** List the comments on a shared round. */
  @Get('shared-rounds/:roundId/comments')
  @Authorize(Permission.SharedRoundRead)
  @ApiPaginatedResponse(RoundCommentDto)
  comments(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<RoundCommentDto>> {
    return this.rounds.comments(projectId, userId, roundId, query)
  }

  /** Comment on a shared round (clients). */
  @Post('shared-rounds/:roundId/comments')
  @Authorize(Permission.SharedRoundRespond)
  @AuditAction('comment')
  comment(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoundCommentDto,
  ): Promise<RoundCommentDto> {
    return this.rounds.comment(projectId, userId, roundId, dto)
  }

  /** The development handoff: UI kit, tokens, components used and technical risks of approved designs. */
  @Get('handoff')
  @Authorize(Permission.HandoffRead)
  getHandoff(@UuidParam('projectId') projectId: string): Promise<HandoffDto> {
    return this.handoff.handoff(projectId)
  }

  /**
   * The specification of one approved design (the design document to build from).
   *
   * @throws {404} Not an approved variant of an approved round.
   */
  @Get('handoff/variants/:variantId')
  @Authorize(Permission.HandoffRead)
  spec(
    @UuidParam('projectId') projectId: string,
    @UuidParam('variantId') variantId: string,
  ): Promise<HandoffSpecDto> {
    return this.handoff.spec(projectId, variantId)
  }

  /** Live project status: round progress, testing progress and timeline gaps. */
  @Get('status')
  @NoCache()
  @Authorize(Permission.StatusRead)
  async status(
    @UuidParam('projectId') projectId: string,
    @Access() access: AccessContext,
  ): Promise<ProjectStatusDto> {
    void access

    return { status: await this.insights.status(projectId) }
  }
}
