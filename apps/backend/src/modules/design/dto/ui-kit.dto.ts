import { ApiProperty } from '@nestjs/swagger'

import { UiLibrary } from '../../../generated/prisma/client'

export class UiKitComponentDto {
  description: string

  /** Prop name → spec: `{ kind: 'enum', values, default }`, `{ kind: 'text', max }`, `{ kind: 'boolean' }`, `{ kind: 'number', min, max }` or `{ kind: 'list', max }`. */
  @ApiProperty({ type: 'object', additionalProperties: true })
  props: Record<string, unknown>

  required: string[]

  /** Whether the component holds child nodes (e.g. Card). */
  container: boolean
}

export class UiKitDto {
  @ApiProperty({ enum: UiLibrary, enumName: 'UiLibrary' })
  library: UiLibrary

  /** @example 'shadcn/ui' */
  name: string

  fonts: string[]

  /** @example 'lucide' */
  iconSet: string

  /** Light theme colors the checks assume. */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { background: '#FFFFFF', foreground: '#0A0A0A' },
  })
  theme: Record<string, string>

  /** The components INSTANCE nodes may use, by `componentKey`. */
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/UiKitComponentDto' },
  })
  components: Record<string, UiKitComponentDto>

  /** JSON Schema (2020-12) of a variant's `design` document. */
  @ApiProperty({ type: 'object', additionalProperties: true })
  documentSchema: Record<string, unknown>
}
