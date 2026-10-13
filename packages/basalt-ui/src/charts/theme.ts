/**
 * The `--vx-*` → TanStack Charts bridge (`docs/V2-SPEC.md` § 9.5). Two halves, both CSS-variable
 * references, so a scheme switch repaints without rebuilding a definition:
 *
 *  - `CHART_THEME` goes into every definition's `theme` (scene paint: guides, grid, focus ring).
 *  - `CHART_ENGINE_VARS` (`--ts-chart-*`: palette, tooltip, crosshair halo) is one `:root` block
 *    (`chartEngineCss`) inside `styles.css`. Not on the host element: the tooltip portal's fallback
 *    reparents the tooltip under `<body>`, out of the host's inheritance. Not in `buildPaletteCss`:
 *    that emitter stays engine-agnostic.
 */
import type { ChartTheme } from '@tanstack/charts/types/core'
import { VX } from '../tokens'

export const CHART_THEME: Partial<ChartTheme> = {
  foreground: 'var(--vx-ink2)',
  muted: 'var(--vx-axis)',
  grid: 'var(--vx-grid)',
  background: 'transparent',
  palette: [
    'var(--ts-chart-1)',
    'var(--ts-chart-2)',
    'var(--ts-chart-3)',
    'var(--ts-chart-4)',
    'var(--ts-chart-5)',
    'var(--ts-chart-6)',
  ],
}

export const CHART_ENGINE_VARS: Readonly<Record<`--ts-chart-${string}`, string>> = {
  '--ts-chart-1': 'var(--vx-line)',
  '--ts-chart-2': 'var(--vx-accent)',
  '--ts-chart-3': 'var(--vx-fill-cyan)',
  '--ts-chart-4': 'var(--vx-fill-orange)',
  '--ts-chart-5': 'var(--vx-fill-grape)',
  '--ts-chart-6': 'var(--vx-fill-lime)',
  '--ts-chart-tooltip-background': 'var(--vx-tooltip-bg)',
  '--ts-chart-tooltip-color': 'var(--vx-tooltip-text)',
  '--ts-chart-tooltip-border': 'var(--vx-tooltip-border)',
  '--ts-chart-tooltip-shadow': 'var(--vx-tooltip-shadow)',
  '--ts-chart-tooltip-border-radius': 'var(--vx-radius-ctrl)',
  '--ts-chart-crosshair-label-halo': 'var(--vx-surface-panel)',
  '--ts-chart-crosshair-marker-fill': 'var(--vx-surface-panel)',
  '--ts-chart-focus-fill': 'var(--vx-surface-panel)',
}

/**
 * The charts layer's stylesheet block: one `:root` rule. `styles.css` carries it verbatim between two
 * generated markers (`scripts/gen-chart-css.ts` writes them, `theme.test.ts` fails on drift), so the
 * source tree a Vite alias or the layout fixture serves and the published `dist/styles.css` agree.
 */
export function chartEngineCss(): string {
  const decls = Object.entries(CHART_ENGINE_VARS).map(([name, value]) => `${name}:${value}`)
  return `:root{${decls.join(';')}}`
}

/** Guide paint every definition shares — the tokens are pre-mixed, so nothing dilutes them. */
export const AXIS_LINE = { stroke: VX.axisStroke, strokeOpacity: 1 } as const
export const GRID_LINE = { strokeDasharray: '2 3', strokeOpacity: 1 } as const
export const CROSSHAIR = { stroke: VX.crosshair, strokeOpacity: 1, strokeDasharray: '3 3' } as const
export const DASH = VX.dashArray
