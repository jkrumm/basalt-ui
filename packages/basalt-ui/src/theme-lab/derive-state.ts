/**
 * The theme lab's persisted derive state — the Mantine-free half of `DeriveControls`.
 *
 * Split out of `derive-controls.tsx` because TWO layers read it now, and only one of them may see
 * `@mantine/core`:
 *
 * - `derive-controls.tsx` (the panel UI) reads AND writes it, and injects the `--vx-*` override
 *   `<style>` from it.
 * - `provider/lab-theme.ts` (the root layer) reads it to rebuild the actual Mantine theme object,
 *   so the numeric `defaultProps` and `theme.spacing` a `<style>` tag can never reach follow the
 *   sliders too.
 *
 * If the provider imported the panel module instead, every consumer's root chunk would pull the
 * whole dev-tool UI (Slider/ColorInput/SegmentedControl) along with the six lines of state it
 * actually needs. This module has zero `@mantine/*` and zero JSX for exactly that reason.
 */
import { createPersistedState, readPersistedValue } from '../state'
import { DEFAULT_DERIVE_CONFIG, resolveDeriveConfig } from '../tokens/derive'
import type { DeriveConfig } from '../tokens/derive'

const STORAGE_KEY = 'theme-lab-derive'
// v4: `deriveSpacing`'s accepted range narrowed from [-5, 5] to [-3, 3] (see that function's JSDoc,
// tokens/palette.ts) — bumped so a v3 envelope holding an out-of-range `density` (e.g. 4 or -5) from
// an earlier session fails validation and falls back to the default state instead of reaching
// `deriveSpacing` at render and throwing (a live crash path, not a nicety).
const STORAGE_VERSION = 4

/** Neutral-family choices — plain label/value data, rendered by the panel's `SegmentedControl`. */
export const NEUTRAL_OPTIONS = [
  { label: 'Zinc', value: 'zinc' },
  { label: 'Neutral', value: 'neutral' },
  { label: 'Stone', value: 'stone' },
  { label: 'Slate', value: 'slate' },
]
const NEUTRAL_VALUES = new Set(NEUTRAL_OPTIONS.map((o) => o.value))

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** A full 3- or 6-digit hex — the gate a `ColorInput` keystroke must clear before it reaches state. */
export const isAccentHex = (value: string): boolean => HEX_RE.test(value)

/** Exported for `derive-controls.test.ts` — the v2→v3 migration test needs the shape + default. */
export type PersistedDeriveState = DeriveConfig & {
  applied: boolean
  radius: number
  density: number
}

export const DEFAULT_STATE: PersistedDeriveState = {
  ...DEFAULT_DERIVE_CONFIG,
  applied: false,
  radius: 0,
  density: 0,
}

const isLevel = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= -5 && v <= 5

// Density's own validator — narrower than `isLevel` above (see `DENSITY_LEVEL_MARKS` in
// derive-controls.tsx). Kept separate rather than narrowing `isLevel` itself: radius and the four
// color knobs legitimately still need the full [-5, 5] range.
const isDensityLevel = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= -3 && v <= 3

/**
 * Validate + normalize a persisted envelope, or return null if it is unusable. Exported for
 * `derive-controls.test.ts` — the pure, headless seam to test the v1→v2 migration through: no DOM
 * render harness is configured in this package (see `../provider/build-fonts-css.test.ts`), so
 * `createPersistedState`'s full localStorage round-trip isn't reachable from a unit test, but this
 * is exactly the validator `parseStorage` (`../state`) falls back to `initial` from on a rejection
 * (this module passes no `migrate`, so a v1 envelope — pre-radius — hits this same rejection path).
 */
export function parsePersistedDeriveState(value: unknown): PersistedDeriveState | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const valid =
    typeof v['accent'] === 'string' &&
    HEX_RE.test(v['accent']) &&
    typeof v['neutral'] === 'string' &&
    NEUTRAL_VALUES.has(v['neutral']) &&
    isLevel(v['lightLevel']) &&
    isLevel(v['darkLevel']) &&
    isLevel(v['vibrancy']) &&
    isLevel(v['accentBrightness']) &&
    isLevel(v['radius']) &&
    isDensityLevel(v['density']) &&
    typeof v['applied'] === 'boolean'
  if (!valid) return null
  return {
    accent: v['accent'] as string,
    neutral: v['neutral'] as DeriveConfig['neutral'],
    lightLevel: v['lightLevel'] as number,
    darkLevel: v['darkLevel'] as number,
    vibrancy: v['vibrancy'] as number,
    accentBrightness: v['accentBrightness'] as number,
    radius: v['radius'] as number,
    density: v['density'] as number,
    applied: v['applied'] as boolean,
  }
}

/**
 * The persisted-state hook. ONE module-scoped store (see `createPersistedState`), so the panel and
 * `BasaltProvider` subscribe to the SAME instance — dragging a slider notifies both in the same
 * tick, which is what keeps the injected CSS and the rebuilt theme object from ever disagreeing.
 */
export const useDeriveControlsState = createPersistedState<PersistedDeriveState>({
  key: STORAGE_KEY,
  version: STORAGE_VERSION,
  initial: DEFAULT_STATE,
  schema: {
    '~standard': {
      version: 1,
      vendor: 'basalt-derive-controls',
      validate: (value) => {
        const parsed = parsePersistedDeriveState(value)
        return parsed !== null
          ? { value: parsed }
          : { issues: [{ message: 'invalid persisted derive-controls state' }] }
      },
    },
  },
})

/**
 * An ACTIVE lab override — the resolved color config plus the two integer levels. Both consumers
 * (the `<style>` injection and the theme rebuild) take this exact bundle, so they can never drift
 * apart on which config is live.
 */
export type DeriveOverride = { config: DeriveConfig; radiusLevel: number; densityLevel: number }

/**
 * The live override for a state value, or `null` when the "Apply" switch is off.
 *
 * Builds the `DeriveConfig` from the six knobs EXPLICITLY rather than spreading the whole state —
 * `resolveDeriveConfig` is a plain spread, so handing it the persisted state would carry
 * `applied`/`radius`/`density` into the config object (and from there onto
 * `theme.other.basaltDerive`) as junk keys.
 */
export function toDeriveOverride(state: PersistedDeriveState): DeriveOverride | null {
  if (!state.applied) return null
  return {
    config: resolveDeriveConfig({
      accent: state.accent,
      neutral: state.neutral,
      lightLevel: state.lightLevel,
      darkLevel: state.darkLevel,
      vibrancy: state.vibrancy,
      accentBrightness: state.accentBrightness,
    }),
    radiusLevel: state.radius,
    densityLevel: state.density,
  }
}

/**
 * Read the active override straight from localStorage, outside React — the chunk-load path, before
 * any component mounts. Fully validated by {@link parsePersistedDeriveState}, so it cannot throw.
 */
export function readAppliedDeriveOverride(): DeriveOverride | null {
  const persisted = parsePersistedDeriveState(readPersistedValue(STORAGE_KEY, STORAGE_VERSION))
  return persisted === null ? null : toDeriveOverride(persisted)
}
