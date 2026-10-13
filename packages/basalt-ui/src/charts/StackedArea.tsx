/**
 * `StackedArea` — n area bands stacked bottom-to-top in `series` order over the rung
 * (`docs/V2-SPEC.md` § 9.3). A band's keys and colors are plain `series` data, so a dynamic group
 * set is the caller mapping its groups to entries. The y domain is the visible stack total, so a
 * legend toggle shrinks the axis; the tooltip lists the top band first, matching the plot.
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

export type StackedAreaProps<T, X extends ChartX = ChartX> = Omit<
  CartesianChartProps<T, X>,
  'marks' | 'y2' | 'series'
> & {
  /** The bands, bottom to top. Linear y only: a log axis has no additive zero to stack from. */
  series: readonly ChartSeries<T>[]
  y?: Omit<NonNullable<CartesianChartProps<T, X>['y']>, 'scale'>
}

export function StackedArea<T, X extends ChartX = ChartX>(
  props: StackedAreaProps<T, X>,
): ReactElement {
  const { series: bands, ...rest } = props
  // `mark: 'bar'` is what the rung sums for the auto domain, and the legend/tooltip swatch.
  const series = useMemo<ChartSeries<T>[]>(
    () => bands.map((s) => ({ ...s, mark: 'bar' as const })),
    [bands],
  )

  const marks = useCallback((plot: PlotContext<T, X>): ChartMarks => {
    const visible = plot.visible
    if (visible.length === 0) return []
    const byKey = new Map(visible.map((s) => [s.key, s]))
    const h = plot.highlighted
    const dense = (i: number): boolean =>
      visible.every((s) => (plot.rows(s.key)[i]?.y ?? null) !== null)
    const rows = visible.flatMap((s) =>
      plot.rows(s.key).map((r, i) => (dense(i) ? r : { ...r, y: null })),
    )
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
