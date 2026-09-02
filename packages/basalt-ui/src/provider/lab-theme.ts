/**
 * The theme lab's theme-object seam — what makes the dev tool an HONEST measuring instrument.
 *
 * `DeriveControls` applies a config by injecting a `<style>` tag, which can only move CSS custom
 * properties. Part of what the Radius and Density knobs control is NOT a CSS var but a plain number
 * baked into the theme OBJECT by `buildTheme`, and a `<style>` tag cannot reach a number inside a JS
 * object. Exactly what that is (the set is small and knowable — `lab-theme.test.ts` pins it):
 *
 * - `theme.radius` and `theme.spacing` — the generic Mantine `xs`..`xl` scales, i.e. every `p="md"` /
 *   `gap="sm"` / `radius="md"` prop in the app.
 * - `defaultProps.radius` on Badge / SegmentedControl / Progress / Tooltip / Popover / Modal /
 *   Notification, `defaultProps.size` on Progress, `defaultProps.bulletSize` on Timeline.
 *
 * (Card and Paper are NOT in that set — their radius resolves through `var(--vx-radius-card)` in
 * `styles.root`, so the CSS half always covered them. Same for Input/Button/ActionIcon heights, which
 * read `--vx-space-*` through `vars`.)
 *
 * Before this seam existed the sliders moved the CSS-var surfaces (the CSS-module-heavy app sidebar
 * most of all) and left the generic Mantine scales frozen at level 0 — so the tool under-reported its
 * own knobs, unevenly across surfaces, which is precisely the reading a density retune is judged by.
 *
 * `BasaltProvider` therefore rebuilds a real theme through `createBasaltTheme(undefined, { derive,
 * radius, density })` and merges the result over the consumer's theme. The subtlety is the merge
 * DIRECTION. `BasaltProvider`'s contract is `createBasaltTheme(consumerTheme)` — consumer overrides
 * win, last. But the documented mount is `theme={createBasaltTheme()}`, i.e. the consumer hands over
 * a COMPLETE theme carrying every level-0 number; merging that last would clobber the lab's rebuilt
 * numbers right back to level 0 and reproduce the original bug one layer down. So the lab does not
 * merge its whole theme — it merges only its DELTA against the shipped base
 * ({@link themeOverrideDelta}): the fields a given config actually moves, and nothing else. A
 * consumer's `primaryColor: 'teal'` survives untouched; only what the sliders genuinely control is
 * out-cascaded.
 *
 * The delta also carries `other.basaltDerive`/`basaltRadius`/`basaltDensity`, so `BasaltBridge`'s
 * existing injection emits the matching `--vx-*` CSS off the running theme — one path, both halves.
 *
 * DEV-tool path only, twice over: it is compiled out of a production build entirely (see
 * {@link LAB_ENABLED}), and even in a dev build, with the "Apply" switch off — or in any app that
 * never mounts the panel, since the persisted key is written by nothing else —
 * {@link applyLabOverride} returns the consumer theme verbatim.
 */
import { mergeThemeOverrides } from '@mantine/core'
import type { MantineThemeOverride } from '@mantine/core'
import { useMemo } from 'react'
import { useDeriveControlsState, toDeriveOverride } from '../theme-lab/derive-state'
import type { DeriveOverride } from '../theme-lab/derive-state'
import { baseTheme, createBasaltTheme } from '../theme'
import { isDev } from '../common/is-dev'

type Plain = Record<string, unknown>

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Structural equality for theme leaves. Values here are JSON-shaped (numbers, strings, and the
 * 10-stop color tuples), so a serialized compare is both correct and cheaper to read than an
 * element-wise walk.
 */
function sameLeaf(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function deltaOf(base: Plain, next: Plain): Plain {
  const out: Plain = {}
  for (const [key, nextValue] of Object.entries(next)) {
    // A key `next` explicitly sets to `undefined` configures nothing — emitting it would hand
    // `mergeThemeOverrides` an undefined that clobbers a real consumer value.
    if (nextValue === undefined) continue
    // Functions are rebuilt fresh by every `buildTheme` call (`vars`/`classNames`/`styles`
    // callbacks), so a reference compare would report EVERY one of them as changed and the delta
    // would clobber a consumer's own `vars`/`classNames` overrides for those components. Skipping
    // them is safe because none of them closes over a radius/spacing value — every radius- and
    // density-anchored number in `buildTheme` sits in a plain data position (`theme.radius`,
    // `theme.spacing`, `defaultProps`), which `theme/radius.test.ts` + `theme/spacing.test.ts` lock.
    if (typeof nextValue === 'function') continue
    const baseValue = base[key]
    if (isPlainObject(nextValue) && isPlainObject(baseValue)) {
      const nested = deltaOf(baseValue, nextValue)
      if (Object.keys(nested).length > 0) out[key] = nested
      continue
    }
    if (!sameLeaf(baseValue, nextValue)) out[key] = nextValue
  }
  return out
}

/**
 * The minimal override that carries `base` to `next` — every field `next` sets to something `base`
 * doesn't already say, recursed into nested plain objects (so a single changed `defaultProps` number
 * yields just that one key, not the whole `components` map). Function-valued fields are skipped; see
 * the comment in `deltaOf`.
 *
 * Exported for `lab-theme.test.ts`.
 */
export function themeOverrideDelta(
  base: MantineThemeOverride,
  next: MantineThemeOverride,
): MantineThemeOverride {
  return deltaOf(base as Plain, next as Plain) as MantineThemeOverride
}

/**
 * Resolve the theme `BasaltProvider` hands to `MantineProvider`: the consumer's theme merged onto
 * the Basalt base as always, plus — when a lab override is active — the delta that override makes
 * against the shipped base.
 *
 * Pure and synchronous so `lab-theme.test.ts` can assert the merge result without a DOM.
 */
export function applyLabOverride(
  overrides: MantineThemeOverride | undefined,
  override: DeriveOverride | null,
): MantineThemeOverride {
  const theme = createBasaltTheme(overrides)
  if (override === null) return theme
  const labTheme = createBasaltTheme(undefined, {
    derive: override.config,
    radius: override.radiusLevel,
    density: override.densityLevel,
  })
  // An all-defaults override resolves back to `baseTheme` itself, so the delta is empty and this
  // merge is a no-op — the "Apply" switch on at level 0 changes nothing, as it should.
  return mergeThemeOverrides(theme, themeOverrideDelta(baseTheme, labTheme))
}

/**
 * DEV-build gate. `BasaltProvider` is the mandatory `.` entry, so an unconditional subscription to
 * the lab store would make EVERY production app pay a localStorage read + schema validation on first
 * render and keep a `window` 'storage' listener registered for its whole lifetime — to answer a
 * question ("is the dev lab active?") that is always "no" in an app that never mounts
 * `<DeriveControls>`. Resolved ONCE at module scope, so it also lets a bundler drop
 * `useLabThemeDev` (and with it the `theme-lab/derive-state` import) from a production build.
 *
 * The cost: the lab does nothing in a PRODUCTION BUILD of a playground/dev app. It is a dev tool run
 * through a dev server (`bun run dev`), so that is the right side of the trade — but if you ever
 * preview the playground via `vite build && vite preview`, the sliders will be inert there.
 */
const LAB_ENABLED = isDev()

/**
 * Dev build: subscribed to the lab store.
 *
 * `state` is a referentially STABLE snapshot — `createPersistedState` caches the parsed value keyed
 * on the raw localStorage string — so it is a sound memo dep, and one write (a slider drag) is
 * exactly one recompute. The memo matters: `createBasaltTheme`'s non-default paths allocate a fresh
 * theme per call, and an unmemoized result would hand `MantineProvider` a new `theme` reference every
 * render and churn every consumer of Mantine's theme context (the reason `createBasaltTheme`'s own
 * JSDoc says to call it at module scope).
 */
function useLabThemeDev(overrides: MantineThemeOverride | undefined): MantineThemeOverride {
  const [state] = useDeriveControlsState()
  return useMemo(() => applyLabOverride(overrides, toDeriveOverride(state)), [overrides, state])
}

/** Production build: the pre-existing path verbatim — no store, no listener, no extra import. */
function useLabThemeProd(overrides: MantineThemeOverride | undefined): MantineThemeOverride {
  return useMemo(() => createBasaltTheme(overrides), [overrides])
}

/**
 * `BasaltProvider`'s theme resolution. Picked at module scope, not per render — both implementations
 * call their hooks unconditionally at their own top level, and which one is bound never changes for
 * the app's lifetime, so the hook order is as stable as a plain function's (a `LAB_ENABLED ? use…()`
 * inline in one function body would be a conditional hook call and a `react/rules-of-hooks` error).
 */
export const useLabTheme = LAB_ENABLED ? useLabThemeDev : useLabThemeProd
