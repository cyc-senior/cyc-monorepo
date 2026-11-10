/** `#RRGGBB` or `#RRGGBBAA`. */
export const HEX_COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export interface Rgba {
  r: number
  g: number
  b: number
  /** 0..1 */
  a: number
}

export function parseHex(hex: string): Rgba {
  const value = hex.slice(1)
  const channel = (i: number) => parseInt(value.slice(i, i + 2), 16)

  return {
    r: channel(0),
    g: channel(2),
    b: channel(4),
    a: value.length === 8 ? channel(6) / 255 : 1,
  }
}

export function toHex({ r, g, b }: Rgba): string {
  return `#${[r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/** Composites `top` (with `opacity` on top of its own alpha) over an opaque `bottom`. */
export function blend(top: Rgba, bottom: Rgba, opacity = 1): Rgba {
  const a = top.a * opacity
  const mix = (t: number, b: number) => t * a + b * (1 - a)

  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
    a: 1,
  }
}

/** WCAG 2.0 relative luminance. */
export function luminance({ r, g, b }: Rgba): number {
  const linear = (c: number) => {
    const s = c / 255

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.0 contrast ratio of two opaque colors, 1..21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG 2.0 large text: at least 18pt (24px), or 14pt (≈18.66px) bold.
 * 1.4.3 then needs 3:1 instead of 4.5:1.
 */
export function isLargeText(fontSize: number, fontWeight: number): boolean {
  return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
}
