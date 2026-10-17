/**
 * `derive.ts`'s fill-page contrast clamp — the law that an accent fill shifted off the band centre
 * by `accentBrightness` must still clear `FILL_PAGE_CONTRAST_MIN` (3.0:1) against BOTH derived page
 * backgrounds, never just the label-vs-fill floor. See the law comment above `FILL_LUMINANCE` in
 * `derive.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { contrastRatio, hexToHct } from './hct'
import {
  DEFAULT_DERIVE_CONFIG,
  deriveTokens,
  deriveTokensRaw,
  STATUS_HUE,
  STATUS_TEXT_CONTRAST_MIN,
  STATUS_TEXT_SURFACES,
} from './derive'
import type { SurfaceKey } from './derive'

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
  const LEVELS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
  // 8-bit hex quantization near black plus the gamut edge: the measured worst case is 3.84°.
  const HUE_TOLERANCE = 5
  const STATUS_KEYS = Object.keys(STATUS_HUE) as (keyof typeof STATUS_HUE)[]
  const TEXT_SURFACES = (Object.keys(STATUS_TEXT_SURFACES) as SurfaceKey[]).filter(
    (key) => STATUS_TEXT_SURFACES[key],
  )

  test('the default config keeps every status hex byte-identical', () => {
    expect(deriveTokens(DEFAULT_DERIVE_CONFIG).status).toEqual({
      good: { light: '#327a4d', dark: '#52c07c' },
      warn: { light: '#966200', dark: '#e6a53d' },
      bad: { light: '#b5403d', dark: '#f97d74' },
    })
  })

  test('every level pair × neutral clears the floor on every text surface and keeps its hue', () => {
    for (const neutral of NEUTRALS) {
      for (const lightLevel of LEVELS) {
        for (const darkLevel of LEVELS) {
          const derived = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, neutral, lightLevel, darkLevel })
          for (const key of STATUS_KEYS) {
            for (const side of ['light', 'dark'] as const) {
              const hex = derived.status[key][side]
              for (const surface of TEXT_SURFACES) {
                expect(contrastRatio(hex, derived.surface[surface][side])).toBeGreaterThanOrEqual(
                  STATUS_TEXT_CONTRAST_MIN,
                )
              }
              const delta = Math.abs(hexToHct(hex).hue - STATUS_HUE[key])
              expect(Math.min(delta, 360 - delta)).toBeLessThan(HUE_TOLERANCE)
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

  test('an unattainable tone throws', () => {
    expect(() =>
      deriveTokensRaw(DEFAULT_DERIVE_CONFIG, {
        chromaMult: 1,
        accentToneShift: 0,
        lightSurfaceShift: -100,
        darkSurfaceShift: 0,
      }),
    ).toThrow('status text')
  })

  test('an out-of-range surface level is a RangeError', () => {
    expect(() => deriveTokens({ ...DEFAULT_DERIVE_CONFIG, lightLevel: 6 })).toThrow(RangeError)
    expect(() => deriveTokens({ ...DEFAULT_DERIVE_CONFIG, darkLevel: -6 })).toThrow(RangeError)
  })
})

describe('contrastRatio', () => {
  test('black on white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  test('#777777 on white is ~4.48', () => {
    // luminance of #777 = ((0x77/255 + 0.055)/1.055)^2.4 ≈ 0.1845 → 1.05 / 0.2345
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})
