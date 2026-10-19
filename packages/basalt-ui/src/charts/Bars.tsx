/**
 * `Bars` — bar series on a band x scale (Date, number or string), stacked, grouped or normalized,
 * with line overlays on `y`/`y2` (`docs/V2-SPEC.md` § 9.3). A negative value draws below zero: a
 * stack diverges around the baseline (the 1.x `negativeBars`, now just a signed value). Zones,
 * reference lines, legend, cursor and tooltip are the rung's. In a visual slot (a `StatCard`
 * `sparkline`, a strip cell's `visual`) it drops both axes, the grid, the margin and the legend and
 * fills the slot like a `Sparkline`: a small histogram whose tooltip is the one-line chip
 * (`<value> · <x label>`) in the line the host reserves above the plot.
 */
import { barY } from '@tanstack/charts/bar'
import { dot } from '@tanstack/charts/dot'
import { group } from '@tanstack/charts/group'
import { stack } from '@tanstack/charts/stack'
import { useCallback, useContext, useMemo } from 'react'
import type { ReactElement } from 'react'
import { CartesianRung } from './CartesianChart'
import { VisualSlotContext } from '../dashboard/visual-slot'
import { VX } from '../tokens'
import { emphasis, lineMark } from './marks'
import { rowX } from './types'
import type {
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
  ChartX,
  PlotContext,
  PlotRow,
} from './types'

/** A bar series. Bars always read the left axis. */
export type BarsBar<T> = Pick<
  ChartSeries<T>,
  'key' | 'label' | 'color' | 'getValue' | 'formatValue' | 'tooltip' | 'legend' | 'role' | 'note'
> & {
  /** Default 0.85. */
  fillOpacity?: number | undefined
}

/** A line overlay; `axis: 'right'` reads the chart's `y2`. */
export type BarsLine<T> = Pick<
  ChartSeries<T>,
  | 'key'
  | 'label'
  | 'color'
  | 'getValue'
  | 'formatValue'
  | 'tooltip'
  | 'legend'
  | 'role'
  | 'note'
  | 'axis'
  | 'dash'
  | 'curve'
  | 'strokeWidth'
  | 'strokeOpacity'
>

export type BarsProps<T, X extends ChartX = ChartX> = Omit<
  CartesianChartProps<T, X>,
  'marks' | 'series'
> & {
  bars: readonly BarsBar<T>[]
  lines?: readonly BarsLine<T>[] | undefined
  /** Default `'stacked'`. `'normalized'` stacks each x to its share of the total. */
  layout?: 'stacked' | 'grouped' | 'normalized' | undefined
  /** Per-bar opacity (a partial week, an estimate, a shade per series). Overrides the series' `fillOpacity`; the legend swatch samples it on the first row. */
  barOpacity?: ((d: T, key: string) => number) | undefined
}

const DEFAULT_BAR_OPACITY = 0.85
/** The empty-bin marker's radius, px: the plot's floor clips it to a 2px-high tick. */
const EMPTY_BIN_R = 2
/** The faintest shade told-apart-by-shade series step down to. */
const SHADE_FLOOR = 0.4

/**
 * Series that share one colour and set no opacity of their own would draw identical bars. They step
 * down from full strength to `SHADE_FLOOR` in `bars` order (the first is the strongest), so the legend
 * swatches and the plot tell them apart by more than the label. A bar that sets `fillOpacity`, or a
 * chart with `barOpacity`, keeps its own shades.
 */
function shadeSharedColors<T>(
  bars: readonly BarsBar<T>[],
  barOpacity: BarsProps<T>['barOpacity'],
): readonly BarsBar<T>[] {
  if (barOpacity !== undefined) return bars
  return bars.map((b) => {
    const group = bars.filter((o) => o.color === b.color)
    if (group.length < 2 || group.some((g) => g.fillOpacity !== undefined)) return b
    const step = (1 - SHADE_FLOOR) / (group.length - 1)
    return { ...b, fillOpacity: 1 - group.indexOf(b) * step }
  })
}

const paint = (color: string, opacity: number): string =>
  opacity >= 1 ? color : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`

let warnedLogStack = false

/** A stack sums bar heights and a log axis has no additive zero to sum from (V2-SPEC § 9.9): dev
 * throws, production logs once and draws what it can. Lines-only and grouped charts are fine. */
function guardLogStack(layout: string, onLog: boolean): void {
  if (!onLog || layout === 'grouped') return
  const message = `Bars: ${layout} bars cannot use a log axis; use layout: 'grouped'`
  if (process.env.NODE_ENV !== 'production') throw new Error(message)
  // oxlint-disable-next-line no-console -- the production leg of a dev-only throw
  if (!warnedLogStack) console.error(message)
  warnedLogStack = true
}

/**
 * A slotted chart has no axes to name the hovered bin, and an empty bin has no bar to light: the
 * readout says `0 runs · 16 Oct 02:00` and nothing in the plot would mark where. Each bin whose
 * stack sums to zero gets a baseline mark (a half-dot on the plot's floor), hidden until that x is hovered (the same `focus: 'x'`
 * state that takes a drawn bar to full strength).
 */
function emptyBinTicks<T, X extends ChartX>(rows: readonly PlotRow<T, X>[]): ChartMarks {
  // A gap (`y: null` on every series) is an absence, not a zero: only a bin with a value counts.
  const sums = new Map<string, { row: PlotRow<T, X>; sum: number; values: number }>()
  for (const row of rows) {
    const key = String(row.x instanceof Date ? row.x.getTime() : row.x)
    const entry = sums.get(key) ?? { row, sum: 0, values: 0 }
    if (row.y !== null && Number.isFinite(row.y)) {
      entry.sum += Math.abs(row.y)
      entry.values += 1
    }
    sums.set(key, entry)
  }
  const empty = [...sums.values()].filter((e) => e.values > 0 && e.sum === 0).map((e) => e.row)
  if (empty.length === 0) return []
  return [
    dot(empty, {
      id: 'empty-bins',
      x: rowX,
      y: () => 0,
      r: EMPTY_BIN_R,
      fill: VX.muted,
      fillOpacity: 0,
      states: [{ when: { focus: 'x' }, style: { fillOpacity: 1 } }],
    }),
  ]
}

/** Whether the baseline (y = 0) is on the plot: not on a log axis, not in a domain that starts above it. */
function floorIsZero<T>(y: BarsProps<T>['y']): boolean {
  if (y?.scale === 'log') return false
  const domain = y?.domain
  if (Array.isArray(domain)) return domain[0] <= 0 && domain[1] >= 0
  if (typeof domain === 'function') return false
  return (y?.autoMinCeil ?? 0) <= 0
}

export function Bars<T, X extends ChartX = ChartX>(props: BarsProps<T, X>): ReactElement {
  const { bars: given, lines, layout = 'stacked', barOpacity, ...rest } = props
  const bars = useMemo(() => shadeSharedColors(given, barOpacity), [given, barOpacity])
  const sharedColor = bars.some((b, i) => bars.findIndex((o) => o.color === b.color) !== i)
  guardLogStack(layout, bars.length > 0 && rest.y?.scale === 'log')
  const sample = rest.data[0]
  const zeroFloor = floorIsZero(rest.y)
  const bare = useContext(VisualSlotContext) !== null
  const series = useMemo<ChartSeries<T>[]>(
    () => [
      // The legend has no datum: its swatch wears the shade the bars draw on the first row, so
      // per-bar shades (`barOpacity`) read the same in the legend as on the plot.
      ...bars.map((b) => ({
        ...b,
        mark: 'bar' as const,
        fillOpacity:
          (sample !== undefined ? barOpacity?.(sample, b.key) : undefined) ??
          b.fillOpacity ??
          DEFAULT_BAR_OPACITY,
      })),
      ...(lines ?? []).map((l) => ({ ...l, mark: 'line' as const })),
    ],
    [bars, lines, barOpacity, sample],
  )

  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const barKeys = new Set(bars.map((b) => b.key))
      const visibleBars = plot.visible.filter((s) => barKeys.has(s.key))
      const byKey = new Map(bars.map((b) => [b.key, b]))
      const rows = visibleBars.flatMap((s) => plot.rows(s.key))
      const h = plot.highlighted
      const solid = ({ datum }: { datum: PlotRow<T, X> }): string =>
        byKey.get(datum.series)?.color ?? 'transparent'
      const fill = (row: PlotRow<T, X>): string => {
        const bar = byKey.get(row.series)
        if (!bar) return 'transparent'
        const base = barOpacity?.(row.datum, row.series) ?? bar.fillOpacity ?? DEFAULT_BAR_OPACITY
        return paint(bar.color, base * emphasis(h, { key: row.series }))
      }
      const order = visibleBars.map((s) => s.key)
      const out: ChartMarks[number][] = []
      if (rows.length > 0)
        out.push(
          barY(rows, {
            id: 'bars',
            x: rowX,
            y: 'y',
            z: 'series',
            fill,
            // Series of one colour differ by shade alone: a surface hairline keeps stacked segments apart.
            ...(sharedColor &&
              layout !== 'grouped' && { stroke: VX.surface.panel, strokeWidth: 1 }),
            // The hovered x is its own highlight: the bar reads at full strength (no dimming, no
            // point marker, no crosshair rule: that is line-chart chrome; `focusRing={false}` on the rung).
            states: [{ when: { focus: 'x' }, style: { fill: solid } }],
            layout:
              layout === 'grouped'
                ? group({ padding: 0.1 })
                : stack({ order, ...(layout === 'normalized' && { offset: 'normalize' }) }),
          }),
        )
      if (bare && zeroFloor) out.push(...emptyBinTicks(rows))
      for (const s of plot.visible) {
        if (barKeys.has(s.key)) continue
        out.push(lineMark(plot, s))
      }
      return out
    },
    [bars, layout, barOpacity, sharedColor, bare, zeroFloor],
  )

  return (
    <CartesianRung
      {...rest}
      series={series}
      marks={marks}
      band
      crosshair={false}
      focusRing={false}
      reverseRows={layout !== 'grouped'}
      {...(bare && { bare, tooltipBelow: true, legend: false as const })}
      {...(layout !== 'grouped' && { stack: layout })}
    />
  )
}
