/**
 * Mantine-free token + palette layer.
 *
 * This module is PURE DATA + string helpers — ZERO `@mantine/*` imports (lint-enforced).
 * Colors are CSS custom properties under the `--vx-*` prefix (do NOT rename the prefix).
 * They resolve per color scheme in CSS, so `VX.*` works in components AND in non-component
 * files. Apply opacity via `alpha(token, a)` (never raw `rgba()`) so the hue keeps resolving.
 *
 * Grounded in argo `packages/charts/src/{tokens,palette,theme-vars,utils/color}.ts`.
 */

import { BP, p, SEMANTIC, STATUS, NEUTRAL, SURFACE } from './palette'

/** A per-theme color pair: a hue keeps its identity but shifts shade across schemes. */
export type ColorPair = { light: string; dark: string }

/** A map of token name → per-theme color pair (the input shape for series/group builders). */
export type SeriesMap = Record<string, ColorPair>

/** Framework palette data — Basalt families, the shade-pair helper, and the generic pairs. */
export { BP, p, SEMANTIC, STATUS, NEUTRAL, SURFACE }

/**
 * Apply opacity to any palette token, theme-aware. Use instead of raw `rgba()` so the
 * underlying hue still resolves per color scheme.
 *
 *   alpha(VX.neutral, 0.5)        // muted hairline
 *   alpha(VX.status.warn, 0.1)    // zone-band fill
 */
export const alpha = (token: string, a: number): string =>
  `color-mix(in srgb, ${token} ${Math.round(a * 100)}%, transparent)`

/**
 * VX tokens — `var(--vx-*)` string refs + non-color sizing constants. Colors resolve per
 * color scheme in CSS, so `VX.*` works in components AND in non-component files. Never
 * reference raw hex in chart files — use `VX.*` / `alpha()`.
 *
 * The framework ships ONLY generic primitives — no domain `VX.series` tree (apps rebuild
 * that with `seriesTokens` / `groupTokens` against their own series maps).
 */
export const VX = {
  // Non-color sizing constants
  lineWidth: 2.5,
  line2Width: 2,
  axisFont: 11,
  dotR: 5,

  // Single source for the card corner radius — shared by the Mantine-free ChartCard and the
  // Mantine chrome (theme `radius.md` is the same 8px). One knob, so cards never diverge.
  radiusCard: 'var(--vx-radius-card)',

  // Secondary-line color (back-compat alias; now theme-aware via --vx-line2)
  line2Dark: 'var(--vx-line2)',

  // Semantic fills — consistent opacity across all charts
  good: 'var(--vx-good)',
  goodSoft: 'var(--vx-goodSoft)',
  bad: 'var(--vx-bad)',
  warn: 'var(--vx-warn)',
  goodSolid: 'var(--vx-goodSolid)',
  badSolid: 'var(--vx-badSolid)',
  warnSolid: 'var(--vx-warnSolid)',

  // Reference/dashed lines for thresholds
  goodRef: 'var(--vx-goodRef)',
  badRef: 'var(--vx-badRef)',
  warnRef: 'var(--vx-warnRef)',

  // Neutral primary line/text color — the default for single-series, no-signal marks
  // ("white/gray per theme"). Same value as the NEUTRAL.line pair.
  line: 'var(--vx-line)',
  line2: 'var(--vx-line2)',

  // Axis label + axis stroke colors (theme-aware). Exposed as flat refs so a bespoke chart that
  // renders raw <text> labels or axis lines (without the Axis* primitives) needs no hook.
  axis: 'var(--vx-axis)',
  axisStroke: 'var(--vx-axisStroke)',

  // Grid, hover, legend
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
    subtle: 'var(--vx-surface-subtle)',
    border: 'var(--vx-surface-border)',
  },

  // Score / zone status scale (excellent → poor)
  status: {
    excellent: 'var(--vx-status-excellent)',
    good: 'var(--vx-status-good)',
    warn: 'var(--vx-status-warn)',
    bad: 'var(--vx-status-bad)',
    neutral: 'var(--vx-status-neutral)',
  },

  // Shared sizing
  margin: { top: 12, right: 16, bottom: 30, left: 44 },
  minPxPerTick: 55,
} as const

type Side = 'light' | 'dark'

/** A CSS declaration line for a single `--vx-*` custom property. */
const decl = (name: string, value: string): string => `  --vx-${name}: ${value};`

/** Emit one prefixed group of pairs for a given scheme side. */
const groupSide = (prefix: string, map: SeriesMap, side: Side): string =>
  Object.entries(map)
    .map(([key, pair]) => decl(`${prefix}${key}`, pair[side]))
    .join('\n')

/**
 * Built-in framework primitives for a given scheme side — STATUS group, semantic solids,
 * neutral line/axis/grid/tooltip chrome, legend text, and the surface ramp. Domain series
 * (SERIES/ACTIVITY/USAGE) are NOT shipped — apps append them via `opts.groups`.
 */
function frameworkPrimitives(side: Side): string {
  const n = NEUTRAL
  const s = SEMANTIC
  const su = SURFACE
  return [
    groupSide('status-', STATUS as SeriesMap, side),
    decl('goodSolid', s.good[side]),
    decl('badSolid', s.bad[side]),
    decl('warnSolid', s.warn[side]),
    decl('neutral', n.neutral[side]),
    decl('line', n.line[side]),
    decl('line2', n.line2[side]),
    decl('axis', n.axis[side]),
    decl('axisStroke', n.axisStroke[side]),
    decl('grid', n.grid[side]),
    decl('crosshair', n.crosshair[side]),
    decl('dotStroke', n.dotStroke[side]),
    decl('tooltipBg', n.tooltipBg[side]),
    decl('tooltipText', n.tooltipText[side]),
    decl('tooltipMuted', n.tooltipMuted[side]),
    decl('tooltipBorder', n.tooltipBorder[side]),
    decl('tooltipShadow', n.tooltipShadow[side]),
    decl('legendText', side === 'dark' ? 'rgba(255,255,255,0.92)' : 'rgba(18,17,16,0.82)'),
    decl('surface-bg', su.bg[side]),
    decl('surface-panel', su.panel[side]),
    decl('surface-elevated', su.elevated[side]),
    decl('surface-subtle', su.subtle[side]),
    decl('surface-border', su.border[side]),
  ].join('\n')
}

/**
 * Theme-independent scalars + semantic fills, defined once on `:root`.
 *
 * Area-gradient strength is a global knob (the theme lab overrides these two on `:root`
 * to retune every line-area fill live). 0%/0% disables gradients app-wide.
 */
const FRAMEWORK_DERIVED = [
  decl('radius-card', '8px'),
  decl('area-top', '22%'),
  decl('area-bottom', '1%'),
  decl('good', 'color-mix(in srgb, var(--vx-goodSolid) 18%, transparent)'),
  decl('goodSoft', 'color-mix(in srgb, var(--vx-goodSolid) 8%, transparent)'),
  decl('bad', 'color-mix(in srgb, var(--vx-badSolid) 18%, transparent)'),
  decl('warn', 'color-mix(in srgb, var(--vx-warnSolid) 8%, transparent)'),
  decl('goodRef', 'color-mix(in srgb, var(--vx-goodSolid) 30%, transparent)'),
  decl('badRef', 'color-mix(in srgb, var(--vx-badSolid) 30%, transparent)'),
  decl('warnRef', 'color-mix(in srgb, var(--vx-warnSolid) 20%, transparent)'),
].join('\n')

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
 * Define a named series map. Identity passthrough — gives consumers a typed authoring entry
 * point and a single place to validate/normalize series declarations.
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
 * The framework chrome (STATUS/SEMANTIC/SURFACE pairs + the framework DERIVED defaults) is
 * built in, so an empty `buildPaletteCss()` already emits every framework var. Consumer
 * `opts.groups` / `opts.derived` append on top (e.g. argo's domain SERIES/ACTIVITY/USAGE).
 *
 * Dark is the default (`:root`) since the framework defaults to dark; the
 * `[data-mantine-color-scheme]` selectors track Mantine's toggle on `<html>`.
 */
export function buildPaletteCss(opts: BuildPaletteOpts = {}): string {
  const groups = opts.groups ?? {}
  const extraDerived = (opts.derived ?? []).map((d) => `  ${d}`).join('\n')
  const derived = extraDerived ? `${FRAMEWORK_DERIVED}\n${extraDerived}` : FRAMEWORK_DERIVED
  const side = (s: Side): string => {
    const extra = Object.entries(groups)
      .map(([prefix, map]) => groupSide(prefix, map, s))
      .join('\n')
    const framework = frameworkPrimitives(s)
    return extra ? `${framework}\n${extra}` : framework
  }
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
