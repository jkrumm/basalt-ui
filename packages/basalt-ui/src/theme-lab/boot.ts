/**
 * Theme-lab boot — the production-entry half of the theme lab, split out of `index.tsx` on purpose.
 *
 * `applyOverrides(loadOverrides())` is called at PRODUCTION module scope by every consumer's
 * `main.tsx` (see `README.md`'s "Wire the runtime" section) to re-apply a persisted tuning session
 * on load — but `index.tsx` also hosts `ThemeLabControls` (11 `@mantine/core` imports) and
 * re-exports `DeriveControls`, which is DEV-tool UI. None of the three boot functions should assume
 * a browser: `readVar` in particular used to append a probe `<span>` to `document.body` with no
 * guard at all, which threw outright under SSR.
 *
 * What is actually enforced (`boot.test.ts`): every DOM-touching export is a no-op / empty-result
 * with no `document`, never a throw, and this module statically imports nothing from `@mantine/*` or
 * React. There is no `basalt-ui/theme-lab/boot` subpath and no dist-layering check on it — a prod
 * entry still imports `basalt-ui/theme-lab` and gets `index.tsx`, which re-exports this module
 * alongside `ThemeLabControls`. Whether a bundler actually tree-shakes the unused Mantine UI back out
 * of a prod build that only calls `applyOverrides`/`loadOverrides`/`readVar` is bundler-dependent,
 * not something this split guarantees on its own.
 */

export type ColorTunable = { var: string; label: string }
export type ColorGroup = { title: string; items: ColorTunable[] }
export type Overrides = Record<string, string>

/** Gradient strength knobs (percent values, theme-independent). */
export const AREA_TOP_VAR = '--vx-area-top'
export const AREA_BOTTOM_VAR = '--vx-area-bottom'

/**
 * Structural `--vx-*` vars worth tuning by eye — the ones `tokens/palette.ts` hand-authors and
 * that never move with the derive config (ColorInput is hex-only, so `rgba()`/`color-mix()` chrome
 * vars like `--vx-axis` / `--vx-grid` are intentionally omitted regardless).
 *
 * Identity/color tuning lives exclusively in `DeriveControls` (one accent seed + bounded knobs,
 * `tokens/derive.ts`) — every `--vx-*` var GENERATED from that config (the accent family, the 12
 * categorical fills, the ink ramp, most of the surface stops, the `good`/`warn`/`bad`
 * status/semantic hues) has been pruned from here on purpose: hand-tuning a hex the derive engine
 * regenerates on every render is a dead knob. What remains is a low-level inspector for the
 * genuinely NON-derived structural tokens only.
 *
 * Generic by design: argo's domain series (Health / Strength / Walking) are NOT shipped — a
 * consumer passes its own series groups to `ThemeLabControls` via the `groups` prop.
 */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    // `excellent` (top-of-scale grade) and `neutral` (mid-scale) keep their own hand-authored BP
    // families — unlike `good`/`warn`/`bad`, which are the SAME derived hues as `Semantic` and are
    // not independently tunable here.
    title: 'Status (chart-only)',
    items: [
      { var: '--vx-status-excellent', label: 'Excellent' },
      { var: '--vx-status-neutral', label: 'Neutral' },
    ],
  },
  {
    // Chart line/dot chrome — hand-authored off the zinc `BP.gray`/`BP.white`/`BP.darkGray`
    // families, independent of the derive config.
    title: 'Chart chrome',
    items: [
      { var: '--vx-line', label: 'Line' },
      { var: '--vx-line2', label: 'Line 2' },
      { var: '--vx-dot-stroke', label: 'Dot stroke' },
    ],
  },
  {
    // The floating-layer surface (menus, popovers, tooltips, modals, drawers) — the one SURFACE
    // stop the derive engine has no law for, so it stays a hand-picked hex/color-mix().
    title: 'Surface',
    items: [{ var: '--vx-surface-overlay', label: 'Overlay' }],
  },
]

const COLOR_VARS = COLOR_GROUPS.flatMap((g) => g.items.map((i) => i.var))
const MANAGED_VARS = [...COLOR_VARS, AREA_TOP_VAR, AREA_BOTTOM_VAR]

const KEY = 'basalt-theme-lab'

/** SSR-safe: with no `document` (and so no `localStorage`), returns an empty overrides map. */
export function loadOverrides(): Overrides {
  if (typeof document === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    return {}
  }
}

export function saveOverrides(o: Overrides): void {
  if (typeof document === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    // private mode / quota — tuning just won't persist
  }
}

/**
 * Clears every managed var, then re-applies the given overrides. The single mutation point.
 * SSR-safe: with no `document`, this is a no-op.
 */
export function applyOverrides(o: Overrides): void {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  for (const v of MANAGED_VARS) el.style.removeProperty(v)
  for (const [k, val] of Object.entries(o)) {
    if (val) el.style.setProperty(k, val)
  }
}

/**
 * Current value of a color var as a hex `ColorInput` can display (reflects any active override or
 * the stylesheet default). SSR-safe: with no `document`, returns `''`.
 *
 * Reading the custom property directly is not enough: an UNREGISTERED custom property computes to
 * its literal source text, so a `color-mix()`-derived token (every surface — see `SURFACE` in
 * tokens/palette.ts) comes back as the string `"color-mix(in srgb, #3f3f46 50%, #27272a)"`, which
 * ColorInput cannot parse — it renders an empty swatch. Painting the var onto a probe element and
 * reading a real COLOR property instead forces the browser to resolve it to an rgb triple.
 */
export function readVar(name: string): string {
  if (typeof document === 'undefined') return ''
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (raw.startsWith('#')) return raw
  if (!raw) return ''

  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = `var(${name})`
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()

  const channels = computed.match(/[\d.]+/g)
  if (!channels || channels.length < 3) return raw
  const hex = channels
    .slice(0, 3)
    .map((c) => Math.round(Number(c)).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}
