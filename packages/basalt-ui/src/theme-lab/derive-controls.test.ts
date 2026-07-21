/**
 * `DeriveControls`'s persisted-state migrations. v2→v3 bumped `STORAGE_VERSION` to `3` when
 * `density` was added alongside `radius` + the six color knobs; v3→v4 bumped it again when
 * `deriveSpacing`'s accepted range narrowed from `[-5, 5]` to `[-3, 3]` (see `derive-controls.tsx`'s
 * module doc comment for both). No `migrate` is passed to `createPersistedState`, so a version
 * mismatch falls through to `opts.initial` (`../state`'s `parseStorage`) rather than carrying
 * `parsed.value` forward — `parsePersistedDeriveState` is the schema validator that rejection
 * ultimately routes through.
 *
 * Tested at the validator seam directly (not through `createPersistedState`'s localStorage
 * round-trip): no DOM render harness is configured in this package (see
 * `../provider/build-fonts-css.test.ts`), and this repo's test environment has no `localStorage`
 * either (see `../router-tanstack/multi-search-param-store.test.ts`).
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DERIVE_CONFIG } from '../tokens/derive'
import { DEFAULT_STATE, parsePersistedDeriveState } from './derive-controls'

/** A v1-shaped persisted value — the six color knobs + `applied`, no `radius`/`density` key at all. */
const V1_SHAPED_VALUE = {
  accent: DEFAULT_DERIVE_CONFIG.accent,
  neutral: DEFAULT_DERIVE_CONFIG.neutral,
  lightLevel: DEFAULT_DERIVE_CONFIG.lightLevel,
  darkLevel: DEFAULT_DERIVE_CONFIG.darkLevel,
  vibrancy: DEFAULT_DERIVE_CONFIG.vibrancy,
  accentBrightness: DEFAULT_DERIVE_CONFIG.accentBrightness,
  applied: false,
}

/** A v2-shaped persisted value — the six color knobs + `radius` + `applied`, no `density` key. */
const V2_SHAPED_VALUE = { ...V1_SHAPED_VALUE, radius: 0 }

describe('a v1-shaped persisted value (no radius/density key) is rejected', () => {
  test('parsePersistedDeriveState returns null, not a value with radius/density: undefined', () => {
    const parsed = parsePersistedDeriveState(V1_SHAPED_VALUE)
    expect(parsed).toBeNull()
  })
})

describe('a v2-shaped persisted value (radius present, no density key) is rejected', () => {
  test('parsePersistedDeriveState returns null, not a value with density: undefined', () => {
    const parsed = parsePersistedDeriveState(V2_SHAPED_VALUE)
    expect(parsed).toBeNull()
  })

  test('DEFAULT_STATE (what a rejection falls back to via parseStorage) has a real density', () => {
    // No `migrate` is passed to `createPersistedState`, so a version mismatch (v1/v2 vs the current
    // v3) sets the pre-validation value to `opts.initial` — DEFAULT_STATE — which this validator
    // must then accept, landing a real `radius: 0` / `density: 0`, never `undefined`.
    expect(parsePersistedDeriveState(DEFAULT_STATE)).toEqual(DEFAULT_STATE)
    expect(DEFAULT_STATE.radius).toBe(0)
    expect(DEFAULT_STATE.density).toBe(0)
  })
})

describe('a v3-shaped persisted value (radius + density present) round-trips', () => {
  test('parsePersistedDeriveState accepts it and preserves both levels', () => {
    const v3Value = { ...V2_SHAPED_VALUE, radius: 3, density: -2 }
    expect(parsePersistedDeriveState(v3Value)).toEqual(v3Value)
  })

  test('an out-of-range density level is rejected', () => {
    const badValue = { ...V2_SHAPED_VALUE, density: 99 }
    expect(parsePersistedDeriveState(badValue)).toBeNull()
  })

  test('a non-integer density level is rejected', () => {
    const badValue = { ...V2_SHAPED_VALUE, density: 1.5 }
    expect(parsePersistedDeriveState(badValue)).toBeNull()
  })
})

describe('a pre-v4 envelope holding a density outside the narrowed [-3, 3] range is rejected', () => {
  // The exact live-crash path the v3->v4 bump exists to prevent: a v3 envelope from an earlier
  // session could hold `density: 4` or `density: -5`, both valid under the OLD `isLevel` (-5..5)
  // check that guarded `density` pre-v4. Falling through to `DEFAULT_STATE` here, instead of
  // reaching `deriveSpacing` at render, is what the version bump buys.
  test('density: 4 (in-range for radius, out of range for density) is rejected', () => {
    const badValue = { ...V2_SHAPED_VALUE, density: 4 }
    expect(parsePersistedDeriveState(badValue)).toBeNull()
  })

  test('density: -5 (the old lower bound) is rejected', () => {
    const badValue = { ...V2_SHAPED_VALUE, density: -5 }
    expect(parsePersistedDeriveState(badValue)).toBeNull()
  })

  test('radius: -5/5 stays accepted — only density narrowed', () => {
    const lowRadius = { ...V2_SHAPED_VALUE, radius: -5, density: -3 }
    const highRadius = { ...V2_SHAPED_VALUE, radius: 5, density: 3 }
    expect(parsePersistedDeriveState(lowRadius)).toEqual(lowRadius)
    expect(parsePersistedDeriveState(highRadius)).toEqual(highRadius)
  })
})
