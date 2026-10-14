/**
 * Under `exactOptionalPropertyTypes` a caller writes `empty: cond ? msg : undefined`, not
 * `cond ? msg : false`: every optional public prop of the chart kinds accepts an explicit
 * `undefined`. Compile-time facts; the runtime assertion only keeps the file a test.
 */
import { expect, test } from 'bun:test'
import { resolveChartState } from './state'
import type { AxisConfig, CartesianChartProps, ChartSeries, ChartState } from './types'
import type { SparklineProps } from './Sparkline'

type Row = { t: Date; v: number }

export const state: ChartState = { pending: undefined, error: undefined, empty: undefined }

export const series: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'var(--vx-line)',
  getValue: (d) => d.v,
  mark: undefined,
  dash: undefined,
  curve: undefined,
  strokeWidth: undefined,
  strokeOpacity: undefined,
  fillOpacity: undefined,
  area: undefined,
  axis: undefined,
  role: undefined,
  legend: undefined,
  tooltip: undefined,
  parent: undefined,
  note: undefined,
  formatValue: undefined,
  getMarker: undefined,
}

export const axis: AxisConfig<Row> = {
  domain: undefined,
  autoMaxFloor: undefined,
  autoMinCeil: undefined,
  autoPad: undefined,
  ticks: undefined,
  format: undefined,
  grid: undefined,
  nice: undefined,
  scale: undefined,
}

export const cartesian: Omit<CartesianChartProps<Row, Date>, 'marks'> = {
  ariaLabel: 'C',
  data: [],
  x: (d) => d.t,
  series: [series],
  y: undefined,
  y2: undefined,
  xTicks: undefined,
  formatX: undefined,
  zones: undefined,
  xZones: undefined,
  refLines: undefined,
  legend: undefined,
  height: undefined,
  state: undefined,
  cursorGroup: undefined,
  cursorResolution: undefined,
  tooltip: undefined,
}

export const sparkline: SparklineProps = {
  ariaLabel: 'S',
  data: [],
  height: 20,
  width: undefined,
  mark: undefined,
  color: undefined,
  emphasizeLast: undefined,
  emphasisColor: undefined,
  state: undefined,
}

test('an explicit-undefined state resolves to nothing to draw', () => {
  expect(resolveChartState(state)).toBeNull()
})
