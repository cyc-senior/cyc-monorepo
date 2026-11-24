import { checkHtml, fixContrast, HtmlContext } from '../check-html'
import { quoteSelfClosing } from '../sanitize-html-design'
import {
  applyUiKit,
  normalizeKitMarkup,
  onColor,
  readableOnWhite,
  stripUiKit,
} from '.'

const BRAND = { primary: '#E8601C', secondary: '#1E2A5A', accent: '#F2B705' }

function page(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Book a room</title><style>main{display:grid;gap:16px}</style></head><body><main><div data-layout="container"><h1>Book a room</h1>${body}</div></main></body></html>`
}

const shadcn: HtmlContext = {
  platforms: ['DESKTOP'],
  brandColors: Object.values(BRAND),
  designSystem: 'SHADCN',
  requireKit: true,
}

describe('applyUiKit', () => {
  it('adds the kit stylesheet and font last in <head>, with the brand as tokens', () => {
    const html = applyUiKit(page('<p>Hi</p>'), 'SHADCN', BRAND)

    expect(html).toMatch(
      /<style data-ui-kit="shadcn">[\s\S]*<\/style>\s*<\/head>/,
    )
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter')
    expect(html).toContain('--primary: #E8601C')
    expect(html).toContain('--brand-secondary: #1E2A5A')
    // The model's own <style> stays and comes first.
    expect(html.indexOf('main{display:grid')).toBeLessThan(
      html.indexOf('data-ui-kit'),
    )
  })

  it('replaces an existing kit instead of adding a second one', () => {
    const once = applyUiKit(page(''), 'SHADCN', BRAND)
    const twice = applyUiKit(once, 'MUI', BRAND)

    expect(twice.match(/<style data-ui-kit/g)).toHaveLength(1)
    expect(twice).toContain('data-ui-kit="mui"')
    expect(twice).toContain('--mui-primary: #E8601C')
  })

  it('can be stripped again (to send a design back to the model)', () => {
    const original = page('<p>Hi</p>')

    expect(stripUiKit(applyUiKit(original, 'SHADCN', BRAND))).toBe(original)
  })

  it('survives the sanitizer', () => {
    const { html } = checkHtml(
      applyUiKit(page('<p>Hi</p>'), 'SHADCN', BRAND),
      shadcn,
    )

    expect(html).toContain('data-ui-kit="shadcn"')
    expect(html).toContain('[data-slot="button"]')
  })
})

describe('onColor', () => {
  it('picks the more readable text color for a background', () => {
    expect(onColor('#1E2A5A')).toBe('#FFFFFF')
    expect(onColor('#F2B705')).toBe('#0A0A0A')
    expect(onColor('#FFFFFF')).toBe('#0A0A0A')
  })
})

describe('checkHtml with a UI kit', () => {
  const kitIssues = (html: string, context: HtmlContext) =>
    checkHtml(
      applyUiKit(html, context.designSystem!, BRAND),
      context,
    ).report.issues.filter((issue) => issue.rule === 'kit')

  it('requires shadcn components for buttons and form controls when generating', () => {
    const issues = kitIssues(
      page(
        '<button type="button" class="btn btn-primary">Book</button><label for="d">Date</label><input id="d" type="date">',
      ),
      shadcn,
    )

    expect(issues.map((i) => i.severity)).toEqual(['error', 'error'])
    expect(issues[0].message).toContain('data-slot="button"')
  })

  it('passes kit markup', () => {
    const issues = kitIssues(
      page(
        '<button type="button" data-slot="button" data-variant="outline">Book</button><label data-slot="label" for="d">Date</label><input data-slot="input" id="d" type="date">',
      ),
      shadcn,
    )

    expect(issues).toEqual([])
  })

  it('only warns for hand-made designs, and about CSS that restyles the kit', () => {
    const issues = kitIssues(
      page('<button type="button">Book</button>').replace(
        '</style>',
        '[data-slot="button"]{background:red}</style>',
      ),
      { ...shadcn, requireKit: false },
    )

    expect(issues.map((i) => i.severity)).toEqual(['warning', 'warning'])
  })

  it('checks MUI by its class names', () => {
    const mui: HtmlContext = { ...shadcn, designSystem: 'MUI' }

    expect(
      kitIssues(page('<button type="button">Book</button>'), mui),
    ).toHaveLength(1)
    expect(
      kitIssues(
        page(
          '<button type="button" class="MuiButton-root MuiButton-contained">Book</button>',
        ),
        mui,
      ),
    ).toEqual([])
  })
})

describe('checkHtml contrast and standard', () => {
  const withCss = (css: string) =>
    applyUiKit(
      page('<p class="note">Hi</p>').replace('</style>', `${css}</style>`),
      'SHADCN',
      BRAND,
    )
  const contrastIssues = (css: string, standard = 'WCAG 2.2 AA') =>
    checkHtml(withCss(css), { ...shadcn, standard }).report.issues.filter(
      (i) => i.criterion === '1.4.3' || i.criterion === '1.4.6',
    )

  it('fails text that is too light for its background', () => {
    const issues = contrastIssues('.note{color:#999999;background:#ffffff}')

    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].message).toContain('WCAG 2.2 AA needs at least 4.5:1')
  })

  it('resolves brand and kit variables', () => {
    expect(
      contrastIssues(
        '.hero{color:var(--brand-secondary-foreground);background:var(--brand-secondary)}',
      ),
    ).toEqual([])
    expect(
      contrastIssues(
        '.hero{color:var(--muted-foreground);background:var(--brand-secondary)}',
      ),
    ).toHaveLength(1)
  })

  it('is stricter for AAA and reports the project standard', () => {
    const css = '.note{color:#767676;background:#ffffff}' // ~4.54:1
    expect(contrastIssues(css, 'WCAG 2.2 AA')).toEqual([])
    expect(contrastIssues(css, 'WCAG 2.2 AAA')).toHaveLength(1)
    expect(
      checkHtml(withCss(''), { ...shadcn, standard: 'WCAG 2.2 AA' }).report
        .standard,
    ).toBe('WCAG 2.2 AA')
  })
})

describe('fixContrast guardrail', () => {
  const withCss = (css: string) =>
    applyUiKit(
      page('<p class="note">Hi</p>').replace('</style>', `${css}</style>`),
      'SHADCN',
      BRAND,
    )
  const contrastErrors = (html: string, standard = 'WCAG 2.2 AA') =>
    checkHtml(html, { ...shadcn, standard }).report.issues.filter(
      (i) => i.criterion === '1.4.3' || i.criterion === '1.4.6',
    )

  it('darkens brand text on a light brand tint until it passes', () => {
    // The failure seen in generation: readable-on-white text on a tint.
    const html = withCss(
      '.chip{background:#fdf1ea;color:var(--brand-primary-text);padding:4px}',
    )
    expect(contrastErrors(html)).toHaveLength(1)

    const fixed = fixContrast(html, 'WCAG 2.2 AA')

    expect(fixed.fixed).toHaveLength(1)
    expect(fixed.fixed[0]).toContain('.chip')
    expect(contrastErrors(fixed.html)).toEqual([])
    // Other declarations of the rule are kept.
    expect(fixed.html).toMatch(
      /\.chip\{background:#fdf1ea;color: #[0-9a-f]{6};padding:4px\}/,
    )
  })

  it('lightens text on a dark background and honours AAA', () => {
    const html = withCss('.band{color:#555555;background-color:#1e2a5a}')
    const fixed = fixContrast(html, 'WCAG 2.2 AAA')

    expect(fixed.fixed).toHaveLength(1)
    expect(contrastErrors(fixed.html, 'WCAG 2.2 AAA')).toEqual([])
  })

  it('leaves passing rules, the kit stylesheet and partial rules alone', () => {
    const html = withCss(
      '.ok{color:#111111;background:#ffffff}.only{color:#eeeeee}',
    )
    const fixed = fixContrast(html, 'WCAG 2.2 AA')

    expect(fixed.fixed).toEqual([])
    expect(fixed.html).toBe(html)
  })
})

describe('normalizeKitMarkup guardrail', () => {
  it('gives kit components written as classes their data-slot', () => {
    const html =
      '<div class="room-card"><div class="card"><div class="card-header"><h3 class="card-title x">A1</h3></div>' +
      '<div class="card-footer"><button type="button" class="btn">Book</button><a class="btn" href="#">Details</a></div></div></div>'
    const { html: out, marked } = normalizeKitMarkup(html, 'SHADCN')

    expect(marked).toBe(6)
    expect(out).toContain('<div class="card" data-slot="card">')
    expect(out).toContain('<div class="card-header" data-slot="card-header">')
    expect(out).toContain('data-slot="card-title"')
    expect(out).toContain('<div class="card-footer" data-slot="card-footer">')
    expect(out).toContain(
      '<button type="button" class="btn" data-slot="button">',
    )
    expect(out).toContain('<a class="btn" href="#" data-slot="button">')
    // Unrelated classes are left alone.
    expect(out).toContain('<div class="room-card">')
  })

  it('keeps existing slots, binds element-only slots to their element, and skips MUI', () => {
    const html =
      '<span class="badge" data-slot="badge" data-variant="outline">x</span>' +
      '<div class="input">wrapper</div><input class="input" id="e" />'
    const { html: out, marked } = normalizeKitMarkup(html, 'SHADCN')

    expect(marked).toBe(1)
    expect(out).toContain('<div class="input">wrapper</div>')
    expect(out).toContain('<input class="input" id="e"  data-slot="input"/>')
    expect(out.match(/data-slot="badge"/g)).toHaveLength(1)
    expect(normalizeKitMarkup(html, 'MUI')).toEqual({ html, marked: 0 })
  })
})

describe('quoteSelfClosing', () => {
  it('quotes an unquoted last attribute before a self-closing slash', () => {
    expect(
      quoteSelfClosing(
        '<svg><rect x="3" rx=2/><path stroke-linejoin=round/><circle r="4"/></svg>',
      ),
    ).toBe(
      '<svg><rect x="3" rx="2"/><path stroke-linejoin="round"/><circle r="4"/></svg>',
    )
  })

  it('keeps the geometry through sanitizing', () => {
    const doc = checkHtml(
      page(
        '<svg aria-hidden="true" viewBox="0 0 24 24"><rect width=18 rx=2/></svg>',
      ),
      shadcn,
    ).html

    expect(doc).toMatch(/rx="2"/)
    expect(doc).not.toMatch(/rx="2\//)
  })
})

describe('readable brand text', () => {
  const contrastOnWhite = (hex: string) => {
    const lum = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2]
    return 1.05 / (l + 0.05)
  }

  it('darkens a light brand color until it reads as text on white', () => {
    expect(contrastOnWhite('#E8601C')).toBeLessThan(4.5)
    expect(
      contrastOnWhite(readableOnWhite('#E8601C', 4.5)),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastOnWhite(readableOnWhite('#E8601C', 7)),
    ).toBeGreaterThanOrEqual(7)
    expect(readableOnWhite('#1E2A5A', 4.5)).toBe('#1E2A5A')
  })

  it('gives the kit readable text tokens and a muted pair that passes AA', () => {
    const html = applyUiKit(page(''), 'SHADCN', BRAND)
    expect(html).toMatch(/--primary-text: #[0-9A-F]{6}/)
    expect(html).toMatch(/--brand-primary-text: #[0-9A-F]{6}/)
    expect(
      contrastIssues(
        '.note{color:var(--muted-foreground);background:var(--muted)}',
      ),
    ).toEqual([])
    expect(
      contrastIssues(
        '.price{color:var(--brand-primary-text);background:#ffffff}',
      ),
    ).toEqual([])
  })

  const contrastIssues = (css: string) =>
    checkHtml(
      applyUiKit(
        page('<p class="note">Hi</p>').replace('</style>', `${css}</style>`),
        'SHADCN',
        BRAND,
      ),
      { ...shadcn, standard: 'WCAG 2.2 AA' },
    ).report.issues.filter((i) => i.criterion === '1.4.3')
})

describe('layout and choice guardrails', () => {
  const kitIssues = (html: string) =>
    checkHtml(applyUiKit(html, 'SHADCN', BRAND), shadcn).report.issues.filter(
      (i) => i.rule === 'kit',
    )
  const doc = (body: string) =>
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rooms</title></head><body>${body}</body></html>`

  it('requires every top-level region to be in a layout container', () => {
    const issues = kitIssues(
      doc(
        '<header><div data-layout="container">Bar</div></header><main><section><div data-layout="container"><h1>Rooms</h1></div></section><div class="layout"><p>Filters</p></div></main>',
      ),
    )

    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].message).toContain('layout container')
    expect(issues[0].element).toContain('layout')
  })

  it('accepts a page whose regions are all contained', () => {
    expect(
      kitIssues(
        doc(
          '<header><div data-layout="container">Bar</div></header><main data-layout="container"><h1>Rooms</h1><div class="layout"><p>Filters</p></div></main>',
        ),
      ),
    ).toEqual([])
  })

  it('rejects a bare radio next to a button-styled label, accepts the toggle group', () => {
    const exposed = kitIssues(
      doc(
        '<main data-layout="container"><h1>Rooms</h1><input type="radio" name="g" id="g2" data-slot="radio-group-item"><label for="g2" data-slot="button" data-variant="outline">2</label></main>',
      ),
    )
    expect(exposed.map((i) => i.message)).toEqual([
      expect.stringContaining('visible next to a button-styled label'),
    ])

    expect(
      kitIssues(
        doc(
          '<main data-layout="container"><h1>Rooms</h1><div role="radiogroup" aria-label="Group size" data-slot="toggle-group"><label data-slot="toggle-group-item"><input type="radio" class="sr-only" name="g" value="2" data-slot="radio-group-item"> 2</label></div></main>',
        ),
      ),
    ).toEqual([])
  })
})
