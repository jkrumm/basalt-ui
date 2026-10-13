import { areaY, differenceY, lineY } from '@tanstack/charts'
import { decorative } from '@tanstack/charts/mark/decorative'
import { useId, useMemo } from 'react'
import { BasaltChart } from './BasaltChart'
import { cartesian } from './cartesian'
import type { CursorResolution } from './cursor'
import type {
  AxisSpec,
  ChartTooltipConfig,
  CartesianDefinition,
  CartesianRow,
  RefLine,
  Series,
  YZone,
} from './cartesian'

export type ZonedLineThreshold = { value: number; side: 'above' | 'below'; fill: string }

export type ZonedLineProps<T> = {
  data: readonly T[]
  x: (d: T) => Date
  series: Series<T>
  ariaLabel: string
  y?: AxisSpec
  zones?: readonly YZone[]
  thresholds?: readonly ZonedLineThreshold[]
  refLines?: readonly RefLine[]
  areaFill?: boolean
  formatX?: (d: Date) => string
  cursorGroup?: string
  cursorResolution?: CursorResolution
  tooltip?: ChartTooltipConfig<T>
  height?: number
}

const isValue = (r: CartesianRow<unknown>) => r.y !== null

/** Single-series line over y-zones, with one-sided threshold fills and an optional area. */
export function zonedLine<T>(
  p: Omit<ZonedLineProps<T>, 'ariaLabel' | 'height'>,
  chartId: string,
): CartesianDefinition<T> {
  return cartesian({
    chartId,
    data: p.data,
    x: p.x,
    series: [p.series],
    ...(p.y && { y: p.y }),
    ...(p.zones && { zones: p.zones }),
    ...(p.refLines && { refLines: p.refLines }),
    ...(p.formatX && { formatX: p.formatX }),
    ...(p.cursorGroup && { cursorGroup: p.cursorGroup }),
    ...(p.cursorResolution && { cursorResolution: p.cursorResolution }),
    ...(p.tooltip && { tooltip: p.tooltip }),
    marks: (plot) => {
      const pts = plot.rows(p.series.key)
      const fills = (p.thresholds ?? []).map((t, i) =>
        decorative(
          differenceY(pts.filter(isValue), {
            id: `threshold-${i}`,
            x: 'x',
            y1: t.value,
            y2: 'y',
            positiveFill: t.side === 'above' ? t.fill : null,
            negativeFill: t.side === 'below' ? t.fill : null,
            fillOpacity: 1,
            stroke: 'none',
            comparisonStroke: 'none',
          }),
        ),
      )
      const area = p.areaFill
        ? [
            decorative(
              areaY(pts, { id: 'area', x: 'x', y: 'y', fill: p.series.color, fillOpacity: 0.12 }),
            ),
          ]
        : []
      return [
        ...fills,
        ...area,
        lineY(pts, {
          id: p.series.key,
          x: 'x',
          y: 'y',
          z: 'series',
          stroke: p.series.color,
          strokeWidth: 1.9,
          ...(p.series.dashed && { strokeDasharray: '6 4' }),
        }),
      ]
    },
  })
}

export function ZonedLine<T>({ ariaLabel, height, ...p }: ZonedLineProps<T>) {
  // Definition identity is TanStack's update boundary: rebuild only when a captured value changes.
  const {
    data,
    x,
    series,
    y,
    zones,
    thresholds,
    refLines,
    areaFill,
    formatX,
    cursorGroup,
    cursorResolution,
    tooltip,
  } = p
  const chartId = useId()
  const definition = useMemo(
    () => zonedLine(p, chartId),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `p` is the rest object; its fields are listed
    [
      data,
      x,
      series,
      y,
      zones,
      thresholds,
      refLines,
      areaFill,
      formatX,
      cursorGroup,
      cursorResolution,
      tooltip,
      chartId,
    ],
  )
  return <BasaltChart definition={definition} ariaLabel={ariaLabel} {...(height && { height })} />
}
