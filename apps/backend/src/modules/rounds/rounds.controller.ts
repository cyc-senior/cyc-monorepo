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

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateDesignRoundDto,
  DesignRoundDto,
  DesignRoundQueryDto,
  UpdateDesignRoundDto,
} from './dto/design-round.dto'
import { RoundsService } from './rounds.service'

@ApiTags('design-rounds')
@AuditEntity('DesignRound')
@Controller('projects/:projectId/rounds')
export class RoundsController {
  constructor(private readonly rounds: RoundsService) {}

  /** List design rounds (latest first). */
  @Get()
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(DesignRoundDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: DesignRoundQueryDto,
  ): Promise<Page<DesignRoundDto>> {
    return this.rounds.list(projectId, query)
  }

  /**
   * Start the next design round.
   *
   * @remarks The round number is assigned by the server.
   */
  @Post()
  @Authorize(Permission.DesignWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @Body() dto: CreateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    return this.rounds.create(projectId, dto)
  }

  /** Get a design round. */
  @Get(':roundId')
  @Authorize(Permission.DesignRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
  ): Promise<DesignRoundDto> {
    return this.rounds.get(projectId, roundId)
  }

  /**
   * Update a design round (title, parent, status).
   *
   * @remarks An approved round is frozen and can only be archived. Status
   * APPROVED can only be set through the approve endpoint.
   * @throws {409} The round is approved (frozen; it can only be archived).
   */
  @Patch(':roundId')
  @Authorize(Permission.DesignWrite)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @Body() dto: UpdateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    return this.rounds.update(projectId, roundId, dto)
  }

  /**
   * Approve a design round.
   *
   * @remarks Records the caller as approver and freezes the round. Not
   * repeatable.
   * @throws {409} Already approved or archived.
   */
  @Post(':roundId/approve')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.DesignApprove)
  @AuditAction('approve')
  approve(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
  ): Promise<DesignRoundDto> {
    return this.rounds.approve(projectId, roundId, userId)
  }

  /**
   * Delete a design round and everything produced in it.
   *
   * @remarks Not allowed for an approved round or the last remaining round of
   * the project.
   * @throws {409} Approved round, or the last round.
   */
  @Delete(':roundId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.DesignWrite)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
  ): Promise<void> {
    return this.rounds.remove(projectId, roundId)
  }
}
