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
  CreateUIVariantDto,
  UIVariantDto,
  UIVariantQueryDto,
  UpdateUIVariantDto,
} from './dto/ui-variant.dto'
import { UIVariantsService } from './ui-variants.service'

@ApiTags('ui-variants')
@AuditEntity('UIVariant')
@Controller('projects/:projectId')
export class UIVariantsController {
  constructor(private readonly variants: UIVariantsService) {}

  /** List the UI variants of a round. */
  @Get('rounds/:roundId/variants')
  @Authorize(Permission.DesignRead)
  @ApiPaginatedResponse(UIVariantDto)
  list(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @Query() query: UIVariantQueryDto,
  ): Promise<Page<UIVariantDto>> {
    return this.variants.list(projectId, roundId, query)
  }

  /**
   * Add a hand-made design to a round.
   *
   * @remarks Usually variants come from generation jobs. The design must use
   * the project's UI kit and pass WCAG 2.0 AA; `storyIds` links the user
   * stories it addresses.
   * @throws {409} The round is approved or archived.
   * @throws {422} The design fails the UI kit or WCAG checks (`issues` lists why).
   */
  @Post('rounds/:roundId/variants')
  @Authorize(Permission.DesignWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @UuidParam('roundId') roundId: string,
    @Body() dto: CreateUIVariantDto,
  ): Promise<UIVariantDto> {
    return this.variants.create(projectId, roundId, dto)
  }

  /** Get a UI variant. */
  @Get('variants/:variantId')
  @Authorize(Permission.DesignRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('variantId') variantId: string,
  ): Promise<UIVariantDto> {
    return this.variants.get(projectId, variantId)
  }

  /**
   * Update a UI variant, e.g. an edited design.
   *
   * @remarks Bumps the variant version. A new `design` is checked again
   * (UI kit and WCAG 2.0 AA). `storyIds` replaces the linked set.
   * @throws {409} The round is approved or archived.
   * @throws {422} The design fails the UI kit or WCAG checks (`issues` lists why).
   */
  @Patch('variants/:variantId')
  @Authorize(Permission.DesignWrite)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('variantId') variantId: string,
    @Body() dto: UpdateUIVariantDto,
  ): Promise<UIVariantDto> {
    return this.variants.update(projectId, variantId, dto)
  }

  /** Delete a UI variant. */
  @Delete('variants/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorize(Permission.DesignWrite)
  remove(
    @UuidParam('projectId') projectId: string,
    @UuidParam('variantId') variantId: string,
  ): Promise<void> {
    return this.variants.remove(projectId, variantId)
  }
}
