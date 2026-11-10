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
import { AuditEntity } from '../audit/audit.decorators'
import {
  CreatePersonaDto,
  PersonaDto,
  PersonaQueryDto,
  UpdatePersonaDto,
} from './dto/persona.dto'
import { PersonasService } from './personas.service'

@ApiTags('personas')
@AuditEntity('UserPersona')
@Controller('projects/:projectId/personas')
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  /**
   * List the project's user personas.
   *
   * @remarks Includes the persona artifacts the LLM synthesized from design
   * prompts (`origin: AI`).
   */
  @Get()
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(PersonaDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: PersonaQueryDto,
  ): Promise<Page<PersonaDto>> {
    return this.personas.list(projectId, query)
  }

  /** Add a user persona to the design intent. */
  @Post()
  @Authorize(Permission.DesignWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @Body() dto: CreatePersonaDto,
  ): Promise<PersonaDto> {
    return this.personas.create(projectId, dto)
  }

  /** Get a user persona. */
  @Get(':personaId')
  @Authorize(Permission.DesignRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('personaId') personaId: string,
  ): Promise<PersonaDto> {
    return this.personas.get(projectId, personaId)
  }

  /** Edit a user persona. */
  @Patch(':personaId')
  @Authorize(Permission.DesignWrite)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('personaId') personaId: string,
    @Body() dto: UpdatePersonaDto,
  ): Promise<PersonaDto> {
    return this.personas.update(projectId, personaId, dto)
  }

  /** Delete a user persona. */
  @Delete(':personaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.DesignWrite)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('personaId') personaId: string,
  ): Promise<void> {
    return this.personas.remove(projectId, personaId)
  }
}
