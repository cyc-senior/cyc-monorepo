import {
  blend,
  contrastRatio,
  isLargeText,
  parseHex,
  Rgba,
  toHex,
} from './color'
import {
  DesignDocument,
  designDocumentSchema,
  DesignNode,
  FrameNode,
  InstanceNode,
  LIMITS,
  Paint,
  screensOf,
  TextNode,
} from './design-document'
import { KitComponent, PropValue, UiKit } from './ui-kits'

export interface DesignIssue {
  /** `structure`: not a valid document; `ui-kit`: breaks the kit guardrail; `wcag`: an accessibility failure. */
  rule: 'structure' | 'ui-kit' | 'wcag'
  /** WCAG 2.0 success criterion, for `wcag` issues. */
  criterion?: string
  severity: 'error' | 'warning'
  nodeId?: string
  message: string
}

export interface DesignCheck {
  /** The parsed document, when it is structurally valid. */
  document?: DesignDocument
  issues: DesignIssue[]
  /** No errors (warnings allowed). */
  passed: boolean
}

export interface AccessibilityReport {
  standard: 'WCAG 2.0'
  level: 'AA'
  passed: boolean
  checkedAt: string
  errors: number
  warnings: number
  issues: DesignIssue[]
  /** Mechanical fixes applied before the design passed (text color, heading marks). */
  autoFixed: string[]
}

const NORMAL_TEXT_RATIO = 4.5
const LARGE_TEXT_RATIO = 3
const GENERIC_LINK_TEXT =
  /^(click here|here|more|read more|learn more|link|this)$/i
const PLACEHOLDER_TITLE = /^(frame|screen|untitled|page)\s*\d*$/i

interface Context {
  /** Opaque color behind the node. */
  background: Rgba
  /** The node sits on an image: contrast cannot be verified. */
  overImage: boolean
  /** Text color inherited from the surrounding surface. */
  foreground: string
}

export type FixKind = 'contrast' | 'headings'

/** Mechanical fixes the auto-fixer may apply, by node id. */
type Fixes = Map<
  string,
  { kind: 'contrast'; color: string } | { kind: 'headings'; level: number }
>

/** Bold or large text that reads as a heading (and has letters, so not a figure). */
const looksLikeHeading = (node: TextNode) =>
  (node.style.fontSize >= 24 ||
    (node.style.fontSize >= 20 && node.style.fontWeight >= 600)) &&
  /\p{L}/u.test(node.characters) &&
  node.characters.length <= 120

/**
 * Validates a design document against its UI kit and the WCAG 2.0 AA success
 * criteria that can be checked on a static design: 1.1.1 text alternatives,
 * 1.3.1 / 3.3.2 labels and headings, 1.4.3 contrast (with alpha blended over
 * the real background, kit component colors included), 2.4.2 screen titles,
 * 2.4.4 link purpose, 3.1.1 language (schema) and 4.1.2 names of controls.
 */
export function checkDesign(input: unknown, kit: UiKit): DesignCheck {
  return run(input, kit).check
}

/**
 * Applies the mechanical fixes {@link checkDesign} found, of the given kinds:
 * `headings` marks text styled as a heading as one (the largest as level 1 when
 * the screen has none, the others level 2); `contrast` recolors failing text
 * to the kit's text color (or white/black, whichever passes). Returns what it
 * changed, as readable notes.
 */
export function applyFixes(
  document: DesignDocument,
  kit: UiKit,
  kinds: readonly FixKind[],
): { document: DesignDocument; fixed: string[] } {
  const { fixes } = run(document, kit)
  const fixed: string[] = []
  const repair = (node: DesignNode): DesignNode => {
    const fix = fixes.get(node.id)
    let next = node
    if (fix && node.type === 'TEXT' && kinds.includes(fix.kind)) {
      if (fix.kind === 'contrast') {
        next = { ...node, fills: [{ type: 'SOLID', color: fix.color }] }
        fixed.push(`${node.id}: text color set to ${fix.color} (1.4.3)`)
      } else {
        next = {
          ...node,
          a11y: { ...node.a11y, role: 'heading', headingLevel: fix.level },
        }
        fixed.push(`${node.id}: marked as heading level ${fix.level} (1.3.1)`)
      }
    }
    if ('children' in next && next.children) {
      return { ...next, children: next.children.map(repair) } as DesignNode
    }

    return next
  }
  const result: DesignDocument = {
    ...document,
    document: {
      ...document.document,
      children: document.document.children.map((canvas) => ({
        ...canvas,
        children: canvas.children.map((screen) => repair(screen) as FrameNode),
      })),
    },
  }

  return { document: fixed.length ? result : document, fixed }
}

export function accessibilityReport(
  check: DesignCheck,
  autoFixed: string[] = [],
): AccessibilityReport {
  const issues = check.issues.filter((issue) => issue.rule === 'wcag')

  return {
    standard: 'WCAG 2.0',
    level: 'AA',
    passed: !issues.some((issue) => issue.severity === 'error'),
    checkedAt: new Date().toISOString(),
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    issues,
    autoFixed,
  }
}

function run(input: unknown, kit: UiKit): { check: DesignCheck; fixes: Fixes } {
  const fixes: Fixes = new Map()
  const parsed = designDocumentSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 30)
      .map((issue): DesignIssue => ({
        rule: 'structure',
        severity: 'error',
        message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      }))

    return { check: { issues, passed: false }, fixes }
  }

  const document = parsed.data
  const issues: DesignIssue[] = []
  if (document.uiLibrary !== kit.library) {
    issues.push({
      rule: 'ui-kit',
      severity: 'error',
      message: `The design uses ${document.uiLibrary}, but the project's UI kit is ${kit.library}.`,
    })
  }
  issues.push(...checkStructure(document))

  const checker = new Checker(kit, issues, fixes)
  for (const canvas of document.document.children) {
    const background = parseHex(canvas.backgroundColor)
    for (const screen of canvas.children) {
      checker.screen(screen, {
        background: blend(background, parseHex('#FFFFFF')),
        overImage: false,
        foreground: kit.theme.foreground,
      })
    }
  }

  return {
    check: {
      document,
      issues,
      passed: !issues.some((issue) => issue.severity === 'error'),
    },
    fixes,
  }
}

function checkStructure(document: DesignDocument): DesignIssue[] {
  const issues: DesignIssue[] = []
  const seen = new Set<string>()
  let count = 0
  const visit = (node: DesignNode, depth: number) => {
    count++
    if (seen.has(node.id)) {
      issues.push(structure(`Duplicate node id "${node.id}".`, node.id))
    }
    seen.add(node.id)
    if (depth > LIMITS.depth) {
      issues.push(
        structure(`Nesting deeper than ${LIMITS.depth} levels.`, node.id),
      )
      return
    }
    if ('children' in node && node.children) {
      node.children.forEach((child) => visit(child, depth + 1))
    }
  }
  screensOf(document).forEach((screen) => visit(screen, 1))
  if (count > LIMITS.nodes) {
    issues.push(structure(`More than ${LIMITS.nodes} nodes (${count}).`))
  }

  return issues
}

const structure = (message: string, nodeId?: string): DesignIssue => ({
  rule: 'structure',
  severity: 'error',
  nodeId,
  message,
})

class Checker {
  private headings: number[] = []
  /** Heading-styled text on the current screen that is not marked as one. */
  private unmarkedHeadings: TextNode[] = []

  constructor(
    private readonly kit: UiKit,
    private readonly issues: DesignIssue[],
    private readonly fixes: Fixes,
  ) {}

  screen(screen: FrameNode, context: Context): void {
    this.headings = []
    this.unmarkedHeadings = []
    if (PLACEHOLDER_TITLE.test(screen.name.trim())) {
      this.wcag(
        '2.4.2',
        'error',
        screen.id,
        `Screen "${screen.name}" needs a descriptive title (its name).`,
      )
    }
    this.node(screen, context)
    this.markHeadings()
    if (this.headings.length === 0 && this.unmarkedHeadings.length === 0) {
      this.wcag(
        '1.3.1',
        'warning',
        screen.id,
        `Screen "${screen.name}" has no heading (a11y.role "heading").`,
      )
    }
  }

  private node(node: DesignNode, context: Context): void {
    if (node.visible === false) {
      return
    }
    switch (node.type) {
      case 'FRAME':
        node.children.forEach((child) =>
          this.node(child, this.paint(node.fills, context)),
        )
        break
      case 'RECTANGLE':
        this.imageAlternative(node.id, node.fills, node.a11y)
        break
      case 'TEXT':
        this.text(node, context)
        break
      case 'INSTANCE':
        this.instance(node, context)
        break
    }
  }

  /** The background behind a node's children once its fills are painted. */
  private paint(fills: Paint[] | undefined, context: Context): Context {
    let { background, overImage } = context
    for (const fill of fills ?? []) {
      if (fill.type === 'IMAGE') {
        overImage = true
      } else {
        background = blend(parseHex(fill.color), background, fill.opacity ?? 1)
        if ((fill.opacity ?? 1) * parseHex(fill.color).a >= 1) {
          overImage = false
        }
      }
    }

    return { ...context, background, overImage }
  }

  private imageAlternative(
    id: string,
    fills: Paint[] | undefined,
    a11y: DesignNode['a11y'],
  ) {
    if (
      fills?.some((fill) => fill.type === 'IMAGE') &&
      !a11y?.label &&
      !a11y?.decorative
    ) {
      this.wcag(
        '1.1.1',
        'error',
        id,
        'Image needs a text alternative (a11y.label) or a11y.decorative.',
      )
    }
  }

  private text(node: TextNode, context: Context): void {
    const fontFamily = node.style.fontFamily
    if (fontFamily && !this.kit.fonts.includes(fontFamily)) {
      this.kitError(
        node.id,
        `Font "${fontFamily}" is not part of ${this.kit.name} (${this.kit.fonts.join(', ')}).`,
      )
    }
    if (!node.characters.trim()) {
      this.wcag('1.3.1', 'warning', node.id, 'Empty text node.')
    }
    this.heading(node)
    if (
      looksLikeHeading(node) &&
      node.a11y?.role !== 'heading' &&
      !node.a11y?.decorative
    ) {
      this.unmarkedHeadings.push(node)
    }

    if (context.overImage) {
      this.wcag(
        '1.4.3',
        'error',
        node.id,
        'Text sits on an image; put it on a solid fill so its contrast can be verified.',
      )
      return
    }
    const fill = node.fills?.[0]
    const color = fill
      ? blend(parseHex(fill.color), context.background, fill.opacity ?? 1)
      : blend(parseHex(context.foreground), context.background)
    const required = isLargeText(node.style.fontSize, node.style.fontWeight)
      ? LARGE_TEXT_RATIO
      : NORMAL_TEXT_RATIO
    const ratio = contrastRatio(color, context.background)
    if (ratio < required) {
      this.wcag(
        '1.4.3',
        'error',
        node.id,
        `Text contrast ${ratio.toFixed(2)}:1 (${toHex(color)} on ${toHex(context.background)}) is below ${required}:1.`,
      )
      this.fixes.set(node.id, {
        kind: 'contrast',
        color: this.readableColor(context.background, required),
      })
    }
  }

  /**
   * 1.3.1: text that looks like a heading must be one. The fix makes the
   * largest unmarked one level 1 if the screen has no level 1, the rest 2.
   */
  private markHeadings(): void {
    const largest = [...this.unmarkedHeadings].sort(
      (a, b) => b.style.fontSize - a.style.fontSize,
    )[0]
    const needsTop = !this.headings.includes(1)
    for (const node of this.unmarkedHeadings) {
      const level = needsTop && node === largest ? 1 : 2
      this.wcag(
        '1.3.1',
        'error',
        node.id,
        `"${node.characters.slice(0, 40)}" is styled as a heading; mark it a11y { role: "heading", headingLevel: ${level} }.`,
      )
      this.fixes.set(node.id, { kind: 'headings', level })
    }
  }

  private heading(node: DesignNode): void {
    if (node.a11y?.role !== 'heading') {
      return
    }
    const level = node.a11y.headingLevel
    if (!level) {
      this.wcag(
        '1.3.1',
        'error',
        node.id,
        'Heading needs a11y.headingLevel (1–6).',
      )
      return
    }
    const previous = this.headings.at(-1) ?? 0
    if (level > previous + 1) {
      this.wcag(
        '1.3.1',
        'warning',
        node.id,
        `Heading level jumps from ${previous || 'none'} to ${level}.`,
      )
    }
    this.headings.push(level)
  }

  private instance(node: InstanceNode, context: Context): void {
    const component = this.kit.components[node.componentKey]
    if (!component) {
      this.kitError(
        node.id,
        `"${node.componentKey}" is not a ${this.kit.name} component.`,
      )
      return
    }
    const props = this.props(node, component)
    this.heading(node)
    this.accessibleName(node, component, props)
    this.componentContrast(node, component, props, context)

    if (node.children?.length) {
      if (!component.container) {
        this.kitError(node.id, `${node.componentKey} cannot have children.`)
        return
      }
      const surface = blend(
        parseHex(component.container.surface),
        context.background,
      )
      const inner: Context = {
        background: surface,
        overImage: false,
        foreground: component.container.foreground,
      }
      node.children.forEach((child) => this.node(child, inner))
    }
  }

  /** Guardrail: only the kit's props, with valid values; returns props with defaults. */
  private props(
    node: InstanceNode,
    component: KitComponent,
  ): Record<string, PropValue> {
    const props: Record<string, PropValue> = {}
    for (const [name, spec] of Object.entries(component.props)) {
      if (spec.kind === 'enum') {
        props[name] = spec.default
      }
    }
    for (const [name, value] of Object.entries(node.componentProperties)) {
      const spec = component.props[name]
      if (!spec) {
        this.kitError(
          node.id,
          `${node.componentKey} has no prop "${name}" (${Object.keys(component.props).join(', ')}).`,
        )
        continue
      }
      const valid =
        (spec.kind === 'enum' &&
          typeof value === 'string' &&
          spec.values.includes(value)) ||
        (spec.kind === 'text' &&
          typeof value === 'string' &&
          value.length <= spec.max) ||
        (spec.kind === 'boolean' && typeof value === 'boolean') ||
        (spec.kind === 'number' &&
          typeof value === 'number' &&
          value >= spec.min &&
          value <= spec.max) ||
        (spec.kind === 'list' &&
          Array.isArray(value) &&
          value.length > 0 &&
          value.length <= spec.max)
      if (!valid) {
        const expected =
          spec.kind === 'enum' ? spec.values.join(' | ') : spec.kind
        this.kitError(
          node.id,
          `${node.componentKey}.${name} must be ${expected}.`,
        )
        continue
      }
      props[name] = value
    }
    for (const name of component.required) {
      if (isBlank(props[name]) && name !== component.nameProp) {
        this.kitError(node.id, `${node.componentKey} needs "${name}".`)
      }
    }

    return props
  }

  private accessibleName(
    node: InstanceNode,
    component: KitComponent,
    props: Record<string, PropValue>,
  ): void {
    if (!component.nameProp) {
      return
    }
    const visible = props[component.nameProp]
    if (component.formControl) {
      if (isBlank(visible)) {
        this.wcag(
          '3.3.2',
          'error',
          node.id,
          `${node.componentKey} needs a visible "${component.nameProp}" (1.3.1, 3.3.2).`,
        )
      }
      return
    }
    if (component.nonText) {
      if (isBlank(visible) && !node.a11y?.label && !node.a11y?.decorative) {
        this.wcag(
          '1.1.1',
          'error',
          node.id,
          `${node.componentKey} needs "${component.nameProp}" as its text alternative, or a11y.decorative.`,
        )
      }
      return
    }
    if (isBlank(visible) && !node.a11y?.label) {
      this.wcag(
        '4.1.2',
        'error',
        node.id,
        `${node.componentKey} needs an accessible name ("${component.nameProp}").`,
      )
    } else if (
      typeof visible === 'string' &&
      GENERIC_LINK_TEXT.test(visible.trim())
    ) {
      this.wcag(
        '2.4.4',
        'warning',
        node.id,
        `"${visible}" does not say where it leads or what it does.`,
      )
    }
  }

  /** Text the kit draws itself (button labels, field labels, ...) must also pass 1.4.3. */
  private componentContrast(
    node: InstanceNode,
    component: KitComponent,
    props: Record<string, PropValue>,
    context: Context,
  ): void {
    const colors = component.textColors?.(props)
    if (!colors) {
      return
    }
    if (colors.bg === 'parent' && context.overImage) {
      this.wcag(
        '1.4.3',
        'error',
        node.id,
        `${node.componentKey} sits on an image; put it on a solid fill.`,
      )
      return
    }
    const background =
      colors.bg === 'parent'
        ? context.background
        : blend(parseHex(colors.bg), context.background)
    const foreground = blend(parseHex(colors.fg), background)
    const ratio = contrastRatio(foreground, background)
    if (ratio < NORMAL_TEXT_RATIO) {
      const choices = Object.entries(props)
        .filter(([name]) => component.props[name]?.kind === 'enum')
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(', ')
      this.wcag(
        '1.4.3',
        'error',
        node.id,
        `${node.componentKey} (${choices}) renders text at ${ratio.toFixed(2)}:1 on ${toHex(background)}, below 4.5:1. Pick another variant/color or background.`,
      )
    }
  }

  private readableColor(background: Rgba, required: number): string {
    const candidates = [this.kit.theme.foreground, '#FFFFFF', '#000000'].map(
      (hex) => toHex(blend(parseHex(hex), background)),
    )

    return (
      candidates.find(
        (hex) => contrastRatio(parseHex(hex), background) >= required,
      ) ??
      candidates.sort(
        (a, b) =>
          contrastRatio(parseHex(b), background) -
          contrastRatio(parseHex(a), background),
      )[0]
    )
  }

  private wcag(
    criterion: string,
    severity: DesignIssue['severity'],
    nodeId: string,
    message: string,
  ) {
    this.issues.push({ rule: 'wcag', criterion, severity, nodeId, message })
  }

  private kitError(nodeId: string, message: string) {
    this.issues.push({ rule: 'ui-kit', severity: 'error', nodeId, message })
  }
}

function isBlank(value: PropValue | undefined): boolean {
  return (
    value === undefined || (typeof value === 'string' && value.trim() === '')
  )
}
