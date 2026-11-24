import { UiLibrary } from '../../../../generated/prisma/client'
import { MUI_CSS, MUI_FONT, MUI_REFERENCE } from './mui'
import { SHADCN_CSS, SHADCN_FONT, SHADCN_REFERENCE } from './shadcn'

export interface BrandColors {
  primary: string | null
  secondary: string | null
  accent: string | null
}

interface UiKit {
  id: string
  font: string
  css: string
  reference: string
  tokens: (
    brand: Required<{ [K in keyof BrandColors]: string }>,
    minContrast: number,
  ) => string
}

/** Fallbacks when the design intent has no color for a role. */
const DEFAULT_BRAND = {
  primary: '#171717',
  secondary: '#334155',
  accent: '#f59e0b',
}

const KITS: Record<UiLibrary, UiKit> = {
  SHADCN: {
    id: 'shadcn',
    font: SHADCN_FONT,
    css: SHADCN_CSS,
    reference: SHADCN_REFERENCE,
    tokens: (b, min) =>
      `--primary: ${b.primary}; --primary-foreground: ${onColor(b.primary)}; --ring: ${b.primary}; ` +
      `--primary-text: ${readableOnWhite(b.primary, min)};`,
  },
  MUI: {
    id: 'mui',
    font: MUI_FONT,
    css: MUI_CSS,
    reference: MUI_REFERENCE,
    tokens: (b, min) =>
      `--mui-primary: ${b.primary}; --mui-primary-contrast: ${onColor(b.primary)}; ` +
      `--mui-primary-text: ${readableOnWhite(b.primary, min)}; ` +
      `--mui-secondary: ${b.secondary}; --mui-secondary-contrast: ${onColor(b.secondary)}; ` +
      `--mui-secondary-text: ${readableOnWhite(b.secondary, min)};`,
  },
}

/** The component reference the design prompt gives the model. */
export function uiKitReference(system: UiLibrary): string {
  return KITS[system].reference
}

/** Both kit blocks this module adds (font link and stylesheet). */
const KIT_BLOCKS =
  /<link\b[^>]*\bdata-ui-kit\b[^>]*>\s*|<style\b[^>]*\bdata-ui-kit\b[^>]*>[\s\S]*?<\/style>\s*/gi

/** The document without the kit (e.g. to send a design back to the model). */
export function stripUiKit(html: string): string {
  return html.replace(KIT_BLOCKS, '')
}

/**
 * Adds the design system's stylesheet to a generated document, last in
 * <head> so the model's own CSS cannot restyle the components, with the
 * brand colors as the kit's tokens (`--primary` = brand primary, …) plus
 * `--brand-primary|secondary|accent` and readable `-foreground` colors for
 * layout use. Idempotent: an existing kit block is replaced.
 */
export function applyUiKit(
  html: string,
  system: UiLibrary,
  colors: BrandColors,
  /** Contrast normal text needs: 4.5 (AA) or 7 (AAA). */
  minContrast = 4.5,
): string {
  const kit = KITS[system]
  const brand = {
    primary: hexOr(colors.primary, DEFAULT_BRAND.primary),
    secondary: hexOr(colors.secondary, DEFAULT_BRAND.secondary),
    accent: hexOr(colors.accent, DEFAULT_BRAND.accent),
  }
  const tokens = [
    kit.tokens(brand, minContrast),
    ...Object.entries(brand).map(
      ([role, hex]) =>
        `--brand-${role}: ${hex}; --brand-${role}-foreground: ${onColor(hex)}; ` +
        `--brand-${role}-text: ${readableOnWhite(hex, minContrast)};`,
    ),
  ].join(' ')
  const block =
    `<link data-ui-kit="${kit.id}" rel="stylesheet" href="${kit.font}">\n` +
    `<style data-ui-kit="${kit.id}">\n${kit.css}\n:root { ${tokens} }\n</style>\n`

  const doc = stripUiKit(html)
  if (/<\/head>/i.test(doc)) {
    return doc.replace(/<\/head>/i, `${block}</head>`)
  }
  if (/<html\b[^>]*>/i.test(doc)) {
    return doc.replace(
      /<html\b[^>]*>/i,
      (open) => `${open}<head>${block}</head>`,
    )
  }

  return `<head>${block}</head>${doc}`
}

/** shadcn slots a model may write as a class name instead (`class="card"`). */
const SHADCN_CLASS_SLOTS = new Set([
  'card',
  'card-header',
  'card-title',
  'card-description',
  'card-action',
  'card-content',
  'card-footer',
  'badge',
  'alert',
  'alert-title',
  'alert-description',
  'avatar',
  'avatar-fallback',
  'separator',
  'skeleton',
  'tabs',
  'tabs-list',
  'tabs-trigger',
  'tabs-content',
  'table-container',
  'form-item',
  'form-description',
  'breadcrumb-list',
  'breadcrumb-item',
  'breadcrumb-link',
  'breadcrumb-page',
  'progress',
  'progress-indicator',
  'toggle-group',
  'toggle-group-item',
  'dialog-content',
  'dialog-header',
  'dialog-title',
  'dialog-description',
  'dialog-footer',
])

/** Slots that only make sense on one kind of element. */
const SHADCN_TAG_SLOTS: Record<string, { tags: string[]; slot: string }> = {
  btn: { tags: ['button', 'a'], slot: 'button' },
  button: { tags: ['button', 'a'], slot: 'button' },
  input: { tags: ['input'], slot: 'input' },
  textarea: { tags: ['textarea'], slot: 'textarea' },
  select: { tags: ['select'], slot: 'select' },
  label: { tags: ['label'], slot: 'label' },
  table: { tags: ['table'], slot: 'table' },
}

/**
 * Guardrail run before the kit is applied: the kit styles components by
 * `data-slot`, but models sometimes write the component name as a class
 * (`<div class="card">`, `<div class="card-header">`), which leaves it
 * unstyled (no padding, borders, …). Such elements get the matching
 * `data-slot`. Returns the document and how many elements were marked.
 */
export function normalizeKitMarkup(
  html: string,
  system: UiLibrary,
): { html: string; marked: number } {
  if (system !== 'SHADCN') {
    return { html, marked: 0 }
  }
  let marked = 0
  const out = html.replace(
    /<([a-z][a-z0-9]*)(\s[^<>]*?)?(\/?)>/gi,
    (tag, name: string, attrs: string | undefined, selfClose: string) => {
      if (!attrs || /\sdata-slot\s*=/i.test(attrs)) {
        return tag
      }
      const cls = attrs.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
      if (!cls) {
        return tag
      }
      const tagName = name.toLowerCase()
      let slot: string | undefined
      for (const token of (cls[1] ?? cls[2]).split(/\s+/)) {
        const t = token.toLowerCase()
        const bound = SHADCN_TAG_SLOTS[t]
        if (SHADCN_CLASS_SLOTS.has(t)) {
          slot = t
        } else if (bound?.tags.includes(tagName)) {
          slot = bound.slot
        }
        if (slot) {
          break
        }
      }
      if (!slot) {
        return tag
      }
      marked++

      return `<${name}${attrs} data-slot="${slot}"${selfClose}>`
    },
  )

  return { html: out, marked }
}

function hexOr(value: string | null, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

/** White or near-black, whichever reads better on `hex` (WCAG contrast). */
export function onColor(hex: string): string {
  const luminance = relativeLuminance(hex)
  const onWhite = (1 + 0.05) / (luminance + 0.05)
  const onBlack = (luminance + 0.05) / (0.0039 + 0.05)

  return onWhite >= onBlack ? '#FFFFFF' : '#0A0A0A'
}

/**
 * The color itself if it is readable as text on white, else the same hue
 * darkened (mixed with black) until it reaches `minContrast`.
 */
export function readableOnWhite(hex: string, minContrast: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  for (let keep = 1; keep >= 0; keep -= 0.02) {
    const mixed = `#${[r, g, b]
      .map((c) =>
        Math.round(c * keep)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`.toUpperCase()
    if (1.05 / (relativeLuminance(mixed) + 0.05) >= minContrast) {
      return mixed
    }
  }

  return '#000000'
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
