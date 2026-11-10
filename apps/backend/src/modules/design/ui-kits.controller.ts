import { Controller, Get, Param, ParseEnumPipe } from '@nestjs/common'
import { ApiExtraModels, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'

import { UiLibrary } from '../../generated/prisma/client'
import { ApiAuthenticated } from '../auth/decorators/api-authenticated.decorator'
import { designDocumentSchema } from './document/design-document'
import { UI_KITS } from './document/ui-kits'
import { UiKitComponentDto, UiKitDto } from './dto/ui-kit.dto'

const DOCUMENT_SCHEMA = z.toJSONSchema(designDocumentSchema, {
  target: 'draft-2020-12',
}) as Record<string, unknown>

@ApiTags('ui-kits')
@ApiExtraModels(UiKitComponentDto)
@ApiAuthenticated()
@Controller('ui-kits')
export class UiKitsController {
  /**
   * Describe a UI kit and the design document format.
   *
   * @remarks The components (and their props) designs may use, the theme the
   * WCAG checks assume, and the JSON Schema of a design document, for
   * rendering and editing variants.
   */
  @Get(':uiLibrary')
  get(
    @Param('uiLibrary', new ParseEnumPipe(UiLibrary)) uiLibrary: UiLibrary,
  ): UiKitDto {
    const kit = UI_KITS[uiLibrary]

    return {
      library: kit.library,
      name: kit.name,
      fonts: [...kit.fonts],
      iconSet: kit.iconSet,
      theme: { ...kit.theme },
      components: Object.fromEntries(
        Object.entries(kit.components).map(([key, component]) => [
          key,
          {
            description: component.description,
            props: component.props,
            required: [...component.required],
            container: Boolean(component.container),
          },
        ]),
      ),
      documentSchema: DOCUMENT_SCHEMA,
    }
  }
}
