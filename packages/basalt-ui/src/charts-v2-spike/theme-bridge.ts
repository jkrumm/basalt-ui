import type { ChartTheme } from '@tanstack/charts/types/core'

/**
 * The `--vx-*` → TanStack Charts bridge. Two halves, both CSS-variable references so a scheme
 * switch repaints without rebuilding a definition:
 *  - `CHART_THEME` goes into every definition's `theme` (scene paints: axes, grid, focus ring).
 *  - `CHART_ENGINE_VARS` (`--ts-chart-*`: palette, tooltip, crosshair) is emitted by the CHARTS
 *    layer as one `:root` block (`chartEngineCss`). Not on the host element: the tooltip portal's
 *    fallback reparents the tooltip under `body`, out of the host's inheritance. Not in
 *    `buildPaletteCss`: that emitter stays engine-agnostic.
 */
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

export const CHART_ENGINE_VARS: Record<`--ts-chart-${string}`, string> = {
  '--ts-chart-1': 'var(--vx-line)',
  '--ts-chart-2': 'var(--vx-accent)',
  '--ts-chart-3': 'var(--vx-fill-cyan)',
  '--ts-chart-4': 'var(--vx-fill-orange)',
  '--ts-chart-5': 'var(--vx-fill-grape)',
  '--ts-chart-6': 'var(--vx-fill-lime)',
  '--ts-chart-tooltip-background': 'var(--vx-tooltip-bg)',
  '--ts-chart-tooltip-color': 'var(--vx-tooltip-text)',
  '--ts-chart-tooltip-border': 'var(--vx-tooltip-border)',
  '--ts-chart-tooltip-border-radius': 'var(--vx-radius-ctrl)',
  '--ts-chart-tooltip-shadow': 'var(--vx-tooltip-shadow)',
  '--ts-chart-crosshair-label-halo': 'var(--vx-surface-panel)',
  '--ts-chart-crosshair-marker-fill': 'var(--vx-surface-panel)',
  '--ts-chart-focus-fill': 'var(--vx-surface-panel)',
}

/** The charts layer's stylesheet block; the build appends it to `styles.css`. */
export function chartEngineCss(): string {
  const decls = Object.entries(CHART_ENGINE_VARS).map(([k, v]) => `${k}:${v}`)
  return `:root{${decls.join(';')}}`
}
