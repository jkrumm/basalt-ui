import { Group } from '@visx/group'
import { Pie } from '@visx/shape'
import { memo, useMemo, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { useChartSize } from '../hooks/useChartSize'
import { assertRequiredProps } from '../../common/validate'
import type { BasaltProps } from '../../common/props'
import { ChartTooltipFloat, TooltipBody, TooltipRow } from '../primitives/ChartTooltip'
import { ChartFrame } from '../primitives/ChartFrame'
import type { ResponsiveChartHeight } from '../primitives/ChartFrame'
import type { ChartState } from '../primitives/ChartPending'
import { VX } from '../../tokens'
import { resolveContainerClass } from '../../tokens/size-classes'
import { resolveFrameHeight } from '../primitives/chart-frame-layout'
import {
  foldOther,
  resolveDonutLayout,
  resolveDonutRadius,
  resolveOtherKey,
  sharePercent,
} from './donut-layout'
import type { SeriesStyle } from '../series'
import type { SeriesKey } from '../../register'

/**
 * `K` defaults to the registered `SeriesKey` union for ergonomic inference on the common case (one
 * registered series map) — pass a wider `K` (or let it infer from `data`/`colorForKey`) for a
 * multi-domain map that isn't the registered slot, no `as DonutDatum[]` cast required.
 */
export type DonutDatum<K extends string = SeriesKey> = { key: K; value: number }

export type DonutProps<K extends string = SeriesKey> = BasaltProps & {
  data: DonutDatum<K>[]
  /** Height in px, or one per size step (`{ base, sm?, md?, lg? }`). Default 240. Forwarded
   * unchanged; `ChartFrameProps.height` owns the law — steps resolve off the MEASURED width. */
  height?: number | ResponsiveChartHeight
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
  /** Accessible text alternative, forwarded to `ChartFrame` as `aria-label` (+ `role="group"`). */
  ariaLabel?: string
  /** Forwarded to `ChartFrame` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
  /** The three "nothing to draw" states in one prop — pending → error → empty. See
   * `ChartState`; `isPending` stays a supported alias for `state={{ pending: true }}`. */
  state?: ChartState
}

const identityLabel = (key: string): string => key

/**
 * Radial slice-share chart with a punched-out center label. Composes `ChartFrame` for a
 * categorical legend derived from the slices (one `SeriesStyle` per slice, `mark: 'bar'`) so the
 * legend can never drift from what's plotted — legend-hidden slices drop out of the ring and the
 * tooltip together, while every share is taken of ALL slices so the legend and the tooltip never
 * disagree (`docs/CHARTS-SPEC.md` §5). No crosshair — meaningless for a radial layout. Hover stays local to the pie (dimming siblings on hover) rather
 * than joining the shared cursor: a date-keyed cursor has no counterpart on a donut, and cross-kind
 * category sync (donut ↔ bar, via a generalized key) is a distinct, deliberately deferred feature.
 *
 * Layout law (`docs/waves/RESPONSIVE-SPEC.md` §4): frame W/H > 1.5 puts the legend beside the ring
 * with value and %, the ring capped at `min(h, 0.55w)`; `micro`/`compact` stack the full legend
 * under the ring, never rolled up. 7 or more slices fold the smallest into a neutral "Other".
 */
function DonutInner<K extends string = SeriesKey>(props: DonutProps<K>) {
  // F-ERR-1: name the component and the prop. Without this a missing accessor surfaces
  // from inside visx as `undefined is not a function`, which `BasaltErrorBoundary`
  // swallows into a blank subtree that names nothing.
  assertRequiredProps('Donut', props, ['data', 'colorForKey'])
  const {
    data,
    height,
    colorForKey,
    formatValue,
    seriesLabel = identityLabel,
    ariaLabel,
    isPending,
    state,
    className,
    style,
  } = props

  // The legend side depends on the frame's own measured box, which only exists inside
  // `ChartFrame` — so measure the wrapper (same width) one level up. A stated height is used as
  // is; the measured one moves with the legend's placement, so an unstated height gets hysteresis.
  const { ref, width: frameW, height: measuredH } = useChartSize()
  const containerClass = resolveContainerClass(frameW)
  const frameH = height === undefined ? measuredH : resolveFrameHeight(height, containerClass)
  const wasSide = useRef(false)
  const { side } = resolveDonutLayout({
    frameW,
    frameH,
    containerClass,
    wasSide: height === undefined && wasSide.current,
  })
  wasSide.current = side

  const slices = useMemo(() => {
    const { kept, other } = foldOther(data)
    const out: Slice[] = kept.map((d) => ({
      key: d.key,
      label: seriesLabel(d.key),
      color: colorForKey(d.key),
      value: d.value,
    }))
    if (other !== null)
      out.push({
        key: resolveOtherKey(kept.map((d) => d.key)),
        label: 'Other',
        color: VX.neutral,
        value: other,
      })
    return out
  }, [data, seriesLabel, colorForKey])

  // One denominator for the side legend and the tooltip: every slice, hidden or not.
  const total = useMemo(() => slices.reduce((sum, d) => sum + d.value, 0), [slices])
  const series = useMemo<SeriesStyle[]>(
    () =>
      slices.map((d) => ({
        key: d.key,
        label: side
          ? `${d.label} · ${formatValue(d.value)} · ${sharePercent(d.value, total)}%`
          : d.label,
        color: d.color,
        mark: 'bar',
      })),
    [slices, side, formatValue, total],
  )

  return (
    <div
      ref={ref}
      {...(className !== undefined && { className })}
      style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, ...style }}
    >
      <ChartFrame
        series={series}
        // Never roll the legend up: the full list is the donut's only key. Side legends read as a column.
        legend={{ placement: side ? 'right' : 'bottom', maxRows: series.length }}
        {...(height !== undefined && { height })}
        {...(ariaLabel !== undefined && { ariaLabel })}
        {...(isPending !== undefined && { isPending })}
        {...(state !== undefined && { state })}
      >
        {(plot) => (
          <DonutPlot
            slices={slices}
            total={total}
            side={side}
            frameW={frameW}
            plot={plot}
            formatValue={formatValue}
            {...(props.centerLabel !== undefined && { centerLabel: props.centerLabel })}
            {...(props.centerSubLabel !== undefined && { centerSubLabel: props.centerSubLabel })}
            {...(props.centerContent !== undefined && { centerContent: props.centerContent })}
            {...(props.innerRatio !== undefined && { innerRatio: props.innerRatio })}
            {...(props.padAngle !== undefined && { padAngle: props.padAngle })}
          />
        )}
      </ChartFrame>
    </div>
  )
}

type Slice = { key: string; label: string; color: string; value: number }

type DonutPlotProps = Pick<
  DonutProps,
  'formatValue' | 'centerLabel' | 'centerSubLabel' | 'centerContent' | 'innerRatio' | 'padAngle'
> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
  slices: Slice[]
  /** Sum of ALL slices (hidden included) — the one denominator for every share. */
  total: number
  side: boolean
  frameW: number
}

/** A hovered slice plus the viewport anchor `ChartTooltipFloat` positions against. */
type DonutTip = { slice: Slice; anchor: { x: number; y: number } }

/** The measured plot — split from {@link DonutInner} so it only draws once `ChartFrame` has
 * resolved a non-empty plot rect (radius/center depend on the measured size). */
function DonutPlot(props: DonutPlotProps) {
  const {
    slices,
    total,
    plot,
    side,
    frameW,
    formatValue,
    centerLabel,
    centerSubLabel,
    centerContent,
    innerRatio = 0.6,
    padAngle = 0.01,
  } = props
  const { width, height, hidden } = plot

  const [tip, setTip] = useState<DonutTip | null>(null)
  const hoveredKey = tip?.slice.key ?? null

  const visibleData = useMemo(() => slices.filter((d) => !hidden.has(d.key)), [slices, hidden])

  const radius = resolveDonutRadius({ plotW: width, plotH: height, frameW, side })
  const innerRadius = radius * innerRatio
  const centerX = width / 2
  const centerY = height / 2

  const show = (d: Slice, event: PointerEvent<SVGGElement>) => {
    setTip({ slice: d, anchor: { x: event.clientX, y: event.clientY } })
  }
  const hide = () => setTip(null)

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={centerX} top={centerY}>
          <Pie<Slice>
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
                      fill={arc.data.color}
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
            // Centering over the donut hole; charts/ is Mantine-free, so Center is unavailable here.
            display: 'flex',
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
              color={tip.slice.color}
              label={tip.slice.label}
              value={formatValue(tip.slice.value)}
              shape="bar"
            />
            <TooltipRow
              color={VX.grid}
              label="Share"
              value={`${sharePercent(tip.slice.value, total)}%`}
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
const DonutMemo = memo(DonutInner)
// Without it every kind reads as `Memo` in React DevTools (audit A16) — a profiler flame
// graph of nine identically-named nodes names nothing.
DonutMemo.displayName = 'Donut'
export const Donut = DonutMemo as typeof DonutInner
