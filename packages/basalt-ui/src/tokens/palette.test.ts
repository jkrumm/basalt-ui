/**
 * `buildPaletteData` is the pure function `palette.ts`'s static ACCENT/FILL/SURFACE/INK/SEMANTIC/
 * STATUS exports are built from — this locks the two together: the static exports must be exactly
 * `buildPaletteData(DEFAULT_DERIVE_CONFIG)`'s output, not a hand-duplicated snapshot of it.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DERIVE_CONFIG } from './derive'
import {
  ACCENT,
  buildPaletteData,
  FILL,
  INK,
  NEUTRAL,
  scaleSpace,
  SEMANTIC,
  STATUS,
  SURFACE,
} from './palette'

describe('buildPaletteData(DEFAULT_DERIVE_CONFIG) deep-equals the static exports', () => {
  const data = buildPaletteData(DEFAULT_DERIVE_CONFIG)

  test('ACCENT', () => expect(data.ACCENT).toEqual(ACCENT))
  test('FILL', () => expect(data.FILL).toEqual(FILL))
  test('SURFACE', () => expect(data.SURFACE).toEqual(SURFACE))
  test('INK', () => expect(data.INK).toEqual(INK))
  test('NEUTRAL', () => expect(data.NEUTRAL).toEqual(NEUTRAL))
  test('SEMANTIC', () => expect(data.SEMANTIC).toEqual(SEMANTIC))
  test('STATUS', () => expect(data.STATUS).toEqual(STATUS))
})

describe('buildPaletteData() defaults to DEFAULT_DERIVE_CONFIG', () => {
  test('same result as an explicit default config', () => {
    expect(buildPaletteData()).toEqual(buildPaletteData(DEFAULT_DERIVE_CONFIG))
  })
})

describe('buildPaletteData is memoized by config value', () => {
  test('two calls with an equal (but not referentially identical) config return the same object', () => {
    const a = buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accent: '#123456' })
    const b = buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accent: '#123456' })
    expect(a).toBe(b)
  })

  test('a different config produces a different, non-default result', () => {
    const custom = buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accent: '#16a34a' })
    expect(custom).not.toEqual(buildPaletteData(DEFAULT_DERIVE_CONFIG))
  })
})

describe('buildPaletteData rejects a malformed accent seed', () => {
  test('a non-hex color name throws', () => {
    expect(() => buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accent: 'red' })).toThrow()
  })

  test('a truncated hex throws', () => {
    expect(() => buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accent: '#12' })).toThrow()
  })

  test('a non-hex-digit hex throws', () => {
    expect(() => buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accent: '#zzzzzz' })).toThrow()
  })
})

describe('the default-config entry is pinned against cache eviction', () => {
  test('buildPaletteData(DEFAULT_DERIVE_CONFIG) stays the same reference past the 32-entry cap', () => {
    const before = buildPaletteData(DEFAULT_DERIVE_CONFIG)
    for (let i = 0; i < 40; i++) {
      buildPaletteData({
        ...DEFAULT_DERIVE_CONFIG,
        accent: `#${(i + 1).toString(16).padStart(6, '0')}`,
      })
    }
    const after = buildPaletteData(DEFAULT_DERIVE_CONFIG)
    expect(after).toBe(before)
  })
})

describe('onAccent stays white under the fill-page contrast clamp', () => {
  test('the default config keeps a white onAccent', () => {
    expect(buildPaletteData(DEFAULT_DERIVE_CONFIG).ACCENT.onAccent.light).toBe('#ffffff')
  })

  // Previously a high accentBrightness pushed the fill tone light enough to fail the white-label
  // floor and flip onAccent to a dark ink. `derive.ts`'s fill-page contrast clamp now caps the fill
  // tone before that point is ever reached (the fill-vs-page floor is always at least as strict as
  // the fill-vs-white floor for a realistic, non-pure-white page background), so onAccent stays
  // white at every accentBrightness level for the shipped seed/surface config.
  test('a high accentBrightness still keeps onAccent white', () => {
    const data = buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, accentBrightness: 5 })
    expect(data.ACCENT.onAccent.light).toBe('#ffffff')
  })
})

describe('scaleSpace floors a base >= 1 at 1, never lets it round down to 0', () => {
  // No shipped base/level combination reaches this branch — `deriveSpacing`'s shallowest
  // multiplier is 0.7 (level -5), and every current base is an integer >= 1, so
  // `round(value * multiplier)` never drops below 1 on that path (see `scaleSpace`'s doc in
  // `palette.ts`). Drive the clamp directly with a multiplier `deriveSpacing` can never produce,
  // to prove the floor still holds if a base or the level range ever changes.
  test('a value of 1 at a multiplier of 0.3 would round to 0 without the floor', () => {
    expect(scaleSpace(1, -5, 0.3)).toBe(1)
  })

  test('a larger value at a more aggressive multiplier still floors at 1, not its raw round', () => {
    // round(2 * 0.1) = round(0.2) = 0 without the floor — proves the clamp for a value > 1 too,
    // not just the value-of-1 edge case above.
    expect(scaleSpace(2, -5, 0.1)).toBe(1)
  })

  test('level 0 bypasses scaling (and therefore the floor) entirely, returning value verbatim', () => {
    expect(scaleSpace(0.4, 0, 0.1)).toBe(0.4)
  })
})
