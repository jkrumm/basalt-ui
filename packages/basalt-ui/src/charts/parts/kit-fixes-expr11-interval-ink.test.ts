/** The kit-drawn IntervalTrack label keeps its contrast on a dimmed mark in both schemes (expression cycle 11, row 6b). */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio } from '../../tokens/hct'

type Scheme = 0 | 1

const tokens = readFileSync(join(import.meta.dirname, '../../css/tokens.css'), 'utf8')
const token = (name: string, scheme: Scheme): string =>
  [...tokens.matchAll(new RegExp(`--basalt-${name}: (#[0-9a-f]{6});`, 'g'))][scheme]?.[1] as string

const toRgb = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
/** A colour at `share` over a ground, as the engine's `color-mix` in srgb lays it. */
const over = (fg: string, bg: string, share: number): string =>
  toHex(toRgb(fg).map((v, i) => v * share + (toRgb(bg)[i] ?? 0) * (1 - share)))

describe('IntervalTrack label on a dimmed mark', () => {
  const schemes: [string, Scheme][] = [
    ['light', 0],
    ['dark', 1],
  ]
  // A red series in each scheme: the bright one of the light card, the muted one of the dark.
  const reds: Record<string, string> = { '0': '#c0392b', '1': '#8e3b3b' }

  for (const [name, scheme] of schemes) {
    test(`${name}: an inside label (ink) on the veiled bar keeps 4.5:1`, () => {
      const card = token('card', scheme)
      // The dimmed bar: the series colour under the card veil at DIMMED (opacity 1 - DIMMED).
      const veiled = over(reds[String(scheme)] as string, card, 0.5)
      expect(contrastRatio(token('ink', scheme), veiled)).toBeGreaterThanOrEqual(4.5)
    })

    test(`${name}: an outside dimmed label (ink-faint) keeps 4.5:1 on the card`, () => {
      const card = token('card', scheme)
      expect(contrastRatio(token('ink-faint', scheme), card)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
