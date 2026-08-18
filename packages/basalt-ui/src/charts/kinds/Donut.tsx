import { Group } from '@visx/group'
import { Pie } from '@visx/shape'
import { memo, useMemo, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { ChartTooltipFloat, TooltipBody, TooltipRow } from '../primitives/ChartTooltip'
import { ChartFrame } from '../primitives/ChartFrame'
import { VX } from '../../tokens'
import type { SeriesStyle } from '../series'
import type { SeriesKey } from '../../register'

/**
 * `K` defaults to the registered `SeriesKey` union for ergonomic inference on the common case (one
 * registered series map) — pass a wider `K` (or let it infer from `data`/`colorForKey`) for a
 * multi-domain map that isn't the registered slot, no `as DonutDatum[]` cast required.
 */
export type DonutDatum<K extends string = SeriesKey> = { key: K; value: number }

export type DonutProps<K extends string = SeriesKey> = {
  data: DonutDatum<K>[]
  /** Fixed height in pixels, forwarded to the internal `ChartFrame`. Default 240. */
  height?: number
  colorForKey: (key: K) => string
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
  /** Forwarded to `ChartFrame` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
}

/**
 * Radial slice-share chart with a punched-out center label. Composes `ChartFrame` for a
 * categorical legend derived from the slices (one `SeriesStyle` per slice, `mark: 'bar'`) so the
 * legend can never drift from what's plotted — legend-hidden slices drop out of the ring, the
 * center total, and the tooltip's "Share" row together (`docs/CHARTS-SPEC.md` §5). No crosshair —
 * meaningless for a radial layout. Hover stays local to the pie (dimming siblings on hover) rather
 * than joining the shared cursor: a date-keyed cursor has no counterpart on a donut, and cross-kind
 * category sync (donut ↔ bar, via a generalized key) is a distinct, deliberately deferred feature.
 */
function DonutInner<K extends string = SeriesKey>(props: DonutProps<K>) {
  const { data, height, colorForKey, seriesLabel = (k) => k, ariaLabel, isPending } = props

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
      {...(isPending !== undefined && { isPending })}
    >
      {(plot) => <DonutPlot {...props} plot={plot} />}
    </ChartFrame>
  )
}

type DonutPlotProps<K extends string = SeriesKey> = DonutProps<K> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
}

/** A hovered slice plus the viewport anchor `ChartTooltipFloat` positions against. */
type DonutTip<K extends string> = { key: K; value: number; anchor: { x: number; y: number } }

/** The measured plot — split from {@link DonutInner} so it only draws once `ChartFrame` has
 * resolved a non-empty plot rect (radius/center depend on the measured size). */
function DonutPlot<K extends string = SeriesKey>(props: DonutPlotProps<K>) {
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
  const { width, height, hidden } = plot

  const [tip, setTip] = useState<DonutTip<K> | null>(null)
  const hoveredKey = tip?.key ?? null

  const visibleData = useMemo(() => data.filter((d) => !hidden.has(d.key)), [data, hidden])

  const radius = Math.min(width, height) / 2 - 4
  const innerRadius = radius * innerRatio
  const centerX = width / 2
  const centerY = height / 2

  const total = useMemo(() => visibleData.reduce((sum, d) => sum + d.value, 0), [visibleData])

  const show = (d: DonutDatum<K>, event: PointerEvent<SVGGElement>) => {
    setTip({ key: d.key, value: d.value, anchor: { x: event.clientX, y: event.clientY } })
  }
  const hide = () => setTip(null)

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={centerX} top={centerY}>
          <Pie<DonutDatum<K>>
            data={visibleData}
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
                    onPointerEnter={(event) => {
                      show(arc.data, event)
                    }}
                    onPointerMove={(event) => {
                      show(arc.data, event)
                    }}
                    onPointerLeave={() => {
                      hide()
                    }}
                    onPointerCancel={() => {
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
            display: 'flex', // theme-allow: centering over the donut hole — charts/ is Mantine-free, so Center is unavailable here
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {centerContent}
        </div>
      )}

      {tip !== null && (
        <ChartTooltipFloat anchor={tip.anchor}>
          <TooltipBody>
            <TooltipRow
              color={colorForKey(tip.key)}
              label={seriesLabel(tip.key)}
              value={formatValue(tip.value)}
              shape="bar"
            />
            <TooltipRow
              color={VX.grid}
              label="Share"
              value={`${total > 0 ? Math.round((tip.value / total) * 100) : 0}%`}
              shape="bar"
            />
          </TooltipBody>
        </ChartTooltipFloat>
      )}
    </div>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot donut kind in `React.memo` to retain the auto-memoization it had as source.
 */
export const Donut = memo(DonutInner) as typeof DonutInner
