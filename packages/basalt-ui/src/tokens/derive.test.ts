/**
 * `derive.ts`'s fill-page contrast clamp — the law that an accent fill shifted off the band centre
 * by `accentBrightness` must still clear `FILL_PAGE_CONTRAST_MIN` (3.0:1) against BOTH derived page
 * backgrounds, never just the label-vs-fill floor. See the law comment above `FILL_LUMINANCE` in
 * `derive.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { contrastRatio, hexToHct } from './hct'
import { DEFAULT_DERIVE_CONFIG, DERIVE_LEVEL_RANGE, deriveTokens, deriveTokensRaw } from './derive'
import type { DerivedPalette, SurfaceKey } from './derive'
import {
  STATUS_HUE,
  STATUS_TEXT_CONTRAST_MIN,
  STATUS_TEXT_SURFACES,
  statusHexAtStep,
} from './status-text'

const FILL_PAGE_CONTRAST_MIN = 3.0

describe('the fill-page contrast clamp', () => {
  test('the default config (accentBrightness 0) is a no-op — accentFill hex is unchanged', () => {
    expect(deriveTokens(DEFAULT_DERIVE_CONFIG).accentFill.light).toBe('#4374a6')
  })

  for (const accentBrightness of [5, -5]) {
    test(`accentBrightness ${accentBrightness} at the default seed clears 3.0:1 vs both derived page backgrounds`, () => {
      const data = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, accentBrightness })
      const fill = data.accentFill.light
      expect(contrastRatio(fill, data.surface.bg.light)).toBeGreaterThanOrEqual(
        FILL_PAGE_CONTRAST_MIN,
      )
      expect(contrastRatio(fill, data.surface.bg.dark)).toBeGreaterThanOrEqual(
        FILL_PAGE_CONTRAST_MIN,
      )
    })
  }
})

describe('the ink ramp clears WCAG AA on every text surface', () => {
  const data = deriveTokens(DEFAULT_DERIVE_CONFIG)
  const TEXT_SURFACES = ['bg', 'panel', 'panelHover', 'elevated', 'subtle', 'field'] as const

  for (const side of ['light', 'dark'] as const) {
    for (const key of ['ink', 'ink2', 'muted', 'faint'] as const) {
      test(`${side} ${key} ≥ 4.5:1`, () => {
        for (const surface of TEXT_SURFACES) {
          expect(
            contrastRatio(data.ink[key][side], data.surface[surface][side]),
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})

describe('the status solids clear WCAG AA as text on every text surface', () => {
  const data = deriveTokens(DEFAULT_DERIVE_CONFIG)
  const TEXT_SURFACES = ['bg', 'panel', 'panelHover', 'elevated', 'subtle', 'field'] as const

  // `DeltaBadge` paints `var(--vx-status-good|bad)` as text and a toned `breakdown` row paints
  // `warn`; a fill-less delta has no tint to lean on, so the solid itself carries the ratio.
  for (const side of ['light', 'dark'] as const) {
    for (const key of ['good', 'warn', 'bad'] as const) {
      test(`${side} ${key} ≥ 4.5:1`, () => {
        for (const surface of TEXT_SURFACES) {
          expect(
            contrastRatio(data.status[key][side], data.surface[surface][side]),
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})

describe('the status solids are derived per surface (Wave 34)', () => {
  const NEUTRALS = ['zinc', 'neutral', 'stone', 'slate'] as const
  const LEVELS = Array.from(
    { length: DERIVE_LEVEL_RANGE.max - DERIVE_LEVEL_RANGE.min + 1 },
    (_, i) => DERIVE_LEVEL_RANGE.min + i,
  )
  // 8-bit hex quantization near black plus the gamut edge: the measured worst case is 3.84°.
  const HUE_TOLERANCE = 5
  const STATUS_KEYS = Object.keys(STATUS_HUE) as (keyof typeof STATUS_HUE)[]
  const TEXT_SURFACES = (Object.keys(STATUS_TEXT_SURFACES) as SurfaceKey[]).filter(
    (key) => STATUS_TEXT_SURFACES[key],
  )
  const clears = (hex: string, derived: DerivedPalette, side: 'light' | 'dark'): boolean =>
    TEXT_SURFACES.every(
      (surface) => contrastRatio(hex, derived.surface[surface][side]) >= STATUS_TEXT_CONTRAST_MIN,
    )

  // Wave 37 moved three: the row surfaces joined the solve (good light #327a4d, warn light #966200,
  // bad dark #f97d74 before). `MIGRATING.md` § Unreleased lists them.
  test('the default config pins every status hex', () => {
    expect(deriveTokens(DEFAULT_DERIVE_CONFIG).status).toEqual({
      good: { light: '#2f774b', dark: '#52c07c' },
      warn: { light: '#935f00', dark: '#e6a53d' },
      bad: { light: '#b5403d', dark: '#fe8178' },
    })
  })

  test('every level pair × neutral clears the floor, keeps its hue, and moves no further than needed', () => {
    for (const neutral of NEUTRALS) {
      for (const lightLevel of LEVELS) {
        for (const darkLevel of LEVELS) {
          const derived = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, neutral, lightLevel, darkLevel })
          for (const key of STATUS_KEYS) {
            for (const side of ['light', 'dark'] as const) {
              const hex = derived.status[key][side]
              expect(clears(hex, derived, side)).toBe(true)
              const delta = Math.abs(hexToHct(hex).hue - STATUS_HUE[key])
              expect(Math.min(delta, 360 - delta)).toBeLessThan(HUE_TOLERANCE)
              // Minimality: one step back toward the calibrated stop fails the floor.
              let step = 0
              while (statusHexAtStep(key, side, step) !== hex) step++
              if (step > 0) {
                expect(clears(statusHexAtStep(key, side, step - 1), derived, side)).toBe(false)
              }
            }
          }
        }
      }
    }
  })

  test('vibrancy and accentBrightness extremes do not move the status solids', () => {
    const base = deriveTokens(DEFAULT_DERIVE_CONFIG).status
    for (const extreme of [-5, 5]) {
      const derived = deriveTokens({
        ...DEFAULT_DERIVE_CONFIG,
        vibrancy: extreme,
        accentBrightness: extreme,
      })
      expect(derived.status).toEqual(base)
    }
  })

  test('the walk engages at lightLevel -5 / darkLevel 5: light darkens, dark lightens', () => {
    const base = deriveTokens(DEFAULT_DERIVE_CONFIG).status
    const shifted = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, lightLevel: -5, darkLevel: 5 }).status
    for (const key of STATUS_KEYS) {
      expect(shifted[key].light).not.toBe(base[key].light)
      expect(hexToHct(shifted[key].light).tone).toBeLessThan(hexToHct(base[key].light).tone)
      expect(shifted[key].dark).not.toBe(base[key].dark)
      expect(hexToHct(shifted[key].dark).tone).toBeGreaterThan(hexToHct(base[key].dark).tone)
    }
  })

  test('an unattainable tone throws, on either side', () => {
    const raw = { chromaMult: 1, accentToneShift: 0, lightSurfaceShift: 0, darkSurfaceShift: 0 }
    expect(() =>
      deriveTokensRaw(DEFAULT_DERIVE_CONFIG, { ...raw, lightSurfaceShift: -100 }),
    ).toThrow('status text: no light')
    expect(() => deriveTokensRaw(DEFAULT_DERIVE_CONFIG, { ...raw, darkSurfaceShift: 100 })).toThrow(
      'status text: no dark',
    )
  })

  test('levels outside the range clamp to the nearest bound; non-finite becomes 0', () => {
    const at = (lightLevel: number, darkLevel: number) =>
      deriveTokens({ ...DEFAULT_DERIVE_CONFIG, lightLevel, darkLevel })
    expect(at(6, -6)).toEqual(at(DERIVE_LEVEL_RANGE.max, DERIVE_LEVEL_RANGE.min))
    expect(at(-99, 99)).toEqual(at(DERIVE_LEVEL_RANGE.min, DERIVE_LEVEL_RANGE.max))
    expect(at(Number.NaN, Number.POSITIVE_INFINITY)).toEqual(at(0, 0))
  })
})

describe('the filled accent hover step', () => {
  /** A step that reads at button size: the old 4.8 was indistinguishable from rest (Wave 45-46). */
  const MIN_HOVER_STEP_TONE = 8
  const LABEL_CONTRAST_MIN = 4.5

  for (const accentBrightness of [0, 5, -5]) {
    test(`accentBrightness ${accentBrightness}: hover is at least ${MIN_HOVER_STEP_TONE} tone darker and keeps the white label at 4.5:1`, () => {
      const { accentFill, accentFillHover } = deriveTokens({
        ...DEFAULT_DERIVE_CONFIG,
        accentBrightness,
      })
      for (const side of ['light', 'dark'] as const) {
        const step = hexToHct(accentFill[side]).tone - hexToHct(accentFillHover[side]).tone
        expect(step).toBeGreaterThanOrEqual(MIN_HOVER_STEP_TONE)
        // The label floor holds at rest and hover on the default band; a positive brightness
        // shift lightens the fill itself (its own clamp is the 3:1 page law above).
        if (accentBrightness > 0) continue
        expect(contrastRatio('#ffffff', accentFill[side])).toBeGreaterThanOrEqual(
          LABEL_CONTRAST_MIN,
        )
        expect(contrastRatio('#ffffff', accentFillHover[side])).toBeGreaterThanOrEqual(
          LABEL_CONTRAST_MIN,
        )
      }
    })
  }

  test('the step is pinned: 10 tone at the default seed (old 4.8)', () => {
    const { accentFill, accentFillHover } = deriveTokens(DEFAULT_DERIVE_CONFIG)
    const step = hexToHct(accentFill.light).tone - hexToHct(accentFillHover.light).tone
    expect(step).toBeGreaterThan(9.5)
    expect(step).toBeLessThan(10.5)
  })

  // A spread of hues: the label floor is the band's law, the hover only ever darkens, so it holds.
  const SEEDS = ['#0077bd', '#c2410c', '#16a34a', '#7c3aed', '#db2777', '#ca8a04']
  for (const accent of SEEDS) {
    test(`seed ${accent}: the hover fill keeps the white label at 4.5:1 in both schemes`, () => {
      const { accentFill, accentFillHover } = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, accent })
      for (const side of ['light', 'dark'] as const) {
        expect(contrastRatio('#ffffff', accentFill[side])).toBeGreaterThanOrEqual(
          LABEL_CONTRAST_MIN,
        )
        expect(contrastRatio('#ffffff', accentFillHover[side])).toBeGreaterThanOrEqual(
          LABEL_CONTRAST_MIN,
        )
      }
    })
  }
})
