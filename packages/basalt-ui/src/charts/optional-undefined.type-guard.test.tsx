/**
 * Under `exactOptionalPropertyTypes` a caller writes `empty: cond ? msg : undefined`, not
 * `cond ? msg : false`: every optional public prop of every chart kind accepts an explicit
 * `undefined`. `Strict<T>` names the optional keys that do not; each public object type must have
 * none, so a new optional without `| undefined` is a compile error in this file.
 */
import { expect, test } from 'bun:test'
import type { BandSpan, BandStripProps, BandStripSeries, BandFold } from './BandStrip'
import type { BarsBar, BarsLine, BarsProps } from './Bars'
import type { ChartCardProps } from './ChartCard'
import type { DonutProps } from './Donut'
import type { DualPanelBar, DualPanelLine, DualPanelProps } from './DualPanel'
import type { HeatmapProps } from './Heatmap'
import type { MirroredBarPane, MirroredBarsProps, MirroredBarsSeries } from './MirroredBars'
import type { SparklineProps } from './Sparkline'
import type { StackedAreaBand, StackedAreaProps } from './StackedArea'
import { resolveChartState } from './state'
import type {
  AxisConfig,
  CartesianChartProps,
  ChartLegendConfig,
  ChartSeries,
  ChartState,
  ChartTooltipConfig,
  RefLine,
  XZoneSpec,
  ZoneSpec,
} from './types'

/** Optional keys of `T` that reject an explicit `undefined`. */
type Strict<T> = {
  [K in keyof T]-?: {} extends Pick<T, K>
    ? { [P in K]?: undefined } extends Pick<T, K>
      ? never
      : K
    : never
}[keyof T]

type Row = { t: Date; v: number }
type Present<T> = Exclude<NonNullable<T>, false | ((...args: never[]) => unknown)>
type Ok<T extends never> = T

// One entry per public object type with optional members; `never` means every optional is safe.
export type Checked = [
  Ok<Strict<ChartState>>,
  Ok<Strict<ChartSeries<Row>>>,
  Ok<Strict<NonNullable<ReturnType<NonNullable<ChartSeries<Row>['getMarker']>>>>>,
  Ok<Strict<AxisConfig<Row>>>,
  Ok<Strict<ZoneSpec>>,
  Ok<Strict<XZoneSpec>>,
  Ok<Strict<RefLine>>,
  Ok<Strict<ChartTooltipConfig<Row>>>,
  Ok<Strict<ChartLegendConfig>>,
  Ok<Strict<CartesianChartProps<Row, Date>>>,
  Ok<Strict<SparklineProps>>,
  Ok<Strict<BarsBar<Row>>>,
  Ok<Strict<BarsLine<Row>>>,
  Ok<Strict<BarsProps<Row, Date>>>,
  Ok<Strict<DonutProps>>,
  Ok<Strict<HeatmapProps<Row>>>,
  Ok<Strict<Present<HeatmapProps<Row>['legend']>>>,
  Ok<Strict<Present<HeatmapProps<Row>['tooltip']>>>,
  Ok<Strict<StackedAreaBand<Row>>>,
  Ok<Strict<StackedAreaProps<Row, Date>>>,
  Ok<Strict<BandStripSeries<Row>>>,
  Ok<Strict<BandSpan>>,
  Ok<Strict<NonNullable<BandSpan['marker']>>>,
  Ok<Strict<BandFold<Row>>>,
  Ok<Strict<BandStripProps<Row, Date>>>,
  Ok<Strict<DualPanelLine<Row>>>,
  Ok<Strict<DualPanelBar<Row>>>,
  Ok<Strict<DualPanelProps<Row, Date>>>,
  Ok<Strict<NonNullable<DualPanelProps<Row, Date>['top']>>>,
  Ok<Strict<NonNullable<DualPanelProps<Row, Date>['fillBetween']>>>,
  Ok<Strict<MirroredBarPane>>,
  Ok<Strict<MirroredBarsSeries<Row>>>,
  Ok<Strict<MirroredBarsProps<Row, Date>>>,
  Ok<Strict<NonNullable<MirroredBarsProps<Row, Date>['fold']>>>,
  Ok<Strict<ChartCardProps>>,
]

// The guard must bite: a deliberately strict type is reported.
type Bad = { a?: string }
type GuardBites = Strict<Bad> extends 'a' ? true : false
export const guardBites: GuardBites = true

test('an explicit-undefined state resolves to nothing to draw', () => {
  const state: ChartState = { pending: undefined, error: undefined, empty: undefined }
  expect(resolveChartState(state)).toBeNull()
})
