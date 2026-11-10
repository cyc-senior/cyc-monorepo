import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { NoCache } from '../../cache/no-cache.decorator'
import { UuidParam } from '../../common/decorators/uuid-param.decorator'
import { ApiPaginatedResponse, Page } from '../../common/dto/pagination.dto'
import { Authorize } from '../access/authorize.decorator'
import { Permission } from '../access/permissions'
import { AuditAction, AuditEntity } from '../audit/audit.decorators'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateThemeDto,
  MergeThemesDto,
  SelectThemeDto,
  SplitThemeDto,
  ThemeDto,
  ThemeQueryDto,
  UpdateThemeDto,
  WontFixDto,
} from './dto/analysis.dto'
import { ThemesService } from './themes.service'

/**
 * The designer's review of an analysis' themes. The AI's suggestion stays
 * visible in `ai*`; the plain fields are what the designer stands behind.
 */
@ApiTags('feedback-analysis')
@AuditEntity('FeedbackTheme')
@NoCache()
@Controller('projects/:projectId/analyses/:analysisId/themes')
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  /** List the themes of an analysis. */
  @Get()
  @Authorize(Permission.AnalysisRead)
  @ApiPaginatedResponse(ThemeDto)
  list(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @Query() query: ThemeQueryDto,
  ): Promise<Page<ThemeDto>> {
    return this.themes.list(projectId, analysisId, query)
  }

  /**
   * Add a theme by hand.
   *
   * @throws {400} A feedback id is not covered by this analysis.
   * @throws {409} The analysis is not awaiting review.
   */
  @Post()
  @Authorize(Permission.AnalysisWrite)
  create(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @Body() dto: CreateThemeDto,
  ): Promise<ThemeDto> {
    return this.themes.create(projectId, analysisId, dto)
  }

  /**
   * Merge themes into one new theme.
   *
   * @remarks The merged themes stay, marked MERGED and pointing at the new one.
   * @throws {409} The analysis is not awaiting review.
   */
  @Post('merge')
  @Authorize(Permission.AnalysisWrite)
  @AuditAction('merge')
  merge(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @Body() dto: MergeThemesDto,
  ): Promise<ThemeDto> {
    return this.themes.merge(projectId, analysisId, dto)
  }

  /** Get a theme. */
  @Get(':themeId')
  @Authorize(Permission.AnalysisRead)
  get(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @UuidParam('themeId') themeId: string,
  ): Promise<ThemeDto> {
    return this.themes.get(projectId, analysisId, themeId)
  }

  /**
   * Edit a theme or accept/reject the suggestion.
   *
   * @throws {409} The analysis is not awaiting review, or the theme was merged.
   */
  @Patch(':themeId')
  @Authorize(Permission.AnalysisWrite)
  update(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @UuidParam('themeId') themeId: string,
    @Body() dto: UpdateThemeDto,
  ): Promise<ThemeDto> {
    return this.themes.update(projectId, analysisId, themeId, dto)
  }

  /**
   * Split some feedback off a theme into a new theme.
   *
   * @throws {400} Feedback not in the theme, or nothing would be left.
   * @throws {409} The analysis is not awaiting review.
   */
  @Post(':themeId/split')
  @Authorize(Permission.AnalysisWrite)
  @AuditAction('split')
  split(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @UuidParam('themeId') themeId: string,
    @Body() dto: SplitThemeDto,
  ): Promise<ThemeDto> {
    return this.themes.split(projectId, analysisId, themeId, dto)
  }

  /**
   * Decide not to fix a theme.
   *
   * @remarks The reason is required and kept in the decision history.
   * @throws {409} The analysis is neither READY nor APPROVED, or the theme was merged.
   */
  @Post(':themeId/wont-fix')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.AnalysisWrite)
  @AuditAction('wont_fix')
  wontFix(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @UuidParam('themeId') themeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: WontFixDto,
  ): Promise<ThemeDto> {
    return this.themes.wontFix(
      projectId,
      analysisId,
      themeId,
      userId,
      dto.reason,
    )
  }

  /**
   * Select an accepted theme for the next iteration.
   *
   * @remarks A designer's decision. Needs an APPROVED analysis and an ACCEPTED theme.
   * @throws {409} Analysis not approved, or theme not accepted.
   */
  @Post(':themeId/select')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.IterationManage)
  @AuditAction('select')
  select(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @UuidParam('themeId') themeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SelectThemeDto,
  ): Promise<ThemeDto> {
    return this.themes.select(
      projectId,
      analysisId,
      themeId,
      userId,
      dto.rationale,
    )
  }

  /** Take a theme out of the next iteration. */
  @Post(':themeId/deselect')
  @HttpCode(HttpStatus.OK)
  @Authorize(Permission.IterationManage)
  @AuditAction('deselect')
  deselect(
    @UuidParam('projectId') projectId: string,
    @UuidParam('analysisId') analysisId: string,
    @UuidParam('themeId') themeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SelectThemeDto,
  ): Promise<ThemeDto> {
    return this.themes.deselect(
      projectId,
      analysisId,
      themeId,
      userId,
      dto.rationale,
    )
  }
}
