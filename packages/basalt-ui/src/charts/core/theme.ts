/**
 * The `--basalt-*` → TanStack Charts bridge (`docs/v3/concepts/charts-cards-kanban.md`). Every value is a
 * name `css/tokens.css` defines, so a consumer that loads only the v3 token sheet paints the chart
 * layer; `theme.test.ts` holds that. Two halves, both CSS-variable references, so a scheme switch
 * repaints without rebuilding a definition:
 *
 *  - `CHART_THEME` goes into every definition's `theme` (scene paint: guides, grid, focus ring).
 *  - `CHART_ENGINE_VARS` (`--ts-chart-*`: palette, tooltip, crosshair halo) is one `:root` block
 *    (`chartEngineCss`) inside `styles.css`. Not on the host element: the tooltip portal's fallback
 *    reparents the tooltip under `<body>`, out of the host's inheritance.
 */
import type { ChartTheme } from '@tanstack/charts/types/core'
import { BASALT } from '../../tokens'

/**
 * The chart layer's color roles, each one v3 token. The 2.x `BASALT` names this replaces (`axis`,
 * `ink2`, `surface.panel`, `neutral`, `status.*`, the `*-solid`/`*-ref`/`*-soft` fills) are not in
 * the v3 sheet; a chart file reads a role from here, never the 2.x name.
 */
export const CV = {
  ink: 'var(--basalt-ink)',
  inkMuted: 'var(--basalt-ink-muted)',
  /** Axis labels, tick text and the axis line: `ink-faint`, the quietest ink that holds 4.5:1. */
  axis: 'var(--basalt-ink-faint)',
  grid: 'var(--basalt-grid)',
  crosshair: 'var(--basalt-crosshair)',
  line: 'var(--basalt-line)',
  brand: 'var(--basalt-brand)',
  /** The surface a chart sits on: a card's. A halo, a marker ring and a ghost baseline mix with it. */
  surface: 'var(--basalt-card)',
  inset: 'var(--basalt-inset)',
  raised: 'var(--basalt-raised)',
  hairline: 'var(--basalt-hairline)',
  /** No-data and unknown cells: the neutral line ink; callers thin it with `alpha`. */
  neutral: 'var(--basalt-line)',
  good: 'var(--basalt-good)',
  warn: 'var(--basalt-warn)',
  bad: 'var(--basalt-bad)',
} as const

/** The status tones a heatmap state or a band can name, as the v3 status inks. */
export const CV_STATUS = {
  excellent: CV.good,
  good: CV.good,
  warn: CV.warn,
  bad: CV.bad,
  neutral: CV.neutral,
} as const

/** The two stops of an area's vertical fade, as the share of the series color kept. */
export const AREA_TOP = '22%'
export const AREA_BOTTOM = '1%'

export const CHART_THEME: Partial<ChartTheme> = {
  foreground: CV.inkMuted,
  muted: CV.axis,
  grid: CV.grid,
  background: 'transparent',
  palette: [
    'var(--ts-chart-1)',
    'var(--ts-chart-2)',
    'var(--ts-chart-3)',
    'var(--ts-chart-4)',
    'var(--ts-chart-5)',
  ],
}

export const CHART_ENGINE_VARS: Readonly<Record<`--ts-chart-${string}`, string>> = {
  '--ts-chart-1': 'var(--basalt-chart-1)',
  '--ts-chart-2': 'var(--basalt-chart-2)',
  '--ts-chart-3': 'var(--basalt-chart-3)',
  '--ts-chart-4': 'var(--basalt-chart-4)',
  '--ts-chart-5': 'var(--basalt-chart-5)',
  '--ts-chart-tooltip-background': 'var(--basalt-raised)',
  '--ts-chart-tooltip-color': 'var(--basalt-ink)',
  '--ts-chart-tooltip-border': 'var(--basalt-hairline)',
  '--ts-chart-tooltip-shadow': 'var(--basalt-shadow-overlay)',
  '--ts-chart-tooltip-border-radius': 'var(--basalt-radius-ctrl)',
  '--ts-chart-crosshair-label-halo': 'var(--basalt-card)',
  '--ts-chart-crosshair-marker-fill': 'var(--basalt-card)',
  '--ts-chart-focus-fill': 'var(--basalt-card)',
}

/**
 * The charts layer's stylesheet block: one `:root` rule. `styles.css` carries the same declarations
 * (formatter-laid-out) between two generated markers — `scripts/gen-chart-css.ts` writes them from this
 * function's output and `--check` (run by `build`) fails on drift — so the source tree a Vite alias
 * or the layout fixture serves and the published `dist/styles.css` agree.
 */
export function chartEngineCss(): string {
  const decls = Object.entries(CHART_ENGINE_VARS).map(([name, value]) => `${name}:${value}`)
  return `:root{${decls.join(';')}}`
}

/** Guide paint every definition shares — the tokens are pre-mixed, so nothing dilutes them. */
export const AXIS_LINE = { stroke: CV.axis, strokeOpacity: 1 } as const
export const GRID_LINE = { strokeDasharray: '2 3', strokeOpacity: 1 } as const
export const CROSSHAIR = { stroke: CV.crosshair, strokeOpacity: 1, strokeDasharray: '3 3' } as const
export const DASH = BASALT.dashArray
/** The default plotted stroke: the redesign's 1.9px line overlay. */
export const LINE_STROKE_WIDTH = 1.9
/**
 * The opacity of the rest while another datum or legend entry holds the focus: one value for every
 * v3 kind and for a mark a page draws through the seam (`[data-chart-mark][data-dimmed]` in
 * `css/tailwind.css` carries the same number). At 0.5 the ink of a dimmed row still clears 3:1 on
 * the inset in both schemes; 0.25 left it at 1.7:1 (owner calibration, expression cycle 2).
 */
export const DIMMED = 0.5
/**
 * The same for a mark that carries text, a row linked to the chart (`[data-chart-mark][data-dimmed]`
 * outside an svg): ink at this opacity clears the 4.5:1 the inks are gated at, on the canvas, the
 * card and the inset in both schemes (0.5 gave 3.8:1 on the dark card).
 */
export const DIMMED_TEXT = 0.7
