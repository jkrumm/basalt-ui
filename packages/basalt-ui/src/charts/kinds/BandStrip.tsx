import { Group } from '@visx/group'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import { assertRequiredProps } from '../../common/validate'
import type { BasaltProps } from '../../common/props'
import { VX, alpha } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import type { CursorResolution } from '../cursor/resolve'
import { useBandPlot } from '../hooks/useBandPlot'
import type { BandFold, BandTooltipConfig } from '../hooks/useBandPlot'
import { AxisBottomDate } from '../primitives/Axes'
import { ChartFrame, resolveLegend } from '../primitives/ChartFrame'
import {
  ChartTooltipFloat,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
} from '../primitives/ChartTooltip'
import { Crosshair } from '../primitives/Crosshair'
import { HatchPattern, hatchFill, hatchSizeFor } from '../primitives/HatchPattern'
import { HoverOverlay } from '../primitives/HoverOverlay'
import type { ChartState } from '../primitives/ChartPending'
import type { ChartLegendConfig, SeriesStyle } from '../series'
import { fmtAxisDate } from '../utils/format'
import { isDev } from '../../common/is-dev'

/**
 * A state a strip can draw. Extends `SeriesStyle` rather than `ChartSeries` because a band has no
 * numeric value to plot — `formatValue` reads the datum directly.
 */
export type BandStripSeries<T> = SeriesStyle & {
  /**
   * The derived tooltip row's value for a band in this state.
   *
   * Return `null` for a datum in this state whose reading is ABSENT — the row renders
   * {@link NO_READING} instead, which is the escape `ChartSeries.getValue` has and this shape did
   * not: with no value accessor, an absent reading had to come back as `''` and render as a label
   * with an empty value, indistinguishable from a state whose name is the whole reading.
   *
   * Omit the function entirely for a state whose NAME *is* the whole reading ("Not measured").
   */
  formatValue?: (d: T) => string | null
}

/** One drawn band — which state it is in, and the three ways a state can be qualified. */
export type BandSpan = {
  /**
   * Series key naming this band's state: the tie to its legend entry, its fill, and its derived
   * tooltip row.
   *
   * A key not present in `series` is a bug TypeScript cannot catch (this is a `string`), and it
   * used to draw NOTHING — which on a strip whose vocabulary is measured/not-measured is
   * indistinguishable from a real coverage gap, so a typo silently asserted "not measured". It now
   * throws in development and draws an explicit unknown band in production; see
   * {@link unknownStateError} for why the two differ.
   */
  state: string
  /**
   * Overrides the fill derived from the state's series entry — the seam for an intensity ramp
   * WITHIN one state (5% loss vs 0.5% loss are the same state at different strengths). Build it
   * with `alpha(VX.*, …)`, never a raw hex.
   */
  fill?: string
  /**
   * 0..1 of this band's width that no source sample covers, drawn hatched from the band's right.
   *
   * This is what a fold owes the reader. A 1-of-3-measured slot whose merge reports the one
   * measured member's reading paints, without this, as a fully-measured band — a reading asserted
   * over two slots that reported nothing either way.
   */
  absentFraction?: number
  /**
   * A shorter, inset bar drawn over the band — for a fact that must NOT be readable off the fill
   * ramp (a renegotiation, a restart, a config change). Its colour comes from a `series` entry, so
   * it cannot be drawn in a hue the legend does not name.
   */
  marker?: {
    /** Series key naming the marker's colour. Defaults to the band's own `state`. */
    state?: string
    /** Vertical inset from the band's top and bottom, in px. Default 6. */
    inset?: number
  }
}

export type BandStripProps<T> = BasaltProps & {
  data: readonly T[]
  /** Stable id — identifies this chart as the cursor's source. */
  chartId: string
  /** Extracts the x-domain key. On a band strip this is a SLOT START, so `cursorResolution`
   * defaults to `'leading'` (see below) rather than `CartesianChart`'s `'nearest'`. */
  getX: (d: T) => string
  /** The states this strip can draw — the single source of truth for legend entries, band fills,
   * and the derived tooltip row. */
  series: readonly BandStripSeries<T>[]
  /** Which state each datum is in. */
  getBand: (d: T) => BandSpan
  /** Fixed height in px, forwarded to `ChartFrame`. The band row gets whatever the measured
   * margins and the measured legend band leave. Default 240. */
  height?: number
  /** Fill the parent flex/grid cell's measured height instead of a fixed one. */
  fill?: boolean
  /** X tick label formatter. Default `fmtAxisDate` (DD.MM). */
  formatX?: (key: string) => string
  /** Which keys get a tick. Default `smartTicks`. */
  xTickValues?: (keys: readonly string[], plotWidth: number) => readonly string[]
  /** Collapse adjacent data at widths where one band per datum sub-pixels. */
  fold?: BandFold<T>
  /**
   * How a sibling's broadcast cursor key resolves against this strip's slots. Default
   * `'leading'` — strict containment, "the slot that swallowed this key" — because a band IS a
   * span keyed by its leading edge, and it stays correct at every fold width. `'nearest'` puts
   * the crosshair one slot right for every source key in the back half of a slot.
   */
  cursorResolution?: CursorResolution
  tooltip?: BandTooltipConfig<T> | false
  legend?: ChartLegendConfig | false
  /** Colour of the absence hatch, AND the state that is absent. Names a `series` entry, so absence
   * is legended like any other state — a hatched band is the one mark a reader cannot decode from
   * an axis. A slot in this state hatches across its whole width unless its own `absentFraction`
   * says otherwise; a slot in any other state hatches only its `absentFraction`. Default
   * `VX.neutral`, unnamed. A key naming no `series` entry throws (a PROP, so a typo can only be a
   * wiring error) rather than falling back to the unnamed default. */
  absentState?: string
  /** Per-side overrides of the measured margins — applied last. */
  margin?: Partial<ChartMargin>
  /** Accessible text alternative, forwarded to `ChartFrame` (+ `role="group"`) and to the
   * focusable hover overlay's slider label. */
  ariaLabel?: string
  /** Forwarded to `ChartFrame` — see `ChartPending`'s JSDoc. */
  isPending?: boolean
  /** The three "nothing to draw" states in one prop — pending → error → empty. See
   * `ChartState`; `isPending` stays a supported alias for `state={{ pending: true }}`. */
  state?: ChartState
}

const DEFAULT_MARKER_INSET = 6

/** Rendered by a `formatValue` that returned `null` — an absent reading, told apart from a state
 * whose name is the whole reading (which renders no value at all). */
const NO_READING = '\u2014'

/**
 * The one band treatment that belongs to no legend entry. A dashed neutral outline appears nowhere
 * else on a strip — not as a state fill, not as the absence hatch — so an unresolvable key reads as
 * "unnamed", never as data.
 */
const UNKNOWN_MARK = {
  fill: alpha(VX.neutral, 0.2),
  stroke: VX.neutral,
  strokeWidth: 1,
  strokeDasharray: '3 2',
} as const

/**
 * A `state` (or `marker.state`) naming no `series` entry.
 *
 * Dev throws, production draws {@link UNKNOWN_MARK}: `state` comes off the DATUM, so a feed that
 * grows a state basalt has never seen must degrade to an honest unknown rather than take the page
 * down — while a typo, which is the same input, still fails loudly everywhere it is being written.
 * The one outcome ruled out in both is the old one: dropping the band, which renders as absence.
 */
function unknownStateError(what: string, key: string, known: Iterable<string>): Error {
  return new Error(
    `BandStrip: ${what} "${key}" names no \`series\` entry (known: ${[...known].join(', ')}) — so ` +
      'it has no legend entry, no colour and no tooltip row. Add the state to `series`, or map the ' +
      'datum onto one that is there.',
  )
}

/** A band's tooltip value: `null` from `formatValue` is an absent reading, `undefined` (no
 * `formatValue` at all) is a state whose label is the whole row. */
function formatBandValue<T>(style: BandStripSeries<T>, datum: T): string {
  if (style.formatValue === undefined) return ''
  return style.formatValue(datum) ?? NO_READING
}

/**
 * A 1-D categorical band strip: one rect per slot over a shared x axis, no y dimension at all.
 *
 * `CartesianChart` cannot host this. It renders `AxisLeftNumeric` unconditionally, so composing it
 * would draw a numeric axis over a chart that measures nothing vertically — and its `scalePoint` x
 * scale has positions but no widths, which is the whole content of a strip. This is the
 * non-single-plot escape `docs/CHARTS-SPEC.md` § "The contract" describes, assembled from the same
 * parts every other chart gets (`ChartFrame`, `autoMargin`, `useChartCursor`, `ChartTooltipFloat`)
 * via `useBandPlot`, never re-implemented.
 *
 * The three qualifications on {@link BandSpan} — `fill`, `absentFraction`, `marker` — are the ones
 * a state strip cannot do without: an intensity ramp inside a state, the share of a folded slot
 * nothing measured, and a fact that must not be read off the ramp.
 */
function BandStripInner<T>(props: BandStripProps<T>) {
  // F-ERR-1: name the component and the prop. Without this a missing accessor surfaces
  // from inside visx as `undefined is not a function`, which `BasaltErrorBoundary`
  // swallows into a blank subtree that names nothing.
  assertRequiredProps('BandStrip', props, ['data', 'getX', 'series', 'getBand'])
  const { series, chartId, height, fill, legend, ariaLabel, isPending, state, className, style } =
    props

  return (
    <ChartFrame
      series={series}
      chartId={chartId}
      {...(height !== undefined && { height })}
      {...(fill !== undefined && { fill })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
      {...(state !== undefined && { state })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
      legend={resolveLegend(legend)}
    >
      {(plot) => <BandStripPlot {...props} plot={plot} />}
    </ChartFrame>
  )
}

type BandStripPlotProps<T> = BandStripProps<T> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
}

/** The measured plot — split from {@link BandStripInner} so its scale/cursor hooks only run once
 * `ChartFrame` has resolved a non-empty plot rect (parity with `DualPanel`). */
function BandStripPlot<T>(props: BandStripPlotProps<T>) {
  const {
    data,
    chartId,
    getX,
    series,
    getBand,
    formatX = fmtAxisDate,
    xTickValues,
    fold,
    cursorResolution = 'leading',
    tooltip,
    absentState,
    margin: marginOverride,
    ariaLabel,
    plot,
  } = props

  const { hidden } = plot
  const styleByKey = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])

  const band = useBandPlot<T>({
    data,
    chartId,
    getX,
    formatX,
    width: plot.width,
    cursorResolution,
    ...(fold !== undefined && { fold }),
    ...(xTickValues !== undefined && { xTickValues }),
    ...(marginOverride !== undefined && { margin: marginOverride }),
    ...(tooltip !== undefined && { tooltip }),
  })

  const { bands, margin, plotWidth, scale, cursor, point, crosshairX, step, bandWidth } = band
  const stripHeight = Math.max(plot.height - margin.top - margin.bottom, 1)
  const hatchId = `${chartId}-band-absent`
  if (absentState !== undefined && !styleByKey.has(absentState)) {
    throw unknownStateError('absentState', absentState, styleByKey.keys())
  }
  const absentColor =
    (absentState === undefined ? undefined : styleByKey.get(absentState)?.color) ?? VX.neutral

  const rects = useMemo<ReactNode[]>(() => {
    const out: ReactNode[] = []
    bands.forEach((d, i) => {
      const span = getBand(d)
      const style = styleByKey.get(span.state)
      const x = i * step
      if (style === undefined) {
        if (isDev()) throw unknownStateError('BandSpan.state', span.state, styleByKey.keys())
        out.push(
          <rect
            key={getX(d)}
            {...UNKNOWN_MARK}
            x={x}
            y={0}
            width={bandWidth}
            height={stripHeight}
            rx={1}
            pointerEvents="none"
          />,
        )
        return
      }
      if (hidden.has(span.state)) return
      // Clamped AND finite-checked. `foldedFrom` is carried by the consumer's datum, so a
      // 0/0 on an un-folded slot arrives here as NaN — which `Math.min`/`Math.max` propagate
      // straight into `width="NaN"`, a band that silently fails to paint.
      // A slot whose STATE is the absent one is absent in whole — `absentState` and
      // `absentFraction` are two ways of saying the same thing, and gating the hatch on the
      // fraction alone meant a strip declaring `absentState` painted a flat fill while the docs,
      // the demo and its own `<pattern>` all promised hatching. An explicit `absentFraction` still
      // wins: a partially-covered slot in the absent state says so itself.
      const absent =
        span.state === absentState
          ? clampFraction(span.absentFraction ?? 1)
          : clampFraction(span.absentFraction)
      const measuredWidth = bandWidth * (1 - absent)
      const hatchWidth = bandWidth - measuredWidth
      const markerKey = span.marker?.state ?? span.state
      const markerColor = styleByKey.get(markerKey)?.color
      if (span.marker !== undefined && markerColor === undefined && isDev()) {
        throw unknownStateError('BandSpan.marker.state', markerKey, styleByKey.keys())
      }
      const inset = span.marker?.inset ?? DEFAULT_MARKER_INSET
      out.push(
        <g key={getX(d)}>
          {measuredWidth > 0 && (
            <rect
              x={x}
              y={0}
              width={measuredWidth}
              height={stripHeight}
              rx={1}
              fill={span.fill ?? alpha(style.color, style.fillOpacity ?? 1)}
              pointerEvents="none"
            />
          )}
          {hatchWidth > 0 && (
            <rect
              x={x + measuredWidth}
              y={0}
              width={hatchWidth}
              height={stripHeight}
              rx={1}
              fill={hatchFill(hatchId)}
              pointerEvents="none"
            />
          )}
          {span.marker !== undefined && measuredWidth > 0 && (
            <rect
              {...(markerColor === undefined ? UNKNOWN_MARK : { fill: markerColor })}
              x={x}
              y={inset}
              width={measuredWidth}
              height={Math.max(stripHeight - 2 * inset, 2)}
              rx={1}
              pointerEvents="none"
            />
          )}
        </g>,
      )
    })
    return out
  }, [bands, getBand, getX, styleByKey, hidden, bandWidth, step, stripHeight, hatchId, absentState])

  if (plotWidth <= 0 || bands.length === 0) return null

  const cfg = tooltip === false ? undefined : tooltip
  const badge = cfg?.label === undefined || point === null ? null : cfg.label(point)
  const row = point === null ? null : deriveBandRow(getBand(point), styleByKey, hidden, point)

  return (
    <>
      <svg ref={band.svgRef} width={plot.width} height={plot.height}>
        <defs>
          <HatchPattern
            id={hatchId}
            color={absentColor}
            opacity={0.7}
            size={hatchSizeFor(bandWidth)}
          />
        </defs>
        {/* theme-allow-file basalt/hand-rolled-plot — a strip has ONE dimension: slots over a
            category axis, no numeric y at all. `CartesianChart`'s contract is a single plot rect
            with one or two numeric y axes and it renders `AxisLeftNumeric` unconditionally, so it
            cannot express this shape. The plot is assembled here from the SAME parts every other
            chart gets — `ChartFrame`, `autoMargin`, `useChartCursor`, `ChartTooltipFloat` — through
            `useBandPlot`, which `MirroredBars` composes too rather than copying this file. */}
        <Group left={margin.left} top={margin.top}>
          {rects}

          {crosshairX !== null && <Crosshair x={crosshairX} top={0} bottom={stripHeight} />}

          <AxisBottomDate
            top={stripHeight}
            scale={scale}
            tickValues={band.tickValues}
            tickFormat={(v) => formatX(String(v))}
          />

          <HoverOverlay
            width={plotWidth}
            height={stripHeight}
            onMove={cursor.onPointerMove}
            onLeave={cursor.onPointerLeave}
            onKeyDown={cursor.onKeyDown}
            onBlur={cursor.onBlur}
            valueMax={Math.max(bands.length - 1, 0)}
            {...(point !== null && {
              valueNow: bands.indexOf(point),
              valueText: formatX(getX(point)),
            })}
            {...(ariaLabel !== undefined && { ariaLabel })}
          />
        </Group>
      </svg>

      {band.showTooltip && point !== null && (
        <ChartTooltipFloat anchor={band.tooltipAnchor} ariaLive={band.ariaLive}>
          <TooltipHeader
            date={getX(point)}
            {...(cfg?.formatHeader !== undefined && {
              format: (key: string) => cfg.formatHeader?.(key, point) ?? key,
            })}
            {...(badge !== null && { label: badge.text, labelColor: badge.color })}
          />
          <TooltipBody>
            {cfg?.prependRows?.(point, { hidden })}
            {row !== null && (
              <TooltipRow
                color={row.color}
                label={row.label}
                value={row.value}
                shape={row.shape}
                dashed={row.dashed}
              />
            )}
            {cfg?.extraRows?.(point, { hidden })}
          </TooltipBody>
        </ChartTooltipFloat>
      )}
    </>
  )
}

/** A 0..1 share. Non-finite (a 0/0 fold count) reads as "nothing is absent" — the conservative
 * end, since the alternative is a band that does not render at all. */
function clampFraction(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

/**
 * The strip's one derived row: the hovered band's STATE, named and formatted by its own `series`
 * entry. A strip cannot show a row for a state it does not draw, and cannot name a state the
 * legend does not carry — the same guarantee `deriveTooltipRows` gives a cartesian chart, over a
 * shape that has no numeric value to derive from.
 */
function deriveBandRow<T>(
  span: BandSpan,
  styleByKey: ReadonlyMap<string, BandStripSeries<T>>,
  hidden: ReadonlySet<string>,
  datum: T,
): { color: string; label: string; value: string; shape: 'line' | 'bar'; dashed: boolean } | null {
  const style = styleByKey.get(span.state)
  // Production-only: dev threw while drawing. The row names the KEY rather than a state, so the
  // tooltip cannot read back a state the legend does not carry.
  if (style === undefined) {
    return {
      color: VX.neutral,
      label: 'Unknown state',
      value: span.state,
      shape: 'bar',
      dashed: true,
    }
  }
  if (style.tooltip === false || hidden.has(span.state)) return null
  return {
    color: style.color,
    label: style.label,
    value: formatBandValue(style, datum),
    shape: style.mark === 'line' ? 'line' : 'bar',
    dashed: style.dash === 'dashed',
  }
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot kind is wrapped in
 * `React.memo` to retain the auto-memoization it had as source (parity with `DualPanel`).
 */
const BandStripMemo = memo(BandStripInner)
// Without it every kind reads as `Memo` in React DevTools (audit A16) — a profiler flame
// graph of nine identically-named nodes names nothing.
BandStripMemo.displayName = 'BandStrip'
export const BandStrip = BandStripMemo as typeof BandStripInner
