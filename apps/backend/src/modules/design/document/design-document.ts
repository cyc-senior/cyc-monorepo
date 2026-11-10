import { z } from 'zod'

import { UiLibrary } from '../../../generated/prisma/client'
import { HEX_COLOR } from './color'
import { PropSpec, UiKit } from './ui-kits'

/**
 * Designs are Figma-like JSON documents, not code: a DOCUMENT holds CANVAS
 * pages, whose children are top-level FRAMEs (screens). Layout uses Figma's
 * auto-layout fields; UI kit components are INSTANCE nodes referring to a
 * component of the project's kit by `componentKey`. Colors are hex strings.
 * `a11y` carries the accessibility annotations a Figma file keeps in plugins
 * (role, heading level, text alternative).
 */
export const DESIGN_SCHEMA_VERSION = 1

/** Hard limits that keep documents (and LLM output) bounded. */
export const LIMITS = { screens: 6, children: 80, nodes: 600, depth: 14 }

const hex = z.string().regex(HEX_COLOR, 'a hex color such as #1F2937')
const length = (max: number) => z.number().min(0).max(max)

const solidPaint = z
  .object({
    type: z.literal('SOLID'),
    color: hex,
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict()
const imagePaint = z
  .object({
    type: z.literal('IMAGE'),
    scaleMode: z.enum(['FILL', 'FIT']),
    /** What the placeholder image shows (no image bytes in a design). */
    imageDescription: z.string().min(1).max(300),
  })
  .strict()
const paint = z.discriminatedUnion('type', [solidPaint, imagePaint])

const a11y = z
  .object({
    role: z
      .enum([
        'heading',
        'img',
        'banner',
        'navigation',
        'main',
        'contentinfo',
        'form',
        'region',
        'list',
        'listitem',
      ])
      .optional(),
    headingLevel: z.number().int().min(1).max(6).optional(),
    /** Text alternative / accessible name. */
    label: z.string().min(1).max(160).optional(),
    /** Purely decorative: hidden from assistive technology. */
    decorative: z.boolean().optional(),
  })
  .strict()

const sizing = z.enum(['FIXED', 'HUG', 'FILL'])
const propValue = z.union([
  z.string().max(400),
  z.number(),
  z.boolean(),
  z.array(z.string().max(120)).max(20),
])
const textStyle = z
  .object({
    fontFamily: z.string().max(60).optional(),
    fontSize: z.number().min(8).max(200),
    fontWeight: z.number().int().min(100).max(900),
    lineHeightPx: length(400).optional(),
    textAlignHorizontal: z
      .enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'])
      .optional(),
  })
  .strict()

export type SolidPaint = z.infer<typeof solidPaint>
export type Paint = z.infer<typeof paint>
export type A11y = z.infer<typeof a11y>
export type TextStyle = z.infer<typeof textStyle>
export type ComponentProperties = Record<string, z.infer<typeof propValue>>

interface BaseNode {
  id: string
  name: string
  visible?: boolean
  layoutSizingHorizontal?: z.infer<typeof sizing>
  layoutSizingVertical?: z.infer<typeof sizing>
  width?: number
  height?: number
  a11y?: A11y
}
export interface FrameNode extends BaseNode {
  type: 'FRAME'
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  itemSpacing?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX'
  fills?: Paint[]
  strokes?: SolidPaint[]
  strokeWeight?: number
  cornerRadius?: number
  children: DesignNode[]
}
export interface TextNode extends BaseNode {
  type: 'TEXT'
  characters: string
  style: TextStyle
  fills?: SolidPaint[]
}
export interface RectangleNode extends BaseNode {
  type: 'RECTANGLE'
  fills?: Paint[]
  strokes?: SolidPaint[]
  strokeWeight?: number
  cornerRadius?: number
}
export interface InstanceNode extends BaseNode {
  type: 'INSTANCE'
  componentKey: string
  componentProperties: ComponentProperties
  children?: DesignNode[]
}
export type DesignNode = FrameNode | TextNode | RectangleNode | InstanceNode

export interface CanvasNode {
  id: string
  type: 'CANVAS'
  name: string
  backgroundColor: string
  children: FrameNode[]
}
export interface DesignDocument {
  schemaVersion: typeof DESIGN_SCHEMA_VERSION
  name: string
  /** BCP 47 language of the copy (WCAG 3.1.1). */
  lang: string
  uiLibrary: UiLibrary
  /** Rationale: how the design serves the intent. */
  description?: string
  document: {
    id: string
    type: 'DOCUMENT'
    name: string
    children: CanvasNode[]
  }
}

/** What the LLM writes: the screens and their metadata, without the page wrapper. */
export interface GeneratedDesign {
  name: string
  lang: string
  description: string
  screens: FrameNode[]
}

const LANG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

function propSchema(spec: PropSpec, required: boolean): z.ZodType {
  let schema: z.ZodType
  switch (spec.kind) {
    case 'enum':
      schema = z.enum(spec.values as [string, ...string[]])
      break
    case 'text':
      schema = z.string().max(spec.max)
      break
    case 'boolean':
      schema = z.boolean()
      break
    case 'number':
      schema = z.number().min(spec.min).max(spec.max)
      break
    case 'list':
      schema = z.array(z.string().max(120)).min(1).max(spec.max)
      break
  }

  return required ? schema : schema.optional()
}

/**
 * Node schemas. With a kit (for the LLM), every INSTANCE variant is one of the
 * kit's components with exactly its typed props, so constrained decoding
 * cannot produce an unknown component, prop or value. Without one (stored
 * documents), props are free-form and the guardrail in `check-design` judges
 * them, with readable messages.
 */
function nodeSchemas(kit?: UiKit) {
  const base = {
    id: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    visible: z.boolean().optional(),
    layoutSizingHorizontal: sizing.optional(),
    layoutSizingVertical: sizing.optional(),
    width: length(4000).optional(),
    height: length(10000).optional(),
    a11y: a11y.optional(),
  }
  const shape = {
    fills: z.array(paint).max(4).optional(),
    strokes: z.array(solidPaint).max(2).optional(),
    strokeWeight: length(20).optional(),
    cornerRadius: length(999).optional(),
  }

  const frame = z
    .object({
      ...base,
      type: z.literal('FRAME'),
      layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']),
      itemSpacing: length(400).optional(),
      paddingTop: length(400).optional(),
      paddingRight: length(400).optional(),
      paddingBottom: length(400).optional(),
      paddingLeft: length(400).optional(),
      primaryAxisAlignItems: z
        .enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'])
        .optional(),
      counterAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX']).optional(),
      ...shape,
      get children(): z.ZodArray<z.ZodType<DesignNode>> {
        return z.array(node).max(LIMITS.children)
      },
    })
    .strict()
  const text = z
    .object({
      ...base,
      type: z.literal('TEXT'),
      characters: z.string().max(2000),
      style: textStyle,
      fills: z.array(solidPaint).max(1).optional(),
    })
    .strict()
  const rectangle = z
    .object({ ...base, type: z.literal('RECTANGLE'), ...shape })
    .strict()
  const instance = z
    .object({
      ...base,
      type: z.literal('INSTANCE'),
      componentKey: z.string().min(1).max(60),
      componentProperties: z.record(z.string().max(40), propValue),
      get children(): z.ZodOptional<z.ZodArray<z.ZodType<DesignNode>>> {
        return z.array(node).max(LIMITS.children).optional()
      },
    })
    .strict()
  const kitInstances = Object.entries(kit?.components ?? {}).map(
    ([key, component]) => {
      const componentProperties = z
        .object(
          Object.fromEntries(
            Object.entries(component.props).map(([name, spec]) => [
              name,
              propSchema(spec, component.required.includes(name)),
            ]),
          ),
        )
        .strict()
      const fields = {
        ...base,
        type: z.literal('INSTANCE'),
        componentKey: z.literal(key),
        componentProperties,
      }

      return component.container
        ? z
            .object({
              ...fields,
              get children(): z.ZodOptional<z.ZodArray<z.ZodType<DesignNode>>> {
                return z.array(node).max(LIMITS.children).optional()
              },
            })
            .strict()
        : z.object(fields).strict()
    },
  )
  const node: z.ZodType<DesignNode> = (kit
    ? z.union([frame, text, rectangle, ...kitInstances])
    : z.discriminatedUnion('type', [
        frame,
        text,
        rectangle,
        instance,
      ])) as unknown as z.ZodType<DesignNode>

  return { frame: frame as unknown as z.ZodType<FrameNode>, node }
}

const stored = nodeSchemas()

/** A stored (or client-edited) design document. */
export const designDocumentSchema: z.ZodType<DesignDocument> = z
  .object({
    schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
    name: z.string().min(1).max(120),
    lang: z.string().regex(LANG, 'a BCP 47 language tag such as "en"'),
    uiLibrary: z.enum(['SHADCN', 'MUI']),
    description: z.string().max(2000).optional(),
    document: z
      .object({
        id: z.string().min(1).max(40),
        type: z.literal('DOCUMENT'),
        name: z.string().min(1).max(120),
        children: z
          .array(
            z
              .object({
                id: z.string().min(1).max(40),
                type: z.literal('CANVAS'),
                name: z.string().min(1).max(120),
                backgroundColor: hex,
                children: z.array(stored.frame).min(1).max(LIMITS.screens),
              })
              .strict(),
          )
          .min(1)
          .max(3),
      })
      .strict(),
  })
  .strict()

/** The LLM output schema for a kit: only the kit's components, with their props. */
export function generatedDesignSchema(kit: UiKit): z.ZodType<GeneratedDesign> {
  const { frame } = nodeSchemas(kit)

  return z
    .object({
      name: z.string().min(1).max(120),
      lang: z.string().regex(LANG),
      description: z.string().min(1).max(2000),
      screens: z.array(frame).min(1).max(LIMITS.screens),
    })
    .strict()
}

/**
 * Keywords constrained-decoding engines (vLLM/xgrammar, llguidance) reject.
 * They only narrow what zod validates anyway, so dropping them is safe.
 */
const UNSUPPORTED_KEYWORDS = new Set(['$schema', 'propertyNames'])

function withoutUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutUnsupported)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UNSUPPORTED_KEYWORDS.has(key))
        .map(([key, child]) => [key, withoutUnsupported(child)]),
    )
  }

  return value
}

/**
 * JSON Schema of {@link generatedDesignSchema}, for structured output. The
 * model's answer is still validated with the zod schema itself.
 */
export function generatedDesignJsonSchema(kit: UiKit): Record<string, unknown> {
  return withoutUnsupported(
    z.toJSONSchema(generatedDesignSchema(kit), { target: 'draft-2020-12' }),
  ) as Record<string, unknown>
}

/** Iterates every node of the document, depth first, with its ancestors. */
export function* walk(
  nodes: readonly DesignNode[],
  ancestors: readonly DesignNode[] = [],
): Generator<{ node: DesignNode; ancestors: readonly DesignNode[] }> {
  for (const node of nodes) {
    yield { node, ancestors }
    const children = 'children' in node ? node.children : undefined
    if (children?.length) {
      yield* walk(children, [...ancestors, node])
    }
  }
}

export function screensOf(document: DesignDocument): FrameNode[] {
  return document.document.children.flatMap((canvas) => canvas.children)
}

/**
 * Wraps generated screens into a document, renumbering node ids Figma-style
 * (`<screen>:<n>`) so they are unique whatever the model wrote.
 */
export function toDesignDocument(
  generated: GeneratedDesign,
  kit: UiKit,
): DesignDocument {
  const screens = generated.screens.map((screen, index) => {
    let counter = 0
    const renumber = <T extends DesignNode>(node: T): T => {
      const id = `${index + 1}:${counter++}`
      if ('children' in node && node.children) {
        return { ...node, id, children: node.children.map(renumber) }
      }

      return { ...node, id }
    }

    return renumber(screen)
  })

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    name: generated.name,
    lang: generated.lang,
    uiLibrary: kit.library,
    description: generated.description,
    document: {
      id: '0:0',
      type: 'DOCUMENT',
      name: generated.name,
      children: [
        {
          id: '0:1',
          type: 'CANVAS',
          name: 'Screens',
          backgroundColor: kit.theme.background,
          children: screens,
        },
      ],
    },
  }
}

/** The part of a document the LLM edits when repairing it. */
export function toGeneratedDesign(document: DesignDocument): GeneratedDesign {
  return {
    name: document.name,
    lang: document.lang,
    description: document.description ?? '',
    screens: screensOf(document),
  }
}
