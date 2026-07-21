/**
 * `DeriveControls`'s persisted-state v1→v2 migration — the store bumped `STORAGE_VERSION` to `2`
 * when `radius` was added alongside the six color knobs (see `derive-controls.tsx`'s module doc
 * comment). No `migrate` is passed to `createPersistedState`, so a version mismatch falls through
 * to `opts.initial` (`../state`'s `parseStorage`) rather than carrying `parsed.value` forward —
 * `parsePersistedDeriveState` is the schema validator that rejection ultimately routes through.
 *
 * Tested at the validator seam directly (not through `createPersistedState`'s localStorage
 * round-trip): no DOM render harness is configured in this package (see
 * `../provider/build-fonts-css.test.ts`), and this repo's test environment has no `localStorage`
 * either (see `../router-tanstack/multi-search-param-store.test.ts`).
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DERIVE_CONFIG } from '../tokens/derive'
import { DEFAULT_STATE, parsePersistedDeriveState } from './derive-controls'

/** A v1-shaped persisted value — the six color knobs + `applied`, no `radius` key at all. */
const V1_SHAPED_VALUE = {
  accent: DEFAULT_DERIVE_CONFIG.accent,
  neutral: DEFAULT_DERIVE_CONFIG.neutral,
  lightLevel: DEFAULT_DERIVE_CONFIG.lightLevel,
  darkLevel: DEFAULT_DERIVE_CONFIG.darkLevel,
  vibrancy: DEFAULT_DERIVE_CONFIG.vibrancy,
  accentBrightness: DEFAULT_DERIVE_CONFIG.accentBrightness,
  applied: false,
}

describe('a v1-shaped persisted value (no radius key) is rejected', () => {
  test('parsePersistedDeriveState returns null, not a value with radius: undefined', () => {
    const parsed = parsePersistedDeriveState(V1_SHAPED_VALUE)
    expect(parsed).toBeNull()
  })

  test('DEFAULT_STATE (what a rejection falls back to via parseStorage) has a real radius', () => {
    // No `migrate` is passed to `createPersistedState`, so a version mismatch (v1 vs the current
    // v2) sets the pre-validation value to `opts.initial` — DEFAULT_STATE — which this validator
    // must then accept, landing a real `radius: 0`, never `undefined`.
    expect(parsePersistedDeriveState(DEFAULT_STATE)).toEqual(DEFAULT_STATE)
    expect(DEFAULT_STATE.radius).toBe(0)
  })
})

describe('a v2-shaped persisted value (radius present) round-trips', () => {
  test('parsePersistedDeriveState accepts it and preserves the radius level', () => {
    const v2Value = { ...V1_SHAPED_VALUE, radius: 3 }
    expect(parsePersistedDeriveState(v2Value)).toEqual(v2Value)
  })

  test('an out-of-range radius level is rejected', () => {
    const badValue = { ...V1_SHAPED_VALUE, radius: 99 }
    expect(parsePersistedDeriveState(badValue)).toBeNull()
  })

  test('a non-integer radius level is rejected', () => {
    const badValue = { ...V1_SHAPED_VALUE, radius: 1.5 }
    expect(parsePersistedDeriveState(badValue)).toBeNull()
  })
})
