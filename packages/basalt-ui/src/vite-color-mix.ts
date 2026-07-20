/**
 * vite-color-mix.ts — resolves CSS `color-mix(in srgb, A [p%], B [p%])` expressions down to a
 * flat hex string.
 *
 * Why this exists: `SURFACE.bg` in `tokens/palette.ts` holds `color-mix()` expressions (not hex),
 * because the page background is a deliberate mix of two zinc stops. `<meta name="theme-color">`
 * and the web manifest's `theme_color` both require a FLAT color — `color-mix()` cannot appear
 * there — so consumers were hand-approximating the mix and getting it wrong (argo shipped
 * `#EDEFF2`/`#242424`, both incorrect). This resolver computes the exact flat value at build time
 * instead, which is the core value `basaltAppPlugin` (in `./vite.ts`) adds over a hand-authored
 * PWA/head-metadata config.
 *
 * Internal to the `./vite` subpath only — deliberately NOT re-exported from `vite.ts`, so it never
 * becomes part of the published surface (see `scripts/export-surface.json`).
 *
 * Supports: plain hex passthrough (`#rgb` / `#rrggbb`), a small set of trivial named colors, and
 * one or more levels of nested `color-mix(in srgb, A [p%], B [p%])` — sRGB channel lerp on the
 * 0-255 channels, round-half-up. Anything else (other color spaces, non-trivial named colors,
 * `rgb()`/`hsl()` functions) throws a clear error naming the unresolvable input.
 */

/**
 * Only colors that map to an exact, unambiguous hex value — no gradients of named-color support.
 *
 * These two hexes are NOT design tokens and must not be routed through `VX.*`: they are the CSS
 * specification's definitions of the `white` and `black` keywords, used to parse an input string.
 * A palette reference here would make the parser resolve differently per theme, which is exactly
 * what a color parser must never do.
 */
const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff', // theme-allow — CSS keyword definition, not a design color
  black: '#000000', // theme-allow — CSS keyword definition, not a design color
}

function normalizeHex(hex: string): string {
  const body = hex.slice(1)
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body
  return `#${full.toLowerCase()}`
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex)
  const value = Number.parseInt(normalized.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function channelToHex(channel: number): string {
  return channel.toString(16).padStart(2, '0')
}

function rgbToHex(channels: readonly [number, number, number]): string {
  return `#${channelToHex(channels[0])}${channelToHex(channels[1])}${channelToHex(channels[2])}`
}

/** Splits a `color-mix()` argument list on top-level commas, ignoring commas nested in parens. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of input) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  parts.push(current.trim())
  return parts
}

/** Splits a "<color> [<percentage>%]" mix component into its color and optional percentage. */
function splitColorAndPercent(component: string): { color: string; percent: number | null } {
  const trimmed = component.trim()
  const match = /^(.+?)\s+(\d+(?:\.\d+)?)%$/.exec(trimmed)
  if (!match) return { color: trimmed, percent: null }
  return { color: match[1]!.trim(), percent: Number(match[2]) }
}

/**
 * Resolves a color-mix expression (or a plain hex / trivial named color) to a flat lowercase hex
 * string. Percentage semantics per CSS `color-mix()`: `A p%` means A contributes `p%`, B
 * contributes `(100 - p)%`; if neither side carries a percentage, the mix is 50/50.
 *
 * @throws {Error} when the input is not hex, a trivial named color, or a `color-mix(in srgb, ...)`
 *   expression (e.g. another color space, `rgb()`/`hsl()`, or a non-trivial named color).
 */
export function resolveColorMix(input: string): string {
  const trimmed = input.trim()

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed) || /^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return normalizeHex(trimmed)
  }

  const named = NAMED_COLORS[trimmed.toLowerCase()]
  if (named !== undefined) return named

  const mixMatch = /^color-mix\(\s*in\s+srgb\s*,\s*([\s\S]+)\)$/i.exec(trimmed)
  if (!mixMatch) {
    throw new Error(
      `Unresolvable color-mix input: "${input}" — only hex (#rgb/#rrggbb), "white"/"black", ` +
        'and color-mix(in srgb, ...) are supported.',
    )
  }

  const components = splitTopLevel(mixMatch[1]!)
  const [colorAComponent, colorBComponent] = components
  if (components.length !== 2 || colorAComponent === undefined || colorBComponent === undefined) {
    throw new Error(`Malformed color-mix() expression: "${input}"`)
  }

  const a = splitColorAndPercent(colorAComponent)
  const b = splitColorAndPercent(colorBComponent)

  let percentA: number
  if (a.percent !== null) percentA = a.percent
  else if (b.percent !== null) percentA = 100 - b.percent
  else percentA = 50

  const rgbA = hexToRgb(resolveColorMix(a.color))
  const rgbB = hexToRgb(resolveColorMix(b.color))
  const percentB = 100 - percentA

  const mixed: [number, number, number] = [0, 1, 2].map((i) =>
    Math.round((rgbA[i]! * percentA + rgbB[i]! * percentB) / 100),
  ) as [number, number, number]

  return rgbToHex(mixed)
}
