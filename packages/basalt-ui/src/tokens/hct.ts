// HCT color utilities adapted from Astryx (facebook/astryx, MIT license,
// packages/core/src/theme/hct.ts), whose HCT module is itself a port of Google's
// material-color-utilities (Apache-2.0).
/**
 * Minimal HCT (Hue, Chroma, Tone) color space implementation, plus a couple of small WCAG
 * helpers. Zero-dependency — every conversion is self-contained (sRGB -> linear -> XYZ ->
 * CIELab -> polar HCT, and back via a 16-iteration chroma-reduction gamut search).
 *
 * Pure math/data — no React, no `@mantine/*`, no browser APIs (the Mantine-free boundary applies
 * to `src/tokens/**`, which this satisfies naturally). See `derive.ts` for the basalt-specific
 * palette derivation built on top of this.
 */

export type HCT = { hue: number; chroma: number; tone: number }

// ── sRGB <-> Linear RGB ──────────────────────────────────────────────────────────────────────

function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.round(Math.min(255, Math.max(0, s * 255)))
}

// ── Linear RGB <-> XYZ (D65 illuminant) ─────────────────────────────────────────────────────

function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ]
}

function xyzToLinearRgb(x: number, y: number, z: number): [number, number, number] {
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ]
}

// ── XYZ <-> L*a*b* ───────────────────────────────────────────────────────────────────────────

const D65_WHITE: [number, number, number] = [0.95047, 1.0, 1.08883]

function labF(t: number): number {
  const delta = 6 / 29
  return t > delta * delta * delta ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29
}

function labFInv(t: number): number {
  const delta = 6 / 29
  return t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29)
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = labF(x / D65_WHITE[0])
  const fy = labF(y / D65_WHITE[1])
  const fz = labF(z / D65_WHITE[2])
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labToXyz(lStar: number, a: number, b: number): [number, number, number] {
  const fy = (lStar + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  return [labFInv(fx) * D65_WHITE[0], labFInv(fy) * D65_WHITE[1], labFInv(fz) * D65_WHITE[2]]
}

// ── Tone <-> Y (CIE luminance, 0-1) — also the WCAG relative-luminance scale ────────────────

/** Tone (L*, 0-100) -> relative luminance Y (0-1). */
export function toneToY(tone: number): number {
  return labFInv((tone + 16) / 116)
}

/** Relative luminance Y (0-1) -> tone (L*, 0-100). */
export function yToTone(y: number): number {
  return 116 * labF(y) - 16
}

// ── Hex <-> RGB ──────────────────────────────────────────────────────────────────────────────

function expandShorthand(body: string): string {
  return body
    .split('')
    .map((c) => c + c)
    .join('')
}

function hexToRgb(hex: string): [number, number, number] {
  const body = hex.trim().replace(/^#/, '')
  const normalized = body.length === 3 ? expandShorthand(body) : body
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function hexChannel(c: number): string {
  return Math.max(0, Math.min(255, Math.round(c)))
    .toString(16)
    .padStart(2, '0')
}

function formatHex(r: number, g: number, b: number): string {
  return `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`
}

// ── Core: Hex <-> HCT ────────────────────────────────────────────────────────────────────────

/** Convert a hex color to HCT. Hue: 0-360, Chroma: 0-~120, Tone: 0-100. */
export function hexToHct(hex: string): HCT {
  const [r, g, b] = hexToRgb(hex)
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const [x, y, z] = linearRgbToXyz(lr, lg, lb)
  const [lStar, a, bLab] = xyzToLab(x, y, z)

  const hueRad = Math.atan2(bLab, a)
  let hue = (hueRad * 180) / Math.PI
  if (hue < 0) hue += 360

  const chroma = Math.sqrt(a * a + bLab * bLab)
  return { hue, chroma, tone: Math.max(0, Math.min(100, lStar)) }
}

function toneToGray(tone: number): number {
  return linearToSrgb(toneToY(tone))
}

function hctComponentToHex(hue: number, chroma: number, tone: number): string | null {
  const hueRad = (hue * Math.PI) / 180
  const a = Math.cos(hueRad) * chroma
  const b = Math.sin(hueRad) * chroma

  const [x, y, z] = labToXyz(tone, a, b)
  const [lr, lg, lb] = xyzToLinearRgb(x, y, z)

  const r = linearToSrgb(lr)
  const g = linearToSrgb(lg)
  const bVal = linearToSrgb(lb)

  const rLin = srgbToLinear(r)
  const gLin = srgbToLinear(g)
  const bLin = srgbToLinear(bVal)

  const tolerance = 0.02
  if (
    Math.abs(rLin - lr) > tolerance ||
    Math.abs(gLin - lg) > tolerance ||
    Math.abs(bLin - lb) > tolerance
  ) {
    return null
  }
  if (r < 0 || r > 255 || g < 0 || g > 255 || bVal < 0 || bVal > 255) return null

  return formatHex(r, g, bVal)
}

/** Convert HCT to hex, with gamut mapping (chroma reduction to find the closest in-gamut sRGB). */
export function hctToHex(hct: HCT): string {
  const { hue, chroma, tone } = hct

  if (tone <= 0) return '#000000'
  if (tone >= 100) return '#ffffff'
  if (chroma < 0.5) {
    const gray = toneToGray(tone)
    return formatHex(gray, gray, gray)
  }

  let lo = 0
  let hi = chroma
  let bestHex = '#000000'

  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    const candidate = hctComponentToHex(hue, mid, tone)
    if (candidate !== null) {
      bestHex = candidate
      lo = mid
    } else {
      hi = mid
    }
  }

  return bestHex
}

// ── Tonal palette ────────────────────────────────────────────────────────────────────────────

const PALETTE_TONES = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100]

/** Generate a tonal palette: hex colors at standard tones for a given hue and chroma. */
export function tonalPalette(hue: number, chroma: number): { tone: number; hex: string }[] {
  return PALETTE_TONES.map((tone) => ({ tone, hex: hctToHex({ hue, chroma, tone }) }))
}

// ── WCAG helpers ─────────────────────────────────────────────────────────────────────────────

/** WCAG relative luminance (0-1) of a hex color — the same linear-light weighted sum as XYZ Y. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126729 * srgbToLinear(r) + 0.7151522 * srgbToLinear(g) + 0.072175 * srgbToLinear(b)
}

/** WCAG contrast ratio between two hex colors (1-21, order-independent). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

/** CIE76 ΔE*ab between two hex colors, via their HCT (polar Lab) representations. */
export function deltaE76(hexA: string, hexB: string): number {
  const a = hexToHct(hexA)
  const b = hexToHct(hexB)
  const aRad = (a.hue * Math.PI) / 180
  const bRad = (b.hue * Math.PI) / 180
  const aLab = { l: a.tone, a: Math.cos(aRad) * a.chroma, b: Math.sin(aRad) * a.chroma }
  const bLab = { l: b.tone, a: Math.cos(bRad) * b.chroma, b: Math.sin(bRad) * b.chroma }
  return Math.sqrt((aLab.l - bLab.l) ** 2 + (aLab.a - bLab.a) ** 2 + (aLab.b - bLab.b) ** 2)
}
