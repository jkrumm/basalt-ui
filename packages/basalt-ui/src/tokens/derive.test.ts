/**
 * `derive.ts`'s fill-page contrast clamp — the law that an accent fill shifted off the band centre
 * by `accentBrightness` must still clear `FILL_PAGE_CONTRAST_MIN` (3.0:1) against BOTH derived page
 * backgrounds, never just the label-vs-fill floor. See the law comment above `FILL_LUMINANCE` in
 * `derive.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { contrastRatio } from './hct'
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
