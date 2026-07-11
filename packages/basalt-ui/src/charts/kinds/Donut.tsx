import { Group } from '@visx/group'
import { Pie } from '@visx/shape'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ChartTooltip, TooltipBody, TooltipRow, useTooltipStyles } from '../primitives/ChartTooltip'
import { ChartFrame } from '../primitives/ChartFrame'
import { useChartTooltip } from '../hooks/useChartTooltip'
import { VX } from '../../tokens'
import type { SeriesStyle } from '../series'
import type { SeriesKey } from '../../register'

export type DonutDatum = { key: SeriesKey; value: number }

export type DonutProps = {
  data: DonutDatum[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  colorForKey: (key: SeriesKey) => string
  formatValue: (v: number) => string
  seriesLabel?: (key: string) => string
  centerLabel?: string
  centerSubLabel?: string
  /**
   * Arbitrary content rendered in the ring center via an absolutely-positioned overlay, replacing
   * `centerLabel`/`centerSubLabel` when provided. Plain elements only (Mantine-free boundary) — the
   * overlay wrapper is `pointer-events: none` so it never steals arc hover, but a consumer can
   * re-enable pointer events on its own inner element if it needs to be interactive.
   *
   * @example
   * ```tsx
   * <Donut
   *   data={data}
   *   colorForKey={colorForKey}
   *   formatValue={formatValue}
   *   centerContent={
   *     <div style={{ textAlign: 'center' }}>
   *       <div style={{ fontFamily: 'var(--basalt-font-mono)', fontSize: 20, fontWeight: 600 }}>
   *         84%
   *       </div>
   *       <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>on track</div>
   *     </div>
   *   }
   * />
   * ```
   */
  centerContent?: ReactNode
  innerRatio?: number
  padAngle?: number
  /** Accessible text alternative, forwarded to `ChartFrame` as `aria-label` (+ `role="img"`). */
  ariaLabel?: string
}

/**
 * Radial slice-share chart with a punched-out center label. Composes `ChartFrame` for a
 * categorical legend derived from the slices (one `SeriesStyle` per slice, `mark: 'bar'`) so the
 * legend can never drift from what's plotted. No crosshair — meaningless for a radial layout.
 * Hover stays local to the pie (dimming siblings on hover) rather than joining the shared
 * `HoverContext`: a date-keyed cursor has no counterpart on a donut, and cross-kind category sync
 * (donut ↔ bar, via the generalized key) is a distinct, deliberately deferred feature.
 */
function DonutInner(props: DonutProps) {
  const { data, height, colorForKey, seriesLabel = (k) => k, ariaLabel } = props

  const series: SeriesStyle[] = data.map((d) => ({
    key: d.key,
    label: seriesLabel(d.key),
    color: colorForKey(d.key),
    mark: 'bar',
  }))

  return (
    <ChartFrame
      series={series}
      {...(height !== undefined && { height })}
      {...(ariaLabel !== undefined && { ariaLabel })}
    >
      {(plot) => <DonutPlot {...props} plot={plot} />}
    </ChartFrame>
  )
}

type DonutPlotProps = DonutProps & {
  plot: { width: number; height: number }
}

/** The measured plot — split from {@link DonutInner} so it only draws once `ChartFrame` has
 * resolved a non-empty plot rect (radius/center depend on the measured size). */
function DonutPlot(props: DonutPlotProps) {
  const {
    data,
    plot,
    colorForKey,
    formatValue,
    seriesLabel = (k) => k,
    centerLabel,
    centerSubLabel,
    centerContent,
    innerRatio = 0.6,
    padAngle = 0.01,
  } = props
  const { width, height } = plot

  const tooltipStyles = useTooltipStyles()

  const { tip, show, hide, tooltipRef } = useChartTooltip<DonutDatum>()
  const hoveredKey = tip?.data.key ?? null

  const radius = Math.min(width, height) / 2 - 4
  const innerRadius = radius * innerRatio
  const centerX = width / 2
  const centerY = height / 2

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={centerX} top={centerY}>
          <Pie<DonutDatum>
            data={data}
            pieValue={(d) => d.value}
            pieSortValues={() => 0}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={padAngle}
            cornerRadius={2}
          >
            {(pie) =>
              pie.arcs.map((arc) => {
                const key = arc.data.key
                return (
                  <g
                    key={key}
                    onMouseEnter={(event) => {
                      show(arc.data, event)
                    }}
                    onMouseMove={(event) => {
                      show(arc.data, event)
                    }}
                    onMouseLeave={() => {
                      hide()
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <path
                      d={pie.path(arc) || ''}
                      fill={colorForKey(key)}
                      stroke={VX.surface.panel}
                      strokeWidth={1.5}
                      opacity={hoveredKey === null || hoveredKey === key ? 1 : 0.4}
                    />
                  </g>
                )
              })
            }
          </Pie>

          {!centerContent && centerLabel && (
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={centerSubLabel ? -8 : 0}
              fill={VX.ink}
              fontSize={VX.text.lg}
              fontWeight={600}
              fontFamily="var(--basalt-font-mono)"
            >
              {centerLabel}
            </text>
          )}
          {!centerContent && centerSubLabel && (
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={centerLabel ? 10 : 0}
              fill={VX.ink}
              fontSize={VX.text.micro}
              opacity={0.75}
              fontFamily="var(--basalt-font-mono)"
            >
              {centerSubLabel}
            </text>
          )}
        </Group>
      </svg>

      {centerContent && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {centerContent}
        </div>
      )}

      <ChartTooltip tip={tip} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && (
          <TooltipBody>
            <TooltipRow
              color={colorForKey(tip.data.key)}
              label={seriesLabel(tip.data.key)}
              value={formatValue(tip.data.value)}
              shape="bar"
            />
            <TooltipRow
              color={VX.grid}
              label="Share"
              value={`${total > 0 ? Math.round((tip.data.value / total) * 100) : 0}%`}
              shape="bar"
            />
          </TooltipBody>
        )}
      </ChartTooltip>
    </div>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot donut kind in `React.memo` to retain the auto-memoization it had as source.
 */
export const Donut = memo(DonutInner) as typeof DonutInner
