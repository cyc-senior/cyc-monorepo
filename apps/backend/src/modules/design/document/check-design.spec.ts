import { contrastRatio, parseHex } from './color'
import {
  accessibilityReport,
  checkDesign,
  DesignIssue,
  applyFixes,
} from './check-design'
import {
  DesignNode,
  FrameNode,
  generatedDesignJsonSchema,
  generatedDesignSchema,
  toDesignDocument,
} from './design-document'
import { UI_KITS } from './ui-kits'

const shadcn = UI_KITS.SHADCN
const mui = UI_KITS.MUI

const heading = (characters = 'Sign in'): DesignNode => ({
  id: 'h',
  type: 'TEXT',
  name: 'Title',
  characters,
  style: { fontSize: 24, fontWeight: 700 },
  a11y: { role: 'heading', headingLevel: 1 },
})
const screen = (
  children: DesignNode[],
  extra: Partial<FrameNode> = {},
): FrameNode => ({
  id: 's',
  type: 'FRAME',
  name: 'Sign in',
  layoutMode: 'VERTICAL',
  fills: [{ type: 'SOLID', color: '#FFFFFF' }],
  children: [heading(), ...children],
  ...extra,
})
const doc = (
  children: DesignNode[],
  kit = shadcn,
  extra: Partial<FrameNode> = {},
) =>
  toDesignDocument(
    {
      name: 'Login',
      lang: 'en',
      description: 'Simple',
      screens: [screen(children, extra)],
    },
    kit,
  )
const errors = (issues: DesignIssue[]) =>
  issues.filter((i) => i.severity === 'error')
const instance = (
  componentKey: string,
  componentProperties: Record<string, unknown>,
  extra = {},
) =>
  ({
    id: 'i',
    type: 'INSTANCE',
    name: componentKey,
    componentKey,
    componentProperties,
    ...extra,
  }) as DesignNode

describe('WCAG contrast math', () => {
  it('matches the reference ratios', () => {
    expect(contrastRatio(parseHex('#000000'), parseHex('#FFFFFF'))).toBeCloseTo(
      21,
      1,
    )
    expect(contrastRatio(parseHex('#767676'), parseHex('#FFFFFF'))).toBeCloseTo(
      4.54,
      2,
    )
  })
})

describe('checkDesign', () => {
  it('passes an accessible shadcn form', () => {
    const check = checkDesign(
      doc([
        instance('Input', { type: 'email', label: 'Email' }),
        instance('Button', { label: 'Sign in' }),
      ]),
      shadcn,
    )

    expect(errors(check.issues)).toEqual([])
    expect(check.passed).toBe(true)
  })

  it('rejects components and props outside the UI kit', () => {
    const check = checkDesign(
      doc([
        instance('DatePicker', {}),
        instance('Button', { label: 'Go', variant: 'contained' }),
        instance('Button', { label: 'Go', colour: 'red' }),
      ]),
      shadcn,
    )

    expect(
      check.issues.filter((i) => i.rule === 'ui-kit').map((i) => i.message),
    ).toEqual([
      '"DatePicker" is not a shadcn/ui component.',
      'Button.variant must be default | secondary | destructive | outline | ghost | link.',
      expect.stringContaining('Button has no prop "colour"'),
    ])
    expect(check.passed).toBe(false)
  })

  it('rejects a design made for the other UI kit', () => {
    const check = checkDesign(doc([], mui), shadcn)

    expect(check.issues[0].message).toContain("project's UI kit is SHADCN")
  })

  it('requires visible labels on form controls (1.3.1, 3.3.2)', () => {
    const check = checkDesign(
      doc([instance('Input', { type: 'email' })]),
      shadcn,
    )

    expect(errors(check.issues)).toEqual([
      expect.objectContaining({ criterion: '3.3.2', nodeId: '1:2' }),
    ])
  })

  it('requires text alternatives for icons and images unless decorative (1.1.1)', () => {
    const check = checkDesign(
      doc([
        instance('Icon', { name: 'search' }),
        instance('Icon', { name: 'star' }, { a11y: { decorative: true } }),
        {
          id: 'r',
          type: 'RECTANGLE',
          name: 'Hero',
          fills: [
            { type: 'IMAGE', scaleMode: 'FILL', imageDescription: 'A team' },
          ],
        },
      ]),
      shadcn,
    )

    expect(errors(check.issues).map((i) => [i.criterion, i.nodeId])).toEqual([
      ['1.1.1', '1:2'],
      ['1.1.1', '1:4'],
    ])
  })

  it('measures text contrast against the background it is painted on (1.4.3)', () => {
    const check = checkDesign(
      doc([
        {
          id: 't',
          type: 'TEXT',
          name: 'Hint',
          characters: 'Forgot password?',
          style: { fontSize: 14, fontWeight: 400 },
          fills: [{ type: 'SOLID', color: '#9CA3AF' }],
        },
      ]),
      shadcn,
    )

    expect(errors(check.issues)).toEqual([
      expect.objectContaining({
        criterion: '1.4.3',
        message: expect.stringContaining('below 4.5:1'),
      }),
    ])
  })

  it('accepts 3:1 for large text', () => {
    const large = {
      id: 't',
      type: 'TEXT',
      name: 'Big',
      characters: 'Welcome',
      style: { fontSize: 32, fontWeight: 700 },
      a11y: { role: 'heading', headingLevel: 2 },
      fills: [{ type: 'SOLID', color: '#949494' }],
    } as DesignNode

    expect(errors(checkDesign(doc([large]), shadcn).issues)).toEqual([])
  })

  it('checks the colors the kit renders, e.g. MUI warning buttons on white', () => {
    const check = checkDesign(
      doc(
        [
          instance('Button', {
            label: 'Delete',
            variant: 'contained',
            color: 'warning',
          }),
        ],
        mui,
      ),
      mui,
    )

    expect(errors(check.issues)).toEqual([
      expect.objectContaining({
        criterion: '1.4.3',
        message: expect.stringContaining('color=warning'),
      }),
    ])
  })

  it('checks ghost buttons against a dark parent', () => {
    const check = checkDesign(
      doc([instance('Button', { label: 'Menu', variant: 'ghost' })], shadcn, {
        fills: [{ type: 'SOLID', color: '#111827' }],
      }),
      shadcn,
    )

    expect(errors(check.issues).map((i) => i.criterion)).toContain('1.4.3')
  })

  it('needs descriptive screen titles (2.4.2) and heading levels (1.3.1)', () => {
    const check = checkDesign(
      doc([], shadcn, {
        name: 'Frame 1',
        children: [
          {
            ...heading(),
            a11y: { role: 'heading' },
          } as DesignNode,
        ],
      }),
      shadcn,
    )

    expect(
      errors(check.issues)
        .map((i) => i.criterion)
        .sort(),
    ).toEqual(['1.3.1', '2.4.2'])
  })

  it('reports invalid documents as structure errors', () => {
    const check = checkDesign({ schemaVersion: 1, name: 'x' }, shadcn)

    expect(check.passed).toBe(false)
    expect(check.issues[0].rule).toBe('structure')
  })

  it('auto-fixes failing text colors and then passes', () => {
    const failing = doc([
      {
        id: 't',
        type: 'TEXT',
        name: 'Hint',
        characters: 'Low contrast',
        style: { fontSize: 14, fontWeight: 400 },
        fills: [{ type: 'SOLID', color: '#D1D5DB' }],
      },
    ])

    const { document, fixed } = applyFixes(failing, shadcn, ['contrast'])
    const check = checkDesign(document, shadcn)

    expect(fixed).toEqual(['1:2: text color set to #0A0A0A (1.4.3)'])
    expect(check.passed).toBe(true)
    expect(accessibilityReport(check, fixed)).toMatchObject({
      standard: 'WCAG 2.0',
      level: 'AA',
      passed: true,
      autoFixed: fixed,
    })
  })

  it('requires text styled as a heading to be marked as one, and can mark it', () => {
    const title = (id: string, characters: string, fontSize: number) =>
      ({
        id,
        type: 'TEXT',
        name: characters,
        characters,
        style: { fontSize, fontWeight: 700 },
      }) as DesignNode
    const unmarked = doc([], shadcn, {
      children: [
        title('a', 'Your wallet', 28),
        title('b', 'Recent trips', 20),
        title('c', '฿1,250.00', 32),
      ],
    })

    const check = checkDesign(unmarked, shadcn)
    const { document, fixed } = applyFixes(unmarked, shadcn, ['headings'])

    // The balance figure has no letters: not a heading.
    expect(errors(check.issues).map((i) => [i.criterion, i.nodeId])).toEqual([
      ['1.3.1', '1:1'],
      ['1.3.1', '1:2'],
    ])
    expect(fixed).toEqual([
      '1:1: marked as heading level 1 (1.3.1)',
      '1:2: marked as heading level 2 (1.3.1)',
    ])
    expect(checkDesign(document, shadcn).passed).toBe(true)
  })
})

describe('generated design schema', () => {
  it('limits INSTANCE components to the kit in the JSON schema', () => {
    const json = JSON.stringify(generatedDesignJsonSchema(mui))

    expect(json).toContain('"TextField"')
    expect(json).not.toContain('"Input"')
    // Props are typed per component, e.g. Button.color is one of the palette.
    expect(json).toContain('"warning"')
    // Rejected by the gateway's grammar engine.
    expect(json).not.toContain('propertyNames')
  })

  it('rejects props a component does not have, or of the wrong type', () => {
    const parse = (props: Record<string, unknown>) =>
      generatedDesignSchema(mui).safeParse({
        name: 'x',
        lang: 'en',
        description: 'x',
        screens: [screen([instance('Icon', props)])],
      }).success

    expect(parse({ name: 'home', size: 24 })).toBe(true)
    expect(parse({ name: 'home', size: '24' })).toBe(false)
    expect(parse({ name: 'home', color: 'red' })).toBe(false)
    expect(parse({ size: 24 })).toBe(false)
  })

  it('rejects components of another kit', () => {
    const result = generatedDesignSchema(mui).safeParse({
      name: 'x',
      lang: 'en',
      description: 'x',
      screens: [screen([instance('Input', { label: 'Email' })])],
    })

    expect(result.success).toBe(false)
  })

  it('renumbers node ids Figma-style', () => {
    const document = doc([instance('Button', { label: 'Go' })])
    const [page] = document.document.children

    expect(page.children[0].id).toBe('1:0')
    expect(page.children[0].children.map((c) => c.id)).toEqual(['1:1', '1:2'])
  })
})
