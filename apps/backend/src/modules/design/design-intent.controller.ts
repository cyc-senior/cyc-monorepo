import { Body, Controller, Get, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditEntity } from '../audit/audit.decorators'
import { DesignIntentService } from './design-intent.service'
import { DesignIntentDto, PutDesignIntentDto } from './dto/design-intent.dto'

@ApiTags('design-intent')
@AuditEntity('DesignIntent')
@Controller('projects/:projectId/design-intent')
export class DesignIntentController {
  constructor(private readonly intents: DesignIntentService) {}

  /**
   * Get the project's design intent.
   *
   * @throws {404} Not defined yet.
   */
  @Get()
  @Authorize(Permission.DesignRead)
  get(@UuidParam('projectId') projectId: string): Promise<DesignIntentDto> {
    return this.intents.get(projectId)
  }

  /**
   * Define or replace the design intent.
   *
   * @remarks The step after creating a project: design system & standards,
   * brand & CI (three colors and notes), tone of voice for the LLM and the
   * intent statement. User personas are added with
   * `POST /projects/{projectId}/personas`. All of it is part of every design
   * prompt. Bumps `version`.
   */
  @Put()
  @Authorize(Permission.DesignWrite)
  put(
    @UuidParam('projectId') projectId: string,
    @Body() dto: PutDesignIntentDto,
  ): Promise<DesignIntentDto> {
    return this.intents.put(projectId, dto)
  }
}
