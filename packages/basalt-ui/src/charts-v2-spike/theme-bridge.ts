import type { ChartTheme } from '@tanstack/charts/types/core'

/**
 * The `--vx-*` → TanStack Charts bridge. Two halves, both CSS-variable references so a scheme
 * switch repaints without rebuilding a definition:
 *  - `CHART_THEME` goes into every definition's `theme` (scene paints: axes, grid, focus ring).
 *  - `CHART_HOST_VARS` sits on the host element (`--ts-chart-*`: palette, tooltip, crosshair).
 */
export const CHART_THEME: Partial<ChartTheme> = {
  foreground: 'var(--vx-axis)',
  muted: 'var(--vx-muted)',
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

export const CHART_HOST_VARS: Record<`--ts-chart-${string}`, string> = {
  '--ts-chart-1': 'var(--vx-line)',
  '--ts-chart-2': 'var(--vx-accent)',
  '--ts-chart-3': 'var(--vx-fill-cyan)',
  '--ts-chart-4': 'var(--vx-fill-orange)',
  '--ts-chart-5': 'var(--vx-fill-grape)',
  '--ts-chart-6': 'var(--vx-fill-lime)',
  '--ts-chart-tooltip-background': 'var(--vx-tooltip-bg)',
  '--ts-chart-tooltip-color': 'var(--vx-ink)',
  '--ts-chart-tooltip-border': '1px solid var(--vx-surface-border)',
  '--ts-chart-tooltip-border-radius': 'var(--vx-radius-ctrl)',
  '--ts-chart-tooltip-shadow': 'var(--vx-shadow-overlay)',
  '--ts-chart-crosshair-label-halo': 'var(--vx-surface-panel)',
  '--ts-chart-crosshair-marker-fill': 'var(--vx-surface-panel)',
  '--ts-chart-focus-fill': 'var(--vx-surface-panel)',
}
