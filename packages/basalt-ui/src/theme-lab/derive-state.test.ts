/**
 * `toDeriveOverride` — the store-to-override projection BOTH halves of the theme lab go through (the
 * `<style>` injection in `derive-controls.tsx` and the theme rebuild in `../provider/lab-theme.ts`).
 *
 * Worth its own file because `lab-theme.test.ts` builds a `DeriveOverride` by hand (its `at()`
 * helper) and never calls this function, so nothing there would catch either of its two jobs
 * regressing:
 *
 * 1. `applied: false` → `null`. This is the gate the whole "production path is untouched" claim rests
 *    on — every app that never mounts the panel reads `DEFAULT_STATE`, whose `applied` is false.
 * 2. The config carries EXACTLY the six color knobs. `resolveDeriveConfig` is a plain spread, so the
 *    obvious simplification — handing it the whole persisted state — would silently carry
 *    `applied`/`radius`/`density` into the config, and from there onto `theme.other.basaltDerive`
 *    (read by `BasaltBridge`) and into `buildPaletteData`'s memo key. It would not throw and nothing
 *    else in the suite would notice.
 *
 * The persisted-envelope validator is tested separately, in `derive-controls.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_STATE, toDeriveOverride } from './derive-state'
import { DEFAULT_DERIVE_CONFIG } from '../tokens/derive'

describe('the applied gate', () => {
  test('DEFAULT_STATE (applied: false) yields no override — the production path', () => {
    expect(toDeriveOverride(DEFAULT_STATE)).toBeNull()
  })

  test('a fully tuned state with applied: false still yields no override', () => {
    const tuned = { ...DEFAULT_STATE, accent: '#ff0000', radius: -3, density: 2, applied: false }
    expect(toDeriveOverride(tuned)).toBeNull()
  })

  test('applied: true yields an override carrying both levels verbatim', () => {
    const override = toDeriveOverride({ ...DEFAULT_STATE, applied: true, radius: -2, density: 3 })
    expect(override).not.toBeNull()
    expect(override?.radiusLevel).toBe(-2)
    expect(override?.densityLevel).toBe(3)
  })
})

describe('the resolved config carries exactly the six derive knobs', () => {
  const override = toDeriveOverride({
    ...DEFAULT_STATE,
    applied: true,
    accent: '#ff0000',
    neutral: 'stone',
    radius: -2,
    density: 1,
  })

  test('no state-only key leaks into the config', () => {
    // Keyed off `DEFAULT_DERIVE_CONFIG` rather than an exported key list: adding a seventh knob to
    // the config should extend this assertion automatically, not silently pass a stale list.
    expect(Object.keys(override?.config ?? {}).sort()).toEqual(
      Object.keys(DEFAULT_DERIVE_CONFIG).sort(),
    )
    expect(override?.config).not.toHaveProperty('applied')
    expect(override?.config).not.toHaveProperty('radius')
    expect(override?.config).not.toHaveProperty('density')
  })

  test('the tuned knobs are carried through', () => {
    expect(override?.config.accent).toBe('#ff0000')
    expect(override?.config.neutral).toBe('stone')
  })

  test('untouched knobs fall back to the shipped default per-knob', () => {
    expect(override?.config.lightLevel).toBe(DEFAULT_DERIVE_CONFIG.lightLevel)
    expect(override?.config.vibrancy).toBe(DEFAULT_DERIVE_CONFIG.vibrancy)
  })
})
