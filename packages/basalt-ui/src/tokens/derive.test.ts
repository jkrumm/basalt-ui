/**
 * `derive.ts`'s fill-page contrast clamp — the law that an accent fill shifted off the band centre
 * by `accentBrightness` must still clear `FILL_PAGE_CONTRAST_MIN` (3.0:1) against BOTH derived page
 * backgrounds, never just the label-vs-fill floor. See the law comment above `FILL_LUMINANCE` in
 * `derive.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { contrastRatio, hexToHct } from './hct'
import { DEFAULT_DERIVE_CONFIG, deriveTokens } from './derive'

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
  const TEXT_SURFACES = ['bg', 'panel', 'panelHover', 'elevated', 'subtle', 'field'] as const
  const LEVELS = [-5, 0, 5]
  const NEUTRALS = ['zinc', 'neutral', 'stone', 'slate'] as const
  const HUE: Record<'good' | 'warn' | 'bad', number> = { good: 151.975, warn: 76.64, bad: 29.905 }

  test('the default config keeps every status hex byte-identical', () => {
    expect(deriveTokens(DEFAULT_DERIVE_CONFIG).status).toEqual({
      good: { light: '#327a4d', dark: '#52c07c' },
      warn: { light: '#966200', dark: '#e6a53d' },
      bad: { light: '#b5403d', dark: '#f97d74' },
    })
  })

  test('≥ 4.5:1 on every text surface across the level × neutral × vibrancy/brightness extremes', () => {
    for (const neutral of NEUTRALS) {
      for (const lightLevel of LEVELS) {
        for (const darkLevel of LEVELS) {
          for (const { vibrancy, accentBrightness } of [
            { vibrancy: 0, accentBrightness: 0 },
            { vibrancy: 5, accentBrightness: 5 },
            { vibrancy: -5, accentBrightness: -5 },
          ]) {
            const data = deriveTokens({
              ...DEFAULT_DERIVE_CONFIG,
              neutral,
              lightLevel,
              darkLevel,
              vibrancy,
              accentBrightness,
            })
            for (const key of ['good', 'warn', 'bad'] as const) {
              for (const side of ['light', 'dark'] as const) {
                for (const surface of TEXT_SURFACES) {
                  expect(
                    contrastRatio(data.status[key][side], data.surface[surface][side]),
                  ).toBeGreaterThanOrEqual(4.5)
                }
              }
            }
          }
        }
      }
    }
  })

  test('hue is unchanged at the extremes', () => {
    const data = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, lightLevel: 5, darkLevel: -5 })
    for (const key of ['good', 'warn', 'bad'] as const) {
      for (const side of ['light', 'dark'] as const) {
        const delta = Math.abs(hexToHct(data.status[key][side]).hue - HUE[key])
        expect(Math.min(delta, 360 - delta)).toBeLessThan(2)
      }
    }
  })
})
