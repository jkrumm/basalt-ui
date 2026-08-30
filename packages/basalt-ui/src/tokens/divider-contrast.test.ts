/**
 * The seam is contrast-guaranteed under the knobs (docs/DESIGN-SPEC.md §5 "Region seams") — this
 * file is that claim as code. `--vx-divider` is a relative alpha over the derived ink (light) /
 * white (dark), not a fixed hex, so a floor here is a floor on every consumer identity, not just
 * the shipped default. If a cell ever fails, raise the alpha in `tokens/palette.ts`'s
 * `SURFACE.divider` — never lower the floor below.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DERIVE_CONFIG } from './derive'
import type { DeriveConfig } from './derive'
import { buildPaletteData } from './palette'

/** The measured floor (docs/DESIGN-SPEC.md §5: "holds ≥1.15:1 over page and panel under every
 * derive knob and neutral seed"). */
const DIVIDER_CONTRAST_MIN = 1.15

const NEUTRALS: readonly DeriveConfig['neutral'][] = ['zinc', 'neutral', 'stone', 'slate']
const LEVELS = [-5, 0, 5] as const

/** WCAG 2.x relative luminance — a second, independent implementation checked against the
 * standard (same idiom as `theme/contrast.test.ts`, never against the theme's own helper). */
function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

/** WCAG 2.x contrast ratio. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Parses the one shape `SURFACE.divider` ever emits: `rgba(r, g, b, a)`. */
function parseRgba(value: string): { r: number; g: number; b: number; a: number } {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value)
  if (m === null) throw new Error(`not an rgba() string: ${value}`)
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) }
}

const toHex = (v: number): string => v.toString(16).padStart(2, '0')

/** `c = a·fg + (1−a)·bg` per channel — the divider composited over a page/panel hex. */
function compositeOverHex(rgba: string, backgroundHex: string): string {
  const { r, g, b, a } = parseRgba(rgba)
  const [br, bgChan, bb] = hexToRgb(backgroundHex)
  const mix = (fg: number, base: number) => Math.round(a * fg + (1 - a) * base)
  return `#${toHex(mix(r, br))}${toHex(mix(g, bgChan))}${toHex(mix(b, bb))}`
}

describe('the divider seam holds contrast under every derive knob and neutral seed', () => {
  for (const neutral of NEUTRALS) {
    for (const lightLevel of LEVELS) {
      for (const darkLevel of LEVELS) {
        test(`neutral=${neutral} lightLevel=${lightLevel} darkLevel=${darkLevel}`, () => {
          const data = buildPaletteData({
            ...DEFAULT_DERIVE_CONFIG,
            neutral,
            lightLevel,
            darkLevel,
          })
          const { divider, bg, panel } = data.SURFACE

          for (const surface of [bg, panel]) {
            const lightComposite = compositeOverHex(divider.light, surface.light)
            expect(contrastRatio(lightComposite, surface.light)).toBeGreaterThanOrEqual(
              DIVIDER_CONTRAST_MIN,
            )
            // Polarity: on light the seam reads DARKER than the surface it sits on.
            expect(relativeLuminance(lightComposite)).toBeLessThan(relativeLuminance(surface.light))

            const darkComposite = compositeOverHex(divider.dark, surface.dark)
            expect(contrastRatio(darkComposite, surface.dark)).toBeGreaterThanOrEqual(
              DIVIDER_CONTRAST_MIN,
            )
            // Polarity: on dark the seam reads LIGHTER than the surface it sits on.
            expect(relativeLuminance(darkComposite)).toBeGreaterThan(
              relativeLuminance(surface.dark),
            )
          }
        })
      }
    }
  }
})
