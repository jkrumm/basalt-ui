import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { AreaStack } from '@visx/shape'
import { memo, useMemo, useState } from 'react'
import { AxisBottomDate, AxisLeftNumeric } from '../primitives/Axes'
import {
  ChartTooltip,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
  useTooltipStyles,
} from '../primitives/ChartTooltip'
import { ChartFrame, resolveLegend } from '../primitives/ChartFrame'
import { Crosshair, SeriesDot } from '../primitives/Crosshair'
import { HoverOverlay } from '../primitives/HoverOverlay'
import { useHoverSync } from '../hooks/useHoverSync'
import { deriveTooltipRows } from '../series'
import type { ChartLegendConfig, ChartSeries } from '../series'
import { VX } from '../../tokens'
import { smartTicks, smartTicksEvery } from '../utils/ticks'

export type StackedAreaProps<T> = {
  data: T[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  chartId: string
  getX: (d: T) => string
  /** The stacked bands, bottom to top — the single source of truth for color, legend, and tooltip
   * rows. Typically `mark: 'area'` (rendered as a `bar`-shaped legend/tooltip swatch). */
  series: ChartSeries<T>[]
  formatValue: (v: number) => string
  yLabel?: string
  numTicksY?: number
  numTicksX?: number
  yAutoMaxFloor?: number
  /** Legend config forwarded to `ChartFrame`; `false` disables the legend (sparkline escape).
   * Default `{ placement: 'bottom' }`. */
  legend?: ChartLegendConfig | false
}

/**
 * Multi-series stacked-area chart with an optional derived legend (default on) and legend-hover
 * dimming. Each band's fillOpacity is dimmed when a different key is highlighted via the legend.
 * The tooltip renders rows in reversed (top-to-bottom) stack order so it matches the visual stack.
 */
function StackedAreaInner<T>(props: StackedAreaProps<T>) {
  const { series, chartId, height, legend } = props
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)

  return (
    <ChartFrame
      series={series}
      chartId={chartId}
      {...(height !== undefined && { height })}
      legend={resolveLegend(legend, {
        highlighted: highlightedKey,
        onHighlight: setHighlightedKey,
      })}
    >
      {(plot) => <StackedAreaPlot {...props} plot={plot} highlightedKey={highlightedKey} />}
    </ChartFrame>
  )
}

type StackedAreaPlotProps<T> = StackedAreaProps<T> & {
  plot: { width: number; height: number }
  highlightedKey: string | null
}

/** The measured plot — split from {@link StackedAreaInner} so its scale/hover-sync hooks only run
 * once `ChartFrame` has resolved a non-empty plot rect. */
function StackedAreaPlot<T>(props: StackedAreaPlotProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    formatValue,
    numTicksY = 5,
    numTicksX,
    yAutoMaxFloor,
    plot,
    highlightedKey,
  } = props

  const MARGIN = VX.margin
  const xMax = plot.width - MARGIN.left - MARGIN.right
  const yMax = plot.height - MARGIN.top - MARGIN.bottom

  const seriesByKey = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])
  const groups = useMemo(() => series.map((s) => s.key), [series])

  const xScale = useMemo(
    () =>
      scalePoint<string>({
        domain: data.map(getX),
        range: [0, xMax],
        padding: 0,
      }),
    [data, xMax, getX],
  )

  const yScale = useMemo(() => {
    let maxTotal = 0
    for (const d of data) {
      let total = 0
      for (const s of series) {
        total += s.getValue(d) ?? 0
      }
      if (total > maxTotal) maxTotal = total
    }
    const upper = Math.max(maxTotal, yAutoMaxFloor ?? maxTotal) * 1.1
    return scaleLinear<number>({ domain: [0, upper], range: [yMax, 0], nice: true })
  }, [data, series, yMax, yAutoMaxFloor])

  const tooltipStyles = useTooltipStyles()
  const { tip, tooltipRef, syncedPoint, isDirectHover, handleMouse, handleLeave } = useHoverSync<T>(
    {
      data,
      chartId,
      getKey: getX,
      xScale,
      marginLeft: MARGIN.left,
    },
  )

  const tickValues = useMemo(
    () =>
      numTicksX ? smartTicksEvery(data.map(getX), numTicksX) : smartTicks(data.map(getX), xMax),
    [data, xMax, getX, numTicksX],
  )

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={xMax} stroke={VX.grid} numTicks={numTicksY} />

          <AreaStack<T, string>
            data={data}
            keys={groups}
            x={(d) => xScale(getX(d.data)) ?? 0}
            y0={(d) => yScale(d[0]) ?? 0}
            y1={(d) => yScale(d[1]) ?? 0}
            value={(d, key) => seriesByKey.get(key)?.getValue(d) ?? 0}
            curve={curveMonotoneX}
          >
            {({ stacks, path }) =>
              stacks.map((stack) => (
                <path
                  key={`stack-${stack.key}`}
                  d={path(stack) || ''}
                  fill={seriesByKey.get(stack.key)?.color}
                  stroke="transparent"
                  fillOpacity={highlightedKey === null || highlightedKey === stack.key ? 1 : 0.25}
                />
              ))
            }
          </AreaStack>

          {syncedPoint &&
            (() => {
              const sx = xScale(getX(syncedPoint)) ?? 0
              // A dot on each band's TOP edge (its cumulative stacked value), so the tooltip's
              // per-series rows visibly attach to the boundary between that series and the one above.
              let cum = 0
              return (
                <>
                  <Crosshair x={sx} top={0} bottom={yMax} />
                  {series.map((s) => {
                    cum += s.getValue(syncedPoint) ?? 0
                    return (
                      <SeriesDot key={`dot-${s.key}`} cx={sx} cy={yScale(cum)} color={s.color} />
                    )
                  })}
                </>
              )
            })()}

          <AxisLeftNumeric scale={yScale} numTicks={numTicksY} tickFormat={formatValue} />
          <AxisBottomDate top={yMax} scale={xScale} tickValues={tickValues} />

          <HoverOverlay width={xMax} height={yMax} onMove={handleMouse} onLeave={handleLeave} />
        </Group>
      </svg>
      <ChartTooltip tip={isDirectHover ? tip : null} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && isDirectHover && (
          <>
            <TooltipHeader date={getX(tip.data)} />
            <TooltipBody>
              {deriveTooltipRows(series.toReversed(), tip.data, formatValue).map((row) => (
                <TooltipRow
                  key={row.key}
                  color={row.color}
                  label={row.label}
                  value={row.value}
                  shape={row.shape}
                />
              ))}
            </TooltipBody>
          </>
        )}
      </ChartTooltip>
    </>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot stacked-area kind in `React.memo` to retain the auto-memoization it had as source
 * (parity with ZonedLine / Bars / MultiLine).
 */
export const StackedArea = memo(StackedAreaInner) as typeof StackedAreaInner
