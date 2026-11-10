import sanitizeHtml from 'sanitize-html'

/** Largest design accepted (bytes of HTML). */
export const MAX_HTML_BYTES = 400_000

const FONT_STYLESHEET = /^https:\/\/fonts\.googleapis\.com\//i

/** Tags a static design may use. No script, iframe, object, embed, base, form action. */
const TAGS = [
  'html',
  'head',
  'body',
  'title',
  'meta',
  'link',
  'style',
  'header',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'footer',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'small',
  'mark',
  'sub',
  'sup',
  'br',
  'hr',
  'blockquote',
  'q',
  'cite',
  'code',
  'pre',
  'kbd',
  'abbr',
  'time',
  'address',
  'figure',
  'figcaption',
  'picture',
  'img',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'caption',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'form',
  'fieldset',
  'legend',
  'label',
  'input',
  'button',
  'select',
  'option',
  'optgroup',
  'textarea',
  'output',
  'progress',
  'meter',
  'details',
  'summary',
  'dialog',
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'stop',
  'desc',
  // Inside <svg> the parser keeps the author's casing; accept both.
  'linearGradient',
  'lineargradient',
  'radialGradient',
  'radialgradient',
  'clipPath',
  'clippath',
]

const GLOBAL_ATTRIBUTES = [
  'class',
  'id',
  'style',
  'role',
  'title',
  'lang',
  'dir',
  'tabindex',
  'hidden',
  'aria-*',
  'data-*',
]

// Attribute names arrive lower-cased; browsers restore SVG casing (viewBox, ...).
const SVG_ATTRIBUTES = [
  'viewbox',
  'xmlns',
  'fill',
  'fill-rule',
  'fill-opacity',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-dasharray',
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
  'transform',
  'opacity',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'preserveaspectratio',
  'focusable',
  'clip-path',
  'font-size',
  'font-weight',
  'text-anchor',
]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: TAGS,
  // <style> is needed for a high-fidelity design; its CSS is cleaned below and
  // the frontend renders the document in a sandboxed iframe without scripts.
  allowVulnerableTags: true,
  allowedAttributes: {
    '*': GLOBAL_ATTRIBUTES,
    html: ['lang', 'dir'],
    meta: ['charset', 'name', 'content'],
    link: ['rel', 'href', 'crossorigin'],
    a: ['href', 'name'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
    input: [
      'type',
      'name',
      'value',
      'placeholder',
      'checked',
      'disabled',
      'required',
      'readonly',
      'min',
      'max',
      'step',
      'minlength',
      'maxlength',
      'pattern',
      'autocomplete',
      'inputmode',
      'size',
      'multiple',
    ],
    label: ['for'],
    button: ['type', 'disabled', 'name', 'value'],
    select: ['name', 'disabled', 'required', 'multiple', 'size'],
    option: ['value', 'selected', 'disabled', 'label'],
    optgroup: ['label', 'disabled'],
    textarea: [
      'name',
      'rows',
      'cols',
      'placeholder',
      'disabled',
      'required',
      'readonly',
      'maxlength',
    ],
    th: ['colspan', 'rowspan', 'scope', 'headers'],
    td: ['colspan', 'rowspan', 'headers'],
    col: ['span'],
    colgroup: ['span'],
    ol: ['start', 'reversed', 'type'],
    li: ['value'],
    time: ['datetime'],
    progress: ['value', 'max'],
    meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
    details: ['open'],
    dialog: ['open'],
    fieldset: ['disabled'],
    output: ['for'],
    svg: SVG_ATTRIBUTES,
    g: SVG_ATTRIBUTES,
    path: SVG_ATTRIBUTES,
    circle: SVG_ATTRIBUTES,
    ellipse: SVG_ATTRIBUTES,
    rect: SVG_ATTRIBUTES,
    line: SVG_ATTRIBUTES,
    polyline: SVG_ATTRIBUTES,
    polygon: SVG_ATTRIBUTES,
    text: SVG_ATTRIBUTES,
    tspan: SVG_ATTRIBUTES,
    linearGradient: SVG_ATTRIBUTES,
    lineargradient: SVG_ATTRIBUTES,
    radialGradient: SVG_ATTRIBUTES,
    radialgradient: SVG_ATTRIBUTES,
    stop: SVG_ATTRIBUTES,
    clipPath: SVG_ATTRIBUTES,
    clippath: SVG_ATTRIBUTES,
  },
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https', 'data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  // Only Google Fonts stylesheets may be linked; everything else is dropped.
  exclusiveFilter: (frame) =>
    frame.tag === 'link' &&
    !(
      FONT_STYLESHEET.test(frame.attribs.href ?? '') &&
      (frame.attribs.rel ?? '').toLowerCase() === 'stylesheet'
    ),
}

/**
 * CSS hazards: imports, legacy script hooks and `url()`s to anything other
 * than https, data images/fonts and in-document references.
 */
function cleanCss(html: string): string {
  return html
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/(-moz-binding|behavior)\s*:/gi, 'blocked:')
    .replace(/javascript:/gi, 'blocked:')
    .replace(
      /url\(\s*(['"]?)\s*([^'")]*)\1\s*\)/gi,
      (match, _quote: string, target: string) =>
        /^(https:|data:(image|font)\/|#)/i.test(target.trim())
          ? match
          : 'url("")',
    )
}

/**
 * Turns LLM- or designer-written HTML into a static, self-contained document
 * that is safe to hand to the frontend: no scripts, event handlers, frames,
 * external resources (except Google Fonts) or `javascript:` URLs. The
 * frontend must still render it in `<iframe sandbox srcdoc>` (no
 * `allow-scripts`, no `allow-same-origin`); this is defence in depth.
 */
export function sanitizeDesignHtml(raw: string): string {
  const cleaned = cleanCss(sanitizeHtml(raw, OPTIONS)).trim()

  return `<!DOCTYPE html>\n${cleaned}`
}
