/**
 * Mantine-free token + palette layer.
 *
 * This module is PURE DATA + string helpers — ZERO `@mantine/*` imports (lint-enforced).
 * Colors are CSS custom properties under the `--vx-*` prefix (do NOT rename the prefix).
 * They resolve per color scheme in CSS, so `VX.*` works in components AND in non-component
 * files. Apply opacity via `alpha(token, a)` (never raw `rgba()`) so the hue keeps resolving.
 *
 * Grounded in argo `packages/charts/src/{tokens,palette,theme-vars,utils/color}.ts`.
 * S0: signatures are stable + grounded; full palette data lands in S2.
 */

/** A per-theme color pair: a hue keeps its identity but shifts shade across schemes. */
export type ColorPair = { light: string; dark: string }

/** A map of token name → per-theme color pair (the input shape for series/group builders). */
export type SeriesMap = Record<string, ColorPair>

/**
 * Apply opacity to any palette token, theme-aware. Use instead of raw `rgba()` so the
 * underlying hue still resolves per color scheme.
 *
 *   alpha(VX.neutral, 0.5)        // muted hairline
 *   alpha(VX.series.hrv, 0.08)    // soft tint of a series color
 */
export const alpha = (token: string, a: number): string =>
  `color-mix(in srgb, ${token} ${Math.round(a * 100)}%, transparent)`

/**
 * VX tokens — a small representative set of `var(--vx-*)` string refs grounded in argo's VX.
 * S0 placeholder surface; the full token registry (every series/activity/usage hue) lands in S2.
 */
export const VX = {
  // Non-color sizing constants
  lineWidth: 2.5,
  line2Width: 2,
  axisFont: 11,
  dotR: 5,

  // Neutral primary line/text color — default for single-series, no-signal marks
  line: 'var(--vx-line)',
  line2: 'var(--vx-line2)',

  // Grid / hover / legend
  grid: 'var(--vx-grid)',
  crosshair: 'var(--vx-crosshair)',
  dotStroke: 'var(--vx-dotStroke)',
  legendText: 'var(--vx-legendText)',

  // Base neutral for hairlines / muted text / overlays — apply opacity via alpha()
  neutral: 'var(--vx-neutral)',

  // App surfaces (cards, borders) — shared with the Mantine chrome
  surface: {
    bg: 'var(--vx-surface-bg)',
    panel: 'var(--vx-surface-panel)',
    elevated: 'var(--vx-surface-elevated)',
    border: 'var(--vx-surface-border)',
  },
  shadowCard: 'var(--vx-shadowCard)',

  // Semantic fills
  good: 'var(--vx-good)',
  bad: 'var(--vx-bad)',
  warn: 'var(--vx-warn)',
  goodSolid: 'var(--vx-goodSolid)',
  badSolid: 'var(--vx-badSolid)',
  warnSolid: 'var(--vx-warnSolid)',

  // Score / zone status scale (excellent → poor)
  status: {
    excellent: 'var(--vx-status-excellent)',
    good: 'var(--vx-status-good)',
    warn: 'var(--vx-status-warn)',
    bad: 'var(--vx-status-bad)',
    neutral: 'var(--vx-status-neutral)',
  },

  // Per-metric series colors — stable hue identity, shade resolved per theme.
  series: {
    hrv: 'var(--vx-hrv)',
    restingHr: 'var(--vx-restingHr)',
    sleepDuration: 'var(--vx-sleepDuration)',
    steps: 'var(--vx-steps)',
    calories: 'var(--vx-calories)',
    vo2max: 'var(--vx-vo2max)',
  },

  // Shared sizing
  margin: { top: 12, right: 16, bottom: 30, left: 44 },
  minPxPerTick: 55,
} as const

/** A CSS declaration line for a single `--vx-*` custom property. */
const decl = (name: string, value: string): string => `  --vx-${name}: ${value};`

/** Emit one prefixed group of pairs for a given scheme side. */
const groupSide = (prefix: string, map: SeriesMap, side: 'light' | 'dark'): string =>
  Object.entries(map)
    .map(([key, pair]) => decl(`${prefix}${key}`, pair[side]))
    .join('\n')

/**
 * Wrap a map of `{ name: ColorPair }` into `var(--vx-<prefix><name>)` token refs — the runtime
 * companion to `buildPaletteCss`. Lets a consumer define its own series and read stable refs.
 */
export function seriesTokens(map: SeriesMap, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(map)) out[key] = `var(--vx-${prefix}${key})`
  return out
}

/**
 * Define a named series map. Identity passthrough in S0 — gives consumers a typed authoring
 * entry point and a single place to validate/normalize series declarations in later stages.
 */
export function defineSeries(map: SeriesMap): SeriesMap {
  return map
}

/** Build a single namespaced group's token refs (`var(--vx-<name>-<key>)`). */
export function groupTokens(name: string, map: SeriesMap): Record<string, string> {
  return seriesTokens(map, `${name}-`)
}

/** Options for {@link buildPaletteCss}. */
export type BuildPaletteOpts = {
  /** Extra named series maps to emit under the given prefixes (e.g. `{ '': SERIES, 'activity-': ACTIVITY }`). */
  groups?: Record<string, SeriesMap>
  /** Theme-independent derived declarations (gradients, semantic fills) emitted once on `:root`. */
  derived?: string[]
}

/**
 * Emit the `--vx-*` stylesheet: a `:root` block of theme-independent scalars, then the
 * dark (default) and light primitive blocks under `html[data-mantine-color-scheme='…']`.
 *
 * S0 placeholder: emits only what it is given. The full palette wiring (SERIES/ACTIVITY/
 * USAGE/STATUS/NEUTRAL/SURFACE → CSS) lands in S2; the signature here is the stable contract.
 */
export function buildPaletteCss(opts: BuildPaletteOpts = {}): string {
  const groups = opts.groups ?? {}
  const derived = (opts.derived ?? []).map((d) => `  ${d}`).join('\n')
  const side = (s: 'light' | 'dark'): string =>
    Object.entries(groups)
      .map(([prefix, map]) => groupSide(prefix, map, s))
      .join('\n')
  return `:root {
${derived}
}
:root,
html[data-mantine-color-scheme='dark'] {
${side('dark')}
}
html[data-mantine-color-scheme='light'] {
${side('light')}
}`
}
