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

import { ACCENT, BP, FILL, INK, NEUTRAL, p, SEMANTIC, SHADOW, STATUS, SURFACE } from './palette'

/** A per-theme color pair: a hue keeps its identity but shifts shade across schemes. */
export type ColorPair = { light: string; dark: string }

/** A map of token name → per-theme color pair (the input shape for series/group builders). */
export type SeriesMap = Record<string, ColorPair>

/** Framework palette data — Basalt families, the shade-pair helper, and the generic pairs. */
export { ACCENT, BP, FILL, INK, NEUTRAL, p, SEMANTIC, SHADOW, STATUS, SURFACE }

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
/**
 * The type scale — the ONE owned ladder, in px.
 *
 * Type is a token axis like color / spacing / radius / motion: a single edit point, never a
 * hardcoded literal at a call site. Every font-size in the framework resolves to a step here.
 *
 * Two representations are DERIVED from this one object, so they cannot drift:
 *  • `VX.text.*` — plain numbers, for inline `style` objects and visx SVG props (React appends
 *    `px`; SVG presentation attributes can't resolve `var()`, so a ref string would break charts).
 *  • `--vx-text-*` — the CSS-var form (`11px`, …), for CSS modules and the Mantine theme.
 *
 * The Mantine theme additionally re-expresses the ladder through Mantine's `rem()` (see
 * `theme/index.ts`), so the component surface scales with the user's browser font-size AND with
 * `--mantine-scale`. `md` is the body step; `lg` is pinned at exactly 16px because it doubles as
 * the iOS input floor (see the `styles.css` floor — Safari zooms the viewport on focus below 16px).
 */
const TEXT = {
  micro: 11, // mono uppercase micro-label (table th, Menu.Label, KPI label, axis ticks)
  xs: 12.5, // delta badges, tooltip meta, dense chrome
  sm: 13.5, // table/stat numerals, chart tooltip, legend
  md: 15, // BODY — nav rows, menu items, timeline, labels, prose
  lg: 16, // card titles, breadcrumb current — ALSO the iOS input floor (do not lower)
  xl: 18, // section titles
  kpi: 31, // the StatCard hero numeral
} as const

export const VX = {
  // Non-color sizing constants
  lineWidth: 2.5,
  line2Width: 2,
  axisFont: TEXT.micro,
  dotR: 5,
  // The ONE dashed pattern — plotted stroke, legend swatch, tooltip swatch all read this.
  dashArray: '6 4' as const,
  // Legend layout — replaces the hardcoded 18/13 in ChartLegend.
  legendGap: 22,
  legendFontSize: TEXT.sm,

  // The type scale (px numbers — see TEXT above). Use in inline styles and visx SVG props;
  // use `var(--vx-text-*)` in CSS modules.
  text: TEXT,

  // Single source for the card corner radius — shared by the Mantine-free ChartCard and the
  // Mantine chrome (Card/Paper resolve to this SAME token). One knob, so cards never diverge.
  radiusCard: 'var(--vx-radius-card)',
  // Single source for the control corner radius (inputs, search, buttons, segmented track).
  radiusCtrl: 'var(--vx-radius-ctrl)',

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

  // Ink text ramp (docs/DESIGN-SPEC.md §2) — primary/emphasis/secondary/tertiary body text.
  ink: 'var(--vx-ink)',
  ink2: 'var(--vx-ink2)',
  muted: 'var(--vx-muted)',
  faint: 'var(--vx-faint)',

  // The accent as INK — primary series, active-nav icon, links, focus rings. Read against the PAGE,
  // so it inverts across schemes (light on dark, deep on light).
  accent: 'var(--vx-accent)',
  accentHover: 'var(--vx-accentHover)',
  // The accent as SURFACE — a filled control that carries a label. Squeezed between white-text
  // contrast and page contrast, so it is the same hex in both schemes (see ACCENT in palette.ts).
  // Mantine's `--mantine-color-<primary>-filled` is bridged onto this, so it drives ALL filled
  // chrome; a raw `--vx-accent` fill would be unreadable on dark. Fills use THIS, never `accent`.
  accentFill: 'var(--vx-accentFill)',
  accentFillHover: 'var(--vx-accentFillHover)',
  onAccent: 'var(--vx-onAccent)',

  // Layout separators (header bottom rule, sidebar child indent) — distinct from `surface.border`.
  divider: 'var(--vx-divider)',

  // Depth shadows — a whisper shadow + a 1px ring baked into the value (never a `border` prop).
  shadowCard: 'var(--vx-shadow-card)',
  shadowCtrl: 'var(--vx-shadow-ctrl)',
  // Floating-layer elevation (menus, popovers, tooltips, modals, drawers) — a real drop shadow.
  shadowOverlay: 'var(--vx-shadow-overlay)',

  // App surfaces (cards, borders) — shared with the Mantine chrome
  surface: {
    bg: 'var(--vx-surface-bg)',
    panel: 'var(--vx-surface-panel)',
    panelHover: 'var(--vx-surface-panelHover)',
    elevated: 'var(--vx-surface-elevated)',
    subtle: 'var(--vx-surface-subtle)',
    overlay: 'var(--vx-surface-overlay)', // floating layer (menus, popovers, modals, drawers)
    field: 'var(--vx-surface-field)', // input field surface (slightly inset on a panel)
    border: 'var(--vx-surface-border)', // "line" — strong border
    hairline: 'var(--vx-surface-hairline)', // card ring only
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
  const ink = INK
  const ac = ACCENT
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
    decl('legendText', side === 'dark' ? 'rgba(255,255,255,0.92)' : 'rgba(38,38,38,0.82)'),
    decl('ink', ink.ink[side]),
    decl('ink2', ink.ink2[side]),
    decl('muted', ink.muted[side]),
    decl('faint', ink.faint[side]),
    decl('accent', ac.accent[side]),
    decl('accentHover', ac.accentHover[side]),
    decl('accentFill', ac.accentFill[side]),
    decl('accentFillHover', ac.accentFillHover[side]),
    decl('onAccent', ac.onAccent[side]),
    decl('divider', su.divider[side]),
    decl('shadow-card', SHADOW.card[side]),
    decl('shadow-ctrl', SHADOW.ctrl[side]),
    decl('shadow-overlay', SHADOW.overlay[side]),
    decl('surface-bg', su.bg[side]),
    decl('surface-panel', su.panel[side]),
    decl('surface-panelHover', su.panelHover[side]),
    decl('surface-elevated', su.elevated[side]),
    decl('surface-subtle', su.subtle[side]),
    decl('surface-overlay', su.overlay[side]),
    decl('surface-field', su.field[side]),
    decl('surface-border', su.border[side]),
    decl('surface-hairline', su.hairline[side]),
  ].join('\n')
}

/**
 * Theme-independent scalars + semantic fills, defined once on `:root`.
 *
 * Area-gradient strength is a global knob (the theme lab overrides these two on `:root`
 * to retune every line-area fill live). 0%/0% disables gradients app-wide.
 */
const FRAMEWORK_DERIVED = [
  decl('radius-card', '10px'),
  decl('radius-ctrl', '8px'),
  // The fill band (see FILL in palette.ts). Emitted on `:root`, NOT per scheme — a filled surface
  // is the same hex in both, which is the whole point: it is squeezed between its white label and
  // the page behind it, and only one luminance band satisfies both on both pages.
  ...Object.entries(FILL).map(([name, hex]) => decl(`fill-${name}`, hex)),
  // Hover is DERIVED from the fill, so retuning a fill (in the theme lab, or here) carries its
  // hover along instead of leaving a stale pair. 88% of the fill over black lands ~0.128 luminance:
  // a visible press-darkening that still clears AA for the white label (~5.9:1).
  ...Object.keys(FILL).map((name) =>
    decl(`fillHover-${name}`, `color-mix(in srgb, var(--vx-fill-${name}) 88%, #000)`),
  ),
  // The type scale, emitted from the SAME `TEXT` object `VX.text` reads — CSS modules and the
  // Mantine theme consume these; inline styles / visx read the numbers. One ladder, two forms.
  ...Object.entries(TEXT).map(([step, px]) => decl(`text-${step}`, `${px}px`)),
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
 *
 * Returns an exact-keyed object: the return type mirrors the keys of the input map, so a renamed
 * or removed key becomes a tsc error rather than silently widening to `Record<string, string>`.
 */
export function seriesTokens<const T extends SeriesMap>(
  map: T,
  prefix = '',
): { [K in keyof T]: string } {
  const out = {} as { [K in keyof T]: string }
  for (const key of Object.keys(map) as (keyof T)[]) out[key] = `var(--vx-${prefix}${String(key)})`
  return out
}

/**
 * Define a named series map. Identity passthrough — gives consumers a typed authoring entry
 * point and preserves the exact literal keys of the input (const-generic so callers get back T,
 * not the widened SeriesMap, enabling downstream exact-key checks in groupTokens / seriesTokens).
 */
export function defineSeries<const T extends SeriesMap>(map: T): T {
  return map
}

/**
 * Build a single namespaced group's token refs (`var(--vx-<name>-<key>)`).
 *
 * Returns an exact-keyed object matching the keys of `map` — a stale or renamed key is a tsc
 * error at the call site rather than a silent `Record<string, string>` widening.
 */
export function groupTokens<const T extends SeriesMap>(
  name: string,
  map: T,
): { [K in keyof T]: string } {
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
