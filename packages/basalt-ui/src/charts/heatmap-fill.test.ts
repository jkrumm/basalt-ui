/**
 * The absent fill must stay distinguishable from EVERY ramp step in both schemes: a near-baseline
 * hour must not read as an unmeasured one (linewatch W7 row 105: ΔE ≈ 4 on a 14% floor vs a 12%
 * flat fill). Colors resolve per scheme in CSS, so this composites the real palette pairs over the
 * real surfaces and measures CIE76 ΔE*ab, a metric independent of the alpha arithmetic.
 */
import { describe, expect, test } from 'bun:test'
import { deltaE76 } from '../tokens/hct'
import { buildPaletteData } from '../tokens/palette'
import { ABSENT_OPACITY, RAMP_FLOOR, rampOpacities } from './heatmap-fill'

/** The stated minimum: the lowest ramp step vs the absent fill, ΔE*ab. */
const MIN_DELTA_E = 10

const data = buildPaletteData()
const channels = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const over = (fg: string, a: number, bg: string): string => {
  const base = channels(bg)
  return `#${channels(fg)
    .map((c, i) =>
      Math.round(a * c + (1 - a) * base[i]!)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

const inks = {
  line: data.NEUTRAL.line,
  accent: data.ACCENT.accent,
  excellent: data.STATUS.excellent,
  good: data.STATUS.good,
  warn: data.STATUS.warn,
  bad: data.STATUS.bad,
}

describe('heatmap absent fill vs the ramp', () => {
  test('the ramp has eight steps and its floor clears the absent fill', () => {
    const steps = rampOpacities()
    expect(steps).toHaveLength(8)
    expect(steps[0]).toBe(RAMP_FLOOR)
    expect(steps.at(-1)).toBe(1)
    expect(RAMP_FLOOR).toBeGreaterThan(ABSENT_OPACITY)
  })

  for (const scheme of ['light', 'dark'] as const) {
    for (const surface of ['bg', 'panel'] as const) {
      for (const [name, ink] of Object.entries(inks)) {
        test(`${scheme} / ${surface} / ${name}: every step is ≥ ${MIN_DELTA_E} ΔE from absent`, () => {
          const bg = data.SURFACE[surface][scheme]
          const absent = over(data.NEUTRAL.neutral[scheme], ABSENT_OPACITY, bg)
          for (const a of rampOpacities()) {
            expect(deltaE76(absent, over(ink[scheme], a, bg))).toBeGreaterThanOrEqual(MIN_DELTA_E)
          }
        })
      }
    }
  }
})
