/**
 * `StackedArea` — n area bands stacked bottom-to-top in `series` order over the rung
 * (`docs/V2-SPEC.md` § 9.3). A band's keys and colors are plain `series` data, so a dynamic group
 * set is the caller mapping its groups to entries. The y domain is the visible stack total, so a
 * legend toggle shrinks the axis; the tooltip lists the top band first, matching the plot.
 *
 * A band whose every value is `0` is skipped (no band, no legend entry, no tooltip row); `null` is a
 * gap, not a zero, and stays.
 *
 * A stack is only as dense as its sparsest band: a row where ANY visible band is `null` has no
 * total, so every band gaps across it. Reading it as `0` would claim a measured zero.
 */
import { areaY } from '@tanstack/charts/area'
import { stack } from '@tanstack/charts/stack'
import { useCallback, useMemo } from 'react'
import type { ReactElement } from 'react'
import { CartesianRung } from './CartesianChart'
import { chartCurve } from './curves'
import { emphasis } from './marks'
import { rowX } from './types'
import type { CartesianChartProps, ChartMarks, ChartSeries, ChartX, PlotContext } from './types'

const DEFAULT_BAND_OPACITY = 0.85

/** A band. Stacked areas read the left axis and draw no line, so the line fields are absent. */
export type StackedAreaBand<T> = Pick<
  ChartSeries<T>,
  'key' | 'label' | 'color' | 'getValue' | 'formatValue' | 'tooltip' | 'legend' | 'role' | 'note'
> & {
  /** Default: the chart's `fillOpacity` (0.85). */
  fillOpacity?: number | undefined
}

export type StackedAreaProps<T, X extends ChartX = ChartX> = Omit<
  CartesianChartProps<T, X>,
  'marks' | 'y' | 'y2' | 'series'
> & {
  /** The bands, bottom to top. */
  series: readonly StackedAreaBand<T>[]
  /** Every band's fill opacity, 0–1 (default 0.85: full-opacity bands read saturated). A band's own
   * `fillOpacity` wins. The legend swatch wears the same shade. */
  fillOpacity?: number | undefined
  /** No `scale`: a log axis has no additive zero to stack from. */
  y?: Omit<NonNullable<CartesianChartProps<T, X>['y']>, 'scale'> | undefined
}

export function StackedArea<T, X extends ChartX = ChartX>(
  props: StackedAreaProps<T, X>,
): ReactElement {
  const { series: given, fillOpacity, ...rest } = props
  // A band whose every value is 0 draws nothing but a legend entry that names an empty layer: skip it.
  const bands = useMemo(
    () =>
      rest.data.length === 0
        ? given
        : given.filter((b) => !rest.data.every((d) => b.getValue(d) === 0)),
    [given, rest.data],
  )
  // `mark: 'bar'` is what the rung sums for the auto domain, and the legend/tooltip swatch.
  const series = useMemo<ChartSeries<T>[]>(
    () =>
      bands.map((s) => ({
        ...s,
        mark: 'bar' as const,
        ...((s.fillOpacity ?? fillOpacity) !== undefined && {
          fillOpacity: s.fillOpacity ?? fillOpacity,
        }),
      })),
    [bands, fillOpacity],
  )

  const marks = useCallback((plot: PlotContext<T, X>): ChartMarks => {
    const visible = plot.visible
    if (visible.length === 0) return []
    const byKey = new Map(visible.map((s) => [s.key, s]))
    const h = plot.highlighted
    const columns = visible.map((s) => plot.rows(s.key))
    // A row is dense when every visible band has a value there; one pass over the columns.
    const dense = columns[0]?.map((_, i) => columns.every((col) => col[i]?.y !== null)) ?? []
    const rows = columns.flatMap((col) => col.map((r, i) => (dense[i] ? r : { ...r, y: null })))
    return [
      areaY(rows, {
        id: 'bands',
        x: rowX,
        y: 'y',
        z: 'series',
        fill: (r) => {
          const s = byKey.get(r.series)
          if (!s) return 'transparent'
          const pct = Math.round((s.fillOpacity ?? DEFAULT_BAND_OPACITY) * emphasis(h, s) * 100)
          return `color-mix(in srgb, ${s.color} ${pct}%, transparent)`
        },
        fillOpacity: 1,
        curve: chartCurve('monotone'),
        layout: stack({ order: visible.map((s) => s.key) }),
      }),
    ]
  }, [])

  return <CartesianRung {...rest} series={series} marks={marks} reverseRows stack="stacked" />
}
