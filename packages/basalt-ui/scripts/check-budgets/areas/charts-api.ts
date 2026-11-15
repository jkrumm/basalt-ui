/**
 * Area: charts-api — the `./charts` value-export list, frozen by v3-freeze-g4 (docs/v3/
 * ARCHITECTURE.md section 3: 12 symbols, a thirteenth is red). `ALLOWED` is the frozen set (the
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
  'ChartCard',
  'defineSeries',
  'chartCursor',
  'useChartFocus',
  'chartLabels',
]

/**
 * 2.x value exports the teardown removes. Shrinks only: do not add a name here. `LegacyChartCard` is
 * the one rename, not an addition: the 2.x card left the frozen `ChartCard` name for the v3 card
 * (v3-state-1-wiring) and stays reachable under this name until v3-teardown-views deletes it.
 */
export const LEGACY: readonly string[] = [
  'LegacyChartCard',
  'Donut',
  'DualPanel',
  'MirroredBars',
  'StackedArea',
  'chartCurve',
  'foldBands',
]

/** One line per value export in neither the frozen set nor the legacy list. */
export function chartsApiViolations(names: readonly string[]): string[] {
  return names
    .filter((name) => !ALLOWED.includes(name) && !LEGACY.includes(name))
    .map((name) => `./charts exports \`${name}\`, outside the 12 frozen symbols`)
}

export const rows: readonly RowDef[] = [
  {
    id: 'charts-api',
    order: 23,
    label: 'charts value exports outside the frozen 12 (and the 2.x legacy list)',
    ceiling: 0,
    measure: () => gate(chartsApiViolations(readSurface()[CHART_SUBPATH] ?? [])),
  },
]
