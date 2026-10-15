/**
 * Reference lines (`--vx-{good,bad,warn}-ref`) are the status solid at `REF_LINE_ALPHA`% over the
 * page. A dashed 1 px line has no label to lean on, so its composite must stay visible against
 * the surface it crosses in BOTH schemes, under every derive knob and neutral seed. The old 20–30%
 * left light-scheme `warn` at 1.25:1.
 */
import { describe, expect, test } from 'bun:test'
import { REF_LINE_ALPHA } from './core'
import { DEFAULT_DERIVE_CONFIG } from './derive'
import type { DeriveConfig } from './derive'
import { contrastRatio } from './hct'
import { buildPaletteData } from './palette'

/** At the shipped defaults; the knob extremes (a retuned light level, a warm neutral) may sag to the floor. */
const REF_CONTRAST_DEFAULT = 2
const REF_CONTRAST_FLOOR = 1.7
const NEUTRALS: readonly DeriveConfig['neutral'][] = ['zinc', 'neutral', 'stone', 'slate']
const LEVELS = [-5, 0, 5] as const

const channels = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

/** `c = a·fg + (1−a)·bg` per channel — what `color-mix(in srgb, fg a%, transparent)` paints. */
function composite(fg: string, bg: string, alpha: number): string {
  const base = channels(bg)
  const mixed = channels(fg).map((c, i) =>
    Math.round(alpha * c + (1 - alpha) * (base[i] as number)),
  )
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function refContrasts(config: DeriveConfig): number[] {
  const data = buildPaletteData(config)
  return (['good', 'bad', 'warn'] as const).flatMap((kind) =>
    (['light', 'dark'] as const).flatMap((side) =>
      [data.SURFACE.bg, data.SURFACE.panel].map((surface) =>
        contrastRatio(
          composite(data.SEMANTIC[kind][side], surface[side], REF_LINE_ALPHA / 100),
          surface[side],
        ),
      ),
    ),
  )
}

describe('reference lines stay visible in both schemes', () => {
  test('the shipped defaults clear 2:1', () => {
    for (const c of refContrasts(DEFAULT_DERIVE_CONFIG))
      expect(c).toBeGreaterThanOrEqual(REF_CONTRAST_DEFAULT)
  })
  for (const neutral of NEUTRALS) {
    for (const lightLevel of LEVELS) {
      for (const darkLevel of LEVELS) {
        test(`neutral=${neutral} lightLevel=${lightLevel} darkLevel=${darkLevel}`, () => {
          for (const c of refContrasts({
            ...DEFAULT_DERIVE_CONFIG,
            neutral,
            lightLevel,
            darkLevel,
          }))
            expect(c).toBeGreaterThanOrEqual(REF_CONTRAST_FLOOR)
        })
      }
    }
  }
})
