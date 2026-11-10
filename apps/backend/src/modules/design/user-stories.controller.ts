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
  CreateUserStoryDto,
  UserStoryDto,
  UpdateUserStoryDto,
  UserStoryQueryDto,
} from './dto/user-story.dto'
import { UserStoriesService } from './user-stories.service'

@ApiTags('user-stories')
@AuditEntity('UserStory')
@Controller('projects/:projectId/user-stories')
export class UserStoriesController {
  constructor(private readonly service: UserStoriesService) {}

  /** List the user stories of a project (newest first). */
  @Get()
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(UserStoryDto)
  list(
    @UuidParam('projectId') projectId: string,
    @Query() query: UserStoryQueryDto,
  ): Promise<Page<UserStoryDto>> {
    return this.service.list(projectId, query)
  }

  /** Create a user story. */
  @Post()
  @Authorize(Permission.DesignWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @Body() dto: CreateUserStoryDto,
  ): Promise<UserStoryDto> {
    return this.service.create(projectId, dto)
  }

  /** Get a user story. */
  @Get(':id')
  @Authorize(Permission.DesignRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('id') id: string,
  ): Promise<UserStoryDto> {
    return this.service.get(projectId, id)
  }

  /** Update a user story. */
  @Patch(':id')
  @Authorize(Permission.DesignWrite)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('id') id: string,
    @Body() dto: UpdateUserStoryDto,
  ): Promise<UserStoryDto> {
    return this.service.update(projectId, id, dto)
  }

  /** Delete a user story. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.DesignWrite)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('id') id: string,
  ): Promise<void> {
    return this.service.remove(projectId, id)
  }
}
