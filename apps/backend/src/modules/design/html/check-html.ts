import { DomUtils, parseDocument } from 'htmlparser2'

import { Platform } from '../../../generated/prisma/client'
import { MAX_HTML_BYTES, sanitizeDesignHtml } from './sanitize-html-design'

type Element = ReturnType<typeof DomUtils.findAll>[number]
type Nodes = Parameters<typeof DomUtils.findAll>[1]

export interface HtmlIssue {
  /** `structure`: not a usable document; `safety`: removed by the sanitizer; `wcag`: accessibility; `brand` / `platform`: the design intent. */
  rule: 'structure' | 'safety' | 'wcag' | 'brand' | 'platform'
  /** WCAG success criterion, for `wcag` issues. */
  criterion?: string
  severity: 'error' | 'warning'
  message: string
  /** Short description of the element, e.g. `<img src="…">`. */
  element?: string
}

/** Stored on the variant as `accessibility`. */
export interface HtmlReport {
  standard: 'WCAG 2.1 AA'
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
  const style = DomUtils.findAll((el) => el.name === 'style', dom)
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

  const errors = issues.filter((issue) => issue.severity === 'error').length

  return {
    html,
    report: {
      standard: 'WCAG 2.1 AA',
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
