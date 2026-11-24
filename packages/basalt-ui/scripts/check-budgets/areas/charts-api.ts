/**
 * Area: charts-api — the `./charts` value-export list, frozen by v3-freeze-g4 (docs/v3/
 * ARCHITECTURE.md section 3: 12 symbols), amended to 13 by Issue 2306 for `IntervalTrack` (the owner
 * review's interval track, Spec verdict looks good on 2026-11-18), and back to 12 when the unused
 * `defineSeries` name left with the series register; a thirteenth is red. `ALLOWED` is the frozen set (the
 * geometry seam's `useChartFocus` and `chartLabels` included). `LEGACY` is the 2.x kinds still in
 * `src/charts` until v3-teardown-views deletes them: tolerated, never added to, never new. A name in
 * neither list is a violation, so the 13th value export fails the row on the day it lands.
 */
import { CHART_SUBPATH } from '../../surface-gates'
import { gate, readSurface } from '../lib'
import type { RowDef } from '../lib'

export const ALLOWED: readonly string[] = [
  'CartesianChart',
  'Lines',
  'Bars',
  'Sparkline',
  'MiniBars',
  'Heatmap',
  'BandStrip',
  'IntervalTrack',
  'ChartCard',
  'chartCursor',
  'useChartFocus',
  'chartLabels',
]

/** 2.x value exports the teardown removed: none remain, and none may return. */
export const LEGACY: readonly string[] = []

/** One line per value export in neither the frozen set nor the legacy list. */
export function chartsApiViolations(names: readonly string[]): string[] {
  return names
    .filter((name) => !ALLOWED.includes(name) && !LEGACY.includes(name))
    .map((name) => `./charts exports \`${name}\`, outside the 13 frozen symbols`)
}

export const rows: readonly RowDef[] = [
  {
    id: 'charts-api',
    order: 23,
    label: 'charts value exports outside the frozen 13 (and the 2.x legacy list)',
    ceiling: 0,
    measure: () => gate(chartsApiViolations(readSurface()[CHART_SUBPATH] ?? [])),
  },
]
