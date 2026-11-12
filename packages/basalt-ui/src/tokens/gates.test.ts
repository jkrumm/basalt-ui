/**
 * The v3 gates (ARCHITECTURE section 5, tokens-visual 3.3-3.5). PAIRS runs on the default seed and
 * the jkrumm accent across the whole vibrancy range; other presets get the emitter's refusal only.
 * A failing gate's message names the gate, scheme, ratio and the fix.
 */
import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_DERIVE_V3_CONFIG,
  deriveV3,
  STATUS_BACKGROUND_LABELS,
  statusBackgrounds,
  VIBRANCY_RANGE_V3,
} from './derive'
import type { DerivedV3 } from './derive'
import { checkGates, GateError, assertGates, PAIRS } from './gates'
import { contrastRatio, hexToHct } from './hct'
import { hexToOklab } from './oklab'
import { solveStatusV3, STATUS_HUE, STATUS_STOP } from './status-text'

/** jkrumm.com's hand-copied accent (tokens-visual 6). */
const JKRUMM_ACCENT = '#0084d1'
const VIBRANCY = Array.from(
  { length: VIBRANCY_RANGE_V3.max - VIBRANCY_RANGE_V3.min + 1 },
  (_, i) => VIBRANCY_RANGE_V3.min + i,
)

describe('PAIRS', () => {
  for (const accent of [DEFAULT_DERIVE_V3_CONFIG.accent, JKRUMM_ACCENT]) {
    test(`every gate passes for ${accent} at every vibrancy`, () => {
      for (const vibrancy of VIBRANCY) {
        const derived = deriveV3({ accent, neutral: DEFAULT_DERIVE_V3_CONFIG.neutral, vibrancy })
        expect(checkGates(derived).map((f) => f.message)).toEqual([])
      }
    })
  }

  test('gate names are unique and read <role>-on-<surface>', () => {
    const names = PAIRS.map((row) => row.gate)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('fill-on-inset')
    expect(names).toContain('brand-on-card')
    expect(names).toContain('good-on-tint-card')
    expect(names).toContain('input-on-raised')
  })

  test('the measured numbers on the 2.x anchor: fill 3.04 on the dark page, brand ink 4.57 on the light page', () => {
    const { colors } = deriveV3()
    const ratio = (fg: string, bg: string, side: 'light' | 'dark'): number =>
      contrastRatio(
        colors[fg as keyof typeof colors][side],
        colors[bg as keyof typeof colors][side],
      )
    // Dark inset is the 2.x field, which is the 2.x page: one value, one ratio.
    expect(ratio('brand-fill', 'canvas', 'dark')).toBeCloseTo(3.04, 2)
    expect(ratio('brand-fill', 'inset', 'dark')).toBeCloseTo(3.04, 2)
    // The fill on a dark card is 2.61 BY DESIGN: blue never fills on card, so it is no pair.
    expect(ratio('brand-fill', 'card', 'dark')).toBeCloseTo(2.61, 2)
    expect(ratio('brand', 'canvas', 'light')).toBeCloseTo(4.57, 2)
    expect(ratio('brand', 'canvas', 'dark')).toBeCloseTo(8.23, 2)
    expect(ratio('ink-faint', 'raised', 'dark')).toBeCloseTo(4.87, 2)
    expect(ratio('on-brand', 'brand-fill', 'light')).toBeCloseTo(4.9, 2)
  })

  test('the card steps away from the inset by its scheme floor (.044 over .03 dark, .014 light)', () => {
    const { colors } = deriveV3()
    const step = (side: 'light' | 'dark'): number =>
      Math.abs(hexToOklab(colors.inset[side]).L - hexToOklab(colors.card[side]).L)
    expect(step('dark')).toBeGreaterThan(0.03)
    expect(step('light')).toBeGreaterThanOrEqual(0.014)
    expect(step('dark')).toBeCloseTo(0.044, 3)
    expect(step('light')).toBeCloseTo(0.014, 3)
  })

  test('the card step gate holds .03 in dark and .014 in light', () => {
    const floors = PAIRS.filter((row) => row.gate.startsWith('card-step-')).map((row) => [
      row.only,
      row.min,
    ])
    expect(floors).toEqual([
      ['dark', 0.03],
      ['light', 0.014],
    ])
  })

  test('the input boundary reaches 3:1 on every surface, which the hairline (1.19 / 1.24) did not', () => {
    const derived = deriveV3()
    for (const bg of ['canvas', 'inset', 'card', 'raised']) {
      const row = PAIRS.find((r) => r.gate === `input-on-${bg}`)!
      for (const side of ['light', 'dark'] as const) {
        expect(row.measure(derived, side)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  test('the seed contributes its hue only: the fill hue is the seed hue at any seed chroma', () => {
    const hue = (hex: string): number => hexToHct(hex).hue
    const a = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent: '#0077bd' }).colors['brand-fill']
      .light
    const b = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent: '#0084d1' }).colors['brand-fill']
      .light
    // `#0077bd` is the 2.x seed; its fill is the 2.x accent fill.
    expect(a).toBe('#4374a6')
    expect(Math.abs(hue(a) - hue('#0077bd'))).toBeLessThan(1)
    expect(Math.abs(hue(a) - hue(b))).toBeLessThan(1)
  })
})

describe('status backgrounds', () => {
  test('the label list is exactly the order statusBackgrounds returns', () => {
    const { colors } = deriveV3()
    const surfaces = {
      canvas: colors.canvas.light,
      inset: colors.inset.light,
      card: colors.card.light,
      raised: colors.raised.light,
    }
    const labels = statusBackgrounds({
      side: 'light',
      surfaces,
      ink: colors.ink.light,
      tone: colors.good.light,
    }).map((b) => b.surface)
    expect(labels).toEqual([...STATUS_BACKGROUND_LABELS])
  })
})

describe('failure messages', () => {
  /** The default palette with the dark brand fill darkened until it fails the dark page gates. */
  function withWeakFill(): DerivedV3 {
    const derived = deriveV3()
    const weak = { light: derived.colors['brand-fill'].light, dark: '#1d4f7e' }
    return { ...derived, colors: { ...derived.colors, 'brand-fill': weak, 'chart-1': weak } }
  }

  test("a failing gate reads '<gate> <scheme> <ratio> < <floor> for --accent <hex>' and carries the fix", () => {
    const messages = checkGates(withWeakFill()).map((f) => f.message)
    const fill = messages.filter((m) => m.startsWith('fill-on-inset'))
    expect(fill).toHaveLength(1)
    expect(fill[0]).toMatch(
      /^fill-on-inset dark \d\.\d\d < 3\.0 for --accent #0077bd\. Raise --vibrancy or pick another hue\.$/,
    )
  })

  test('the ratio is floored, so a miss never prints as the floor it missed', () => {
    const derived = withWeakFill()
    for (const failure of checkGates(derived)) {
      const printed = Number(failure.message.match(/ (\d\.\d+) < /)![1])
      expect(printed).toBeLessThan(failure.min)
    }
  })

  test('failures carry gate, scheme, surface and value as data', () => {
    const [first] = checkGates(withWeakFill())
    expect(first).toMatchObject({
      gate: expect.any(String),
      scheme: expect.stringMatching(/light|dark/),
    })
    expect(first!.value).toBeLessThan(first!.min)
  })

  test('assertGates throws a GateError naming every failing gate; a passing palette does not throw', () => {
    expect(() => assertGates(deriveV3())).not.toThrow()
    let error: unknown
    try {
      assertGates(withWeakFill())
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(GateError)
    expect((error as GateError).failures.length).toBeGreaterThan(0)
    expect((error as GateError).message).toContain('fill-on-inset dark')
  })

  test('a palette whose ink stops leading the canvas fails polarity', () => {
    const derived = deriveV3()
    const flipped = {
      ...derived,
      colors: {
        ...derived.colors,
        ink: { light: derived.colors.canvas.light, dark: derived.colors.canvas.dark },
      },
    }
    expect(checkGates(flipped).some((f) => f.gate === 'polarity')).toBe(true)
  })
})

describe('the solved roles', () => {
  test('an unreachable status tone throws, as the 2.x solver did', () => {
    // A mid-grey background per side: darkening (light) or lightening (dark) never reaches 4.5:1.
    const mid = { light: '#5a5a5a', dark: '#b0b0b0' }
    for (const side of ['light', 'dark'] as const) {
      expect(() =>
        solveStatusV3({
          label: 'good',
          side,
          hue: STATUS_HUE.good,
          stop: STATUS_STOP.good[side],
          backgroundsOf: () => [mid[side]],
        }),
      ).toThrow(new RegExp(`no ${side} good tone reaches 4\\.5:1`))
    }
  })

  test('vibrancy scales the chroma: more at +3, less at -3, the hue stays', () => {
    const chroma = (vibrancy: number): number =>
      hexToHct(deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, vibrancy }).colors['brand-fill'].light)
        .chroma
    expect(chroma(3)).toBeGreaterThan(chroma(0))
    expect(chroma(-3)).toBeLessThan(chroma(0))
  })

  test('a malformed accent throws', () => {
    expect(() => deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent: 'blue' })).toThrow(
      /Invalid DeriveConfig\.accent/,
    )
  })
})
