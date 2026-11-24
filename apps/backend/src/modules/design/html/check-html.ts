import { DomUtils, parseDocument } from 'htmlparser2'

import { Platform, UiLibrary } from '../../../generated/prisma/client'
import { MAX_HTML_BYTES, sanitizeDesignHtml } from './sanitize-html-design'

type Element = ReturnType<typeof DomUtils.findAll>[number]
type Nodes = Parameters<typeof DomUtils.findAll>[1]

export interface HtmlIssue {
  /** `structure`: not a usable document; `safety`: removed by the sanitizer; `wcag`: accessibility; `brand` / `platform` / `kit`: the design intent (brand, devices, design system). */
  rule: 'structure' | 'safety' | 'wcag' | 'brand' | 'platform' | 'kit'
  /** WCAG success criterion, for `wcag` issues. */
  criterion?: string
  severity: 'error' | 'warning'
  message: string
  /** Short description of the element, e.g. `<img src="…">`. */
  element?: string
}

/** Stored on the variant as `accessibility`. */
export interface HtmlReport {
  /** The accessibility standard checked against, e.g. "WCAG 2.2 AA". */
  standard: string
  /** Only what can be checked in the markup without running it (no contrast, focus order or zoom). */
  scope: 'static-markup'
  passed: boolean
  checkedAt: string
  errors: number
  warnings: number
  issues: HtmlIssue[]
  /** What the sanitizer removed (scripts, handlers, external resources, ...). */
  removed: string[]
  bytes: number
}

export interface HtmlContext {
  platforms: Platform[]
  /** Brand colors the design is expected to use (hex). */
  brandColors: string[]
  /** The design system whose UI kit the components must come from. */
  designSystem?: UiLibrary
  /**
   * Components not built from the kit are errors (generation: the model
   * repairs them) instead of warnings (hand-made or restored designs).
   */
  requireKit?: boolean
  /** The design intent's accessibility standard; sets the contrast minimums. */
  standard?: string
}

export interface HtmlCheck {
  /** The sanitized document (what is stored and sent to the frontend). */
  html: string
  report: HtmlReport
}

const GENERIC_LINK_TEXT =
  /^(click here|here|more|read more|learn more|link|this)$/i
const UNLABELLED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
])

/**
 * Sanitizes a design and checks what can be checked statically: document
 * structure, WCAG 2.1 AA markup criteria, the brand colors and responsive
 * layout for the project's platforms. Errors make the design fail; warnings
 * are kept in the report.
 */
export function checkHtml(raw: string, context: HtmlContext): HtmlCheck {
  const issues: HtmlIssue[] = []
  const bytes = Buffer.byteLength(raw)
  if (bytes > MAX_HTML_BYTES) {
    issues.push({
      rule: 'structure',
      severity: 'error',
      message: `The document is ${bytes} bytes; the limit is ${MAX_HTML_BYTES}.`,
    })
  }
  const removed = unsafeParts(raw)
  for (const item of removed) {
    issues.push({
      rule: 'safety',
      severity: 'warning',
      message: `Removed ${item}.`,
    })
  }

  const html = sanitizeDesignHtml(raw)
  const dom = parseDocument(html).children
  const styles = DomUtils.findAll((el) => el.name === 'style', dom)
  const style = styles.map((el) => DomUtils.textContent(el)).join('\n')
  const ownStyle = styles
    .filter((el) => !('data-ui-kit' in el.attribs))
    .map((el) => DomUtils.textContent(el))
    .join('\n')
  const inlineStyles = DomUtils.findAll((el) => 'style' in el.attribs, dom)
    .map((el) => el.attribs.style)
    .join('\n')

  checkStructure(dom, context, style, issues)
  checkImages(dom, issues)
  checkHeadings(dom, issues)
  checkControls(dom, issues)
  checkLinks(dom, issues)
  checkBrand(`${style}\n${inlineStyles}`, context, issues)
  checkKit(dom, ownStyle, context, issues)
  checkContrast(style, ownStyle, context, issues)

  const errors = issues.filter((issue) => issue.severity === 'error').length

  return {
    html,
    report: {
      standard: context.standard ?? 'WCAG 2.1 AA',
      scope: 'static-markup',
      passed: errors === 0,
      checkedAt: new Date().toISOString(),
      errors,
      warnings: issues.length - errors,
      issues,
      removed,
      bytes: Buffer.byteLength(html),
    },
  }
}

/** Counts what the sanitizer is about to drop, so the report can say so. */
function unsafeParts(raw: string): string[] {
  const dom = parseDocument(raw).children
  const count = (test: (el: Element) => boolean) =>
    DomUtils.findAll(test, dom).length
  const parts: Array<[number, string]> = [
    [count((el) => el.name === 'script'), '<script> element(s)'],
    [
      count((el) =>
        ['iframe', 'frame', 'object', 'embed', 'base', 'applet'].includes(
          el.name,
        ),
      ),
      'embedded frame/object element(s)',
    ],
    [
      count((el) => Object.keys(el.attribs).some((name) => /^on/i.test(name))),
      'element(s) with event-handler attributes',
    ],
    [
      count((el) =>
        Object.values(el.attribs).some((value) =>
          /^\s*javascript:/i.test(value),
        ),
      ),
      'javascript: URL(s)',
    ],
    [
      count(
        (el) =>
          el.name === 'link' &&
          !/^https:\/\/fonts\.googleapis\.com\//i.test(el.attribs.href ?? ''),
      ),
      'external <link>(s) other than Google Fonts',
    ],
  ]

  return parts.filter(([n]) => n > 0).map(([n, what]) => `${n} ${what}`)
}

function checkStructure(
  dom: Nodes,
  context: HtmlContext,
  style: string,
  issues: HtmlIssue[],
): void {
  const root = DomUtils.findOne((el) => el.name === 'html', dom)
  if (!root?.attribs.lang?.trim()) {
    issues.push({
      rule: 'wcag',
      criterion: '3.1.1',
      severity: 'error',
      message: 'The <html> element needs a lang attribute (e.g. lang="en").',
    })
  }
  const title = DomUtils.findOne((el) => el.name === 'title', dom)
  if (!title || !DomUtils.textContent(title).trim()) {
    issues.push({
      rule: 'wcag',
      criterion: '2.4.2',
      severity: 'error',
      message: 'The document needs a non-empty <title> describing the page.',
    })
  }
  const body = DomUtils.findOne((el) => el.name === 'body', dom)
  if (!body || DomUtils.findAll(() => true, body.children).length === 0) {
    issues.push({
      rule: 'structure',
      severity: 'error',
      message: 'The <body> is empty.',
    })
  }
  if (
    !DomUtils.findOne(
      (el) => el.name === 'main' || el.attribs.role === 'main',
      dom,
    )
  ) {
    issues.push({
      rule: 'wcag',
      criterion: '1.3.1',
      severity: 'warning',
      message: 'Mark the main content with <main>.',
    })
  }

  const viewport = DomUtils.findOne(
    (el) => el.name === 'meta' && el.attribs.name?.toLowerCase() === 'viewport',
    dom,
  )
  const small = context.platforms.some((p) => p === 'MOBILE' || p === 'TABLET')
  if (!viewport) {
    issues.push({
      rule: 'platform',
      severity: small ? 'error' : 'warning',
      message:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile and tablet.',
    })
  }
  if (context.platforms.length > 1 && !/@media/i.test(style)) {
    issues.push({
      rule: 'platform',
      severity: 'warning',
      message: `The project targets ${context.platforms.join(', ')}, but the CSS has no media queries.`,
    })
  }
}

function checkImages(dom: Nodes, issues: HtmlIssue[]): void {
  for (const img of DomUtils.findAll((el) => el.name === 'img', dom)) {
    if (img.attribs.alt === undefined) {
      issues.push({
        rule: 'wcag',
        criterion: '1.1.1',
        severity: 'error',
        message: 'Every <img> needs an alt attribute (alt="" if decorative).',
        element: describe(img),
      })
    }
  }
  for (const svg of DomUtils.findAll(
    (el) => el.name === 'svg' && el.attribs.role === 'img',
    dom,
  )) {
    const named =
      svg.attribs['aria-label'] ||
      svg.attribs['aria-labelledby'] ||
      DomUtils.findOne((el) => el.name === 'title', svg.children)
    if (!named) {
      issues.push({
        rule: 'wcag',
        criterion: '1.1.1',
        severity: 'warning',
        message: 'An <svg role="img"> needs aria-label or a <title>.',
        element: describe(svg),
      })
    }
  }
}

function checkHeadings(dom: Nodes, issues: HtmlIssue[]): void {
  const headings = DomUtils.findAll((el) => /^h[1-6]$/.test(el.name), dom)
  const h1 = headings.filter((el) => el.name === 'h1').length
  if (h1 === 0) {
    issues.push({
      rule: 'wcag',
      criterion: '1.3.1',
      severity: 'error',
      message: 'The page needs exactly one <h1>.',
    })
  } else if (h1 > 1) {
    issues.push({
      rule: 'wcag',
      criterion: '1.3.1',
      severity: 'warning',
      message: `The page has ${h1} <h1> elements; use one.`,
    })
  }
  let previous = 0
  for (const heading of headings) {
    const level = Number(heading.name[1])
    if (previous > 0 && level > previous + 1) {
      issues.push({
        rule: 'wcag',
        criterion: '1.3.1',
        severity: 'warning',
        message: `Heading level jumps from h${previous} to h${level}.`,
        element: describe(heading),
      })
    }
    previous = level
  }
}

function checkControls(dom: Nodes, issues: HtmlIssue[]): void {
  const labelFor = new Set(
    DomUtils.findAll((el) => el.name === 'label', dom)
      .map((el) => el.attribs.for)
      .filter(Boolean),
  )
  const controls = DomUtils.findAll(
    (el) =>
      (el.name === 'input' &&
        !UNLABELLED_INPUT_TYPES.has(
          (el.attribs.type ?? 'text').toLowerCase(),
        )) ||
      el.name === 'select' ||
      el.name === 'textarea',
    dom,
  )
  for (const control of controls) {
    const labelled =
      (control.attribs.id && labelFor.has(control.attribs.id)) ||
      hasAncestor(control, 'label') ||
      control.attribs['aria-label']?.trim() ||
      control.attribs['aria-labelledby'] ||
      control.attribs.title?.trim()
    if (!labelled) {
      issues.push({
        rule: 'wcag',
        criterion: '3.3.2',
        severity: 'error',
        message:
          'Form control without a label (<label for>, a wrapping <label> or aria-label).',
        element: describe(control),
      })
    }
  }

  const buttons = DomUtils.findAll(
    (el) =>
      el.name === 'button' ||
      (el.name === 'input' &&
        ['submit', 'button', 'reset'].includes(
          (el.attribs.type ?? '').toLowerCase(),
        )),
    dom,
  )
  for (const button of buttons) {
    if (!accessibleName(button) && !button.attribs.value?.trim()) {
      issues.push({
        rule: 'wcag',
        criterion: '4.1.2',
        severity: 'error',
        message:
          'Button without an accessible name (text, aria-label or title).',
        element: describe(button),
      })
    }
  }
}

function checkLinks(dom: Nodes, issues: HtmlIssue[]): void {
  for (const link of DomUtils.findAll((el) => el.name === 'a', dom)) {
    const name = accessibleName(link)
    if (!name) {
      issues.push({
        rule: 'wcag',
        criterion: '2.4.4',
        severity: 'error',
        message: 'Link without an accessible name.',
        element: describe(link),
      })
    } else if (GENERIC_LINK_TEXT.test(name)) {
      issues.push({
        rule: 'wcag',
        criterion: '2.4.4',
        severity: 'warning',
        message: `Link text "${name}" does not say where it goes.`,
        element: describe(link),
      })
    }
    if (link.attribs.href === undefined) {
      issues.push({
        rule: 'wcag',
        criterion: '4.1.2',
        severity: 'warning',
        message:
          'A link without href is not keyboard reachable; use a <button> for actions.',
        element: describe(link),
      })
    }
  }
}

function checkBrand(
  css: string,
  context: HtmlContext,
  issues: HtmlIssue[],
): void {
  const lower = css.toLowerCase()
  for (const color of context.brandColors) {
    if (!lower.includes(color.toLowerCase())) {
      issues.push({
        rule: 'brand',
        severity: 'warning',
        message: `Brand color ${color} is not used in the CSS.`,
      })
    }
  }
}

/** What marks an element as built from each UI kit. */
const KIT_MARKERS: Record<
  UiLibrary,
  {
    name: string
    uses: (el: Element) => boolean
    button: string
    field: string
    restyle: RegExp
  }
> = {
  SHADCN: {
    name: 'shadcn/ui',
    uses: (el) => Boolean(el.attribs['data-slot']),
    button: 'data-slot="button" data-variant="…"',
    field: 'data-slot="input|select|textarea|checkbox|radio-group-item"',
    restyle: /\[data-slot/i,
  },
  MUI: {
    name: 'MUI',
    uses: (el) => /\bMui[A-Z]\w*-/.test(el.attribs.class ?? ''),
    button: 'class="MuiButton-root MuiButton-contained|outlined|text"',
    field:
      'class="MuiOutlinedInput-input MuiInputBase-input" (or MuiNativeSelect-select, MuiCheckbox-input)',
    restyle: /\.Mui[A-Z]/,
  },
}

/**
 * Buttons and form controls must come from the project's UI kit (the
 * design system), and the design's own CSS should not restyle kit
 * components (layout only).
 */
function checkKit(
  dom: Nodes,
  ownStyle: string,
  context: HtmlContext,
  issues: HtmlIssue[],
): void {
  if (!context.designSystem) {
    return
  }
  const kit = KIT_MARKERS[context.designSystem]
  const severity = context.requireKit ? 'error' : 'warning'
  const buttons = DomUtils.findAll((el) => el.name === 'button', dom).filter(
    (el) => !kit.uses(el),
  )
  if (buttons.length > 0) {
    issues.push({
      rule: 'kit',
      severity,
      message: `${buttons.length} <button>(s) are not ${kit.name} components; use the kit Button (${kit.button}).`,
      element: describe(buttons[0]),
    })
  }
  const fields = DomUtils.findAll(
    (el) =>
      (el.name === 'input' &&
        !UNLABELLED_INPUT_TYPES.has(
          (el.attribs.type ?? 'text').toLowerCase(),
        )) ||
      el.name === 'select' ||
      el.name === 'textarea',
    dom,
  ).filter((el) => !kit.uses(el))
  if (fields.length > 0) {
    issues.push({
      rule: 'kit',
      severity,
      message: `${fields.length} form control(s) are not ${kit.name} components; use ${kit.field}.`,
      element: describe(fields[0]),
    })
  }
  checkLayout(dom, kit.name, severity, issues)
  checkChoiceInputs(dom, severity, issues)
  if (kit.restyle.test(ownStyle)) {
    issues.push({
      rule: 'kit',
      severity: 'warning',
      message: `Your CSS restyles ${kit.name} components; keep your <style> to page layout and use the kit's variants and tokens.`,
    })
  }
}

const isContainer = (el: Element) =>
  el.attribs['data-layout'] === 'container' ||
  /\bMuiContainer-root\b/.test(el.attribs.class ?? '')

/**
 * Every top-level region (the page header and footer, each block of <main>)
 * must sit in a layout container, so all regions share the same left and
 * right edges instead of some spanning the full width.
 */
function checkLayout(
  dom: Nodes,
  kitName: string,
  severity: HtmlIssue['severity'],
  issues: HtmlIssue[],
): void {
  const body = DomUtils.findOne((el) => el.name === 'body', dom)
  const main = DomUtils.findOne((el) => el.name === 'main', dom)
  if (!body) {
    return
  }
  const elementsOf = (parent: Element) =>
    parent.children.filter((child): child is Element => child.type === 'tag')
  const regions = [
    ...elementsOf(body).filter(
      (el) => el.name === 'header' || el.name === 'footer',
    ),
    ...(main ? elementsOf(main) : []),
  ]
  const inContainer = (el: Element) => {
    for (
      let node: Element | null = el;
      node;
      node = node.parent as Element | null
    ) {
      if (node.type === 'tag' && isContainer(node)) {
        return true
      }
    }
    return DomUtils.findOne(isContainer, el.children) !== null
  }
  const loose = regions.filter((el) => !inContainer(el))
  if (loose.length > 0) {
    issues.push({
      rule: 'kit',
      severity,
      message: `${loose.length} top-level region(s) are not inside a layout container, so they do not line up with the rest of the page; wrap each region's content in <div data-layout="container">${kitName === 'MUI' ? ' (or MuiContainer-root)' : ''}.`,
      element: describe(loose[0]),
    })
  }
}

/**
 * A radio/checkbox whose label is styled as a button (a toggle, a chip, a
 * time slot) must be visually hidden; otherwise a bare control shows next to
 * every pill.
 */
function checkChoiceInputs(
  dom: Nodes,
  severity: HtmlIssue['severity'],
  issues: HtmlIssue[],
): void {
  const buttonLike = (el: Element | null | undefined) =>
    Boolean(el) &&
    (/^(button|toggle-group-item|toggle|badge)$/.test(
      el!.attribs['data-slot'] ?? '',
    ) ||
      /\bMui(ToggleButton|Button|Chip)-root\b/.test(el!.attribs.class ?? ''))
  const labels = DomUtils.findAll((el) => el.name === 'label', dom)
  const exposed = DomUtils.findAll(
    (el) =>
      el.name === 'input' &&
      /^(radio|checkbox)$/i.test(el.attribs.type ?? '') &&
      !/\bsr-only\b/.test(el.attribs.class ?? ''),
    dom,
  ).filter((input) => {
    const byFor = input.attribs.id
      ? labels.find((l) => l.attribs.for === input.attribs.id)
      : undefined
    let wrapping: Element | null = input.parent as Element | null
    while (wrapping && wrapping.name !== 'label') {
      wrapping = wrapping.parent as Element | null
    }
    return buttonLike(byFor) || buttonLike(wrapping)
  })
  if (exposed.length > 0) {
    issues.push({
      rule: 'kit',
      severity,
      message: `${exposed.length} radio/checkbox input(s) are visible next to a button-styled label; use the kit toggle group (the input inside the item with class="sr-only").`,
      element: describe(exposed[0]),
    })
  }
}

interface ContrastRule {
  selector: string
  fg: string
  bg: string
  ratio: number
  needed: number
}

function contrastMinimum(standard: string) {
  return /\bAAA\b/i.test(standard)
    ? { normal: 7, large: 4.5 }
    : { normal: 4.5, large: 3 }
}

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g

/**
 * Resolves a CSS color value to #rrggbb through the custom properties
 * declared anywhere in `allStyle` (brand and kit tokens included).
 */
function colorResolver(allStyle: string) {
  const vars = new Map<string, string>()
  for (const [, name, value] of allStyle
    .replace(CSS_COMMENT, '')
    .matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
    vars.set(name, value.trim())
  }
  const resolve = (value: string | undefined, depth = 0): string | null => {
    if (!value || depth > 6) {
      return null
    }
    const v = value.trim().toLowerCase()
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/)
    if (ref) {
      return resolve(vars.get(ref[1]) ?? ref[2], depth + 1)
    }
    if (v === 'white' || v === '#fff') {
      return '#ffffff'
    }
    if (v === 'black' || v === '#000') {
      return '#000000'
    }
    const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
    if (short) {
      return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
    }

    return /^#[0-9a-f]{6}$/.test(v) ? v : null
  }

  return resolve
}

/**
 * A rule body's text/background pair if both resolve to colors, with the
 * contrast the standard needs for its text size.
 */
function ruleContrast(
  selector: string,
  body: string,
  resolve: (value: string | undefined) => string | null,
  min: { normal: number; large: number },
): ContrastRule | null {
  const decl = new Map<string, string>()
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at > 0) {
      decl.set(
        part.slice(0, at).trim().toLowerCase(),
        part
          .slice(at + 1)
          .replace(/!important/i, '')
          .trim(),
      )
    }
  }
  const fg = resolve(decl.get('color'))
  const bg = resolve(decl.get('background-color') ?? decl.get('background'))
  if (!fg || !bg) {
    return null
  }
  const m = decl.get('font-size')?.match(/^([\d.]+)(px|rem|em)$/)
  let size = 0
  if (m) {
    size = m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16
  }
  const bold = /^(bold|[6-9]00)$/.test(decl.get('font-weight') ?? '')
  const large = size >= 24 || (bold && size >= 18.66)

  return {
    selector: selector.trim().replace(/\s+/g, ' '),
    fg,
    bg,
    ratio: contrastRatio(fg, bg),
    needed: large ? min.large : min.normal,
  }
}

/**
 * Text/background contrast of the design's own CSS rules (the kit's own
 * pairs are made readable when it is applied). A rule that sets both a color
 * and a background is resolved through CSS variables (brand and kit tokens
 * included) and checked against the standard's minimum.
 */
function checkContrast(
  allStyle: string,
  ownStyle: string,
  context: HtmlContext,
  issues: HtmlIssue[],
): void {
  const standard = context.standard ?? 'WCAG 2.1 AA'
  const aaa = /\bAAA\b/i.test(standard)
  const min = contrastMinimum(standard)
  const resolve = colorResolver(allStyle)

  let reported = 0
  for (const [, selector, body] of ownStyle
    .replace(CSS_COMMENT, '')
    .matchAll(CSS_RULE)) {
    const rule = ruleContrast(selector, body, resolve, min)
    if (rule && rule.ratio + 0.005 < rule.needed && reported < 10) {
      reported++
      issues.push({
        rule: 'wcag',
        criterion: aaa ? '1.4.6' : '1.4.3',
        severity: 'error',
        message: `Text ${rule.fg} on ${rule.bg} has a contrast of ${rule.ratio.toFixed(2)}:1; ${standard} needs at least ${rule.needed}:1. Fix: brand-colored text on a light background → var(--brand-…-text); text on a brand background → var(--brand-…-foreground); grey text → var(--muted-foreground) on white only.`,
        element: rule.selector.slice(-80),
      })
    }
  }
}

/**
 * Guardrail run before the check: in the design's own <style> blocks, a
 * rule whose text color does not reach the standard's contrast on its own
 * background gets the same hue darkened (light background) or lightened
 * (dark background) until it does. Returns the adjusted document and one
 * line per adjusted rule.
 */
export function fixContrast(
  html: string,
  standard = 'WCAG 2.1 AA',
): { html: string; fixed: string[] } {
  const min = contrastMinimum(standard)
  const allStyle = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join('\n')
  const resolve = colorResolver(allStyle)
  const fixed: string[] = []

  const out = html.replace(
    /(<style\b([^>]*)>)([\s\S]*?)(<\/style>)/gi,
    (block, open: string, attrs: string, css: string, close: string) => {
      if (/\bdata-ui-kit\b/i.test(attrs)) {
        return block
      }
      let changed = false
      const next = css
        .replace(CSS_COMMENT, '')
        .replace(CSS_RULE, (rule, selector: string, body: string) => {
          const pair = ruleContrast(selector, body, resolve, min)
          if (!pair || pair.ratio + 0.005 >= pair.needed) {
            return rule
          }
          const color = readableOn(pair.fg, pair.bg, pair.needed)
          const replaced = body.replace(
            /(^|;)(\s*)color\s*:[^;]*/i,
            `$1$2color: ${color}`,
          )
          if (replaced === body) {
            return rule
          }
          changed = true
          fixed.push(
            `${pair.selector.slice(-60)}: text ${pair.fg} → ${color} on ${pair.bg} (${pair.ratio.toFixed(2)}:1 → ${contrastRatio(color, pair.bg).toFixed(2)}:1)`,
          )
          return `${selector}{${replaced}}`
        })

      return changed ? `${open}${next}${close}` : block
    },
  )

  return { html: out, fixed }
}

/**
 * `fg` mixed toward black (on a light `bg`) or white (on a dark one) in 2%
 * steps until its contrast on `bg` reaches `needed`.
 */
function readableOn(fg: string, bg: string, needed: number): string {
  const towardBlack =
    contrastRatio('#000000', bg) >= contrastRatio('#ffffff', bg)
  const target = towardBlack ? 0 : 255
  const channels = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16))
  for (let t = 0.02; t <= 1; t += 0.02) {
    const hex = `#${channels
      .map((c) =>
        Math.round(c + (target - c) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`
    if (contrastRatio(hex, bg) >= needed + 0.05) {
      return hex
    }
  }

  return towardBlack ? '#000000' : '#ffffff'
}

function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)

  return (hi + 0.05) / (lo + 0.05)
}

/** Text, aria-label, aria-labelledby, title, or the alt of an image inside. */
function accessibleName(el: Element): string {
  const text = DomUtils.textContent(el).replace(/\s+/g, ' ').trim()
  const alt = DomUtils.findAll((child) => child.name === 'img', el.children)
    .map((img) => img.attribs.alt ?? '')
    .join(' ')
    .trim()

  return (
    el.attribs['aria-label']?.trim() ||
    (el.attribs['aria-labelledby'] ? '(labelled)' : '') ||
    text ||
    alt ||
    el.attribs.title?.trim() ||
    ''
  )
}

function hasAncestor(el: Element, name: string): boolean {
  let parent = el.parent as Element | null
  while (parent) {
    if (parent.name === name) {
      return true
    }
    parent = parent.parent as Element | null
  }

  return false
}

function describe(el: Element): string {
  const attributes = ['id', 'class', 'type', 'name', 'src', 'href']
    .filter((name) => el.attribs[name])
    .map((name) => `${name}="${el.attribs[name].slice(0, 40)}"`)
    .join(' ')

  return `<${el.name}${attributes ? ` ${attributes}` : ''}>`
}

/** Counts of the interactive and structural elements of a design (handoff). */
export function elementUsage(html: string | null): Record<string, number> {
  if (!html) {
    return {}
  }
  const dom = parseDocument(html).children
  const usage: Record<string, number> = {}
  for (const el of DomUtils.findAll(
    (node) =>
      [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        'form',
        'img',
        'svg',
        'table',
        'nav',
        'header',
        'main',
        'footer',
        'section',
        'dialog',
        'h1',
        'h2',
        'h3',
      ].includes(node.name),
    dom,
  )) {
    usage[el.name] = (usage[el.name] ?? 0) + 1
  }

  return usage
}
