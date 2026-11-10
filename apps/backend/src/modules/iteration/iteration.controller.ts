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

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  DecisionDto,
  DecisionQueryDto,
  IterationDto,
  RoundTraceDto,
  StartIterationDto,
} from './dto/iteration.dto'
import { IterationService } from './iteration.service'

@ApiTags('design-rounds')
@AuditEntity('DesignRound')
@Controller('projects/:projectId')
export class IterationController {
  constructor(private readonly iteration: IterationService) {}

  /**
   * Start the next iteration from the feedback the designer selected.
   *
   * @remarks Opens the round that follows this one, records which reviewed
   * themes it addresses, and optionally copies variants forward. Generate or
   * refine designs in it with a generation job; the themes are part of the
   * prompt (as the designer's reviewed text, never raw participant feedback).
   * @throws {409} Archived round, or no selected theme left to address.
   */
  @Post('rounds/:roundId/iterate')
  @HttpCode(HttpStatus.CREATED)
  @Authorize(Permission.IterationManage)
  @AuditAction('iterate')
  start(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: StartIterationDto,
  ): Promise<IterationDto> {
    return this.iteration.start(projectId, roundId, userId, dto)
  }

  /** How a round came to be: themes addressed, variant lineage, decisions, child rounds. */
  @Get('rounds/:roundId/trace')
  @Authorize(Permission.DesignRead)
  trace(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
  ): Promise<RoundTraceDto> {
    return this.iteration.trace(projectId, roundId)
  }

  /** The project's decision history (newest first): approvals, selections, won't-fix, iterations. */
  @Get('decisions')
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(DecisionDto)
  decisions(
    @UuidParam('projectId') projectId: string,
    @Query() query: DecisionQueryDto,
  ): Promise<Page<DecisionDto>> {
    return this.iteration.decisions(projectId, query)
  }
}
