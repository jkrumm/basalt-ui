/**
 * The choreography shared by every BANDED x plot — one slot per datum, drawn as a rect, with no
 * point in between.
 *
 * `CartesianChart` cannot host these: its x scale is `scalePoint` (positions, no width) and it
 * renders `AxisLeftNumeric` unconditionally. `BandStrip` has no numeric y axis at all and
 * `MirroredBars` has two, in two independent scales. Both are therefore
 * `basalt/hand-rolled-plot` shapes — and this module is what stops the second one from being a
 * copy of the first, per `DualPanel`'s own instruction to "promote the shared choreography rather
 * than copying this file".
 *
 * What lives here: width-driven folding, the measured gutters, the band scale and its
 * half-bandwidth cursor correction, the shared cursor itself, and the source/follower tooltip
 * anchor arithmetic. What does NOT: any mark. See `docs/CHARTS-SPEC.md` § "The contract".
 */

import { scaleBand } from '@visx/scale'
import { useCallback, useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { VX } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import type { CursorResolution } from '../cursor/resolve'
import { autoMargin } from '../layout/auto-margin'
import { maxTextWidth } from '../utils/measure-text'
import { smartTicks } from '../utils/ticks'
import { useChartCursor } from './useChartCursor'
import type { ChartCursor, CursorAnchor } from './useChartCursor'

type BandScale = ReturnType<typeof scaleBand<string>>

/**
 * Collapse adjacent data into one drawn band at widths where one-band-per-datum sub-pixels.
 *
 * 288 buckets over a 234px plot is a 0.81px pitch: every band draws at a flat 1px and a single
 * catastrophic slot can be overdrawn by its neighbour. Folding is the only honest answer — the
 * alternative is a chart that silently loses its worst column.
 */
export type BandFold<T> = {
  /**
   * Floor on the px pitch of a drawn band. Default 3 — not 2, because a band also has to be wide
   * enough for a partial-absence split (`absentFraction`) to render as two visibly distinct
   * pieces, and at 2px the fill and the hatch antialias into one smudge.
   */
  minBandPx?: number
  /**
   * Collapse a group of adjacent source data into the one datum drawn in its place.
   *
   * The merge is the CONSUMER's, deliberately: whether a folded slot's value is a max, a sum, or
   * a rate recomputed from summed parts is a question about the measurement, not about the
   * chart — and averaging a fully-down bucket into its clean neighbours describes a bucket that
   * never happened. The kind owns only the arithmetic of how many groups there are.
   *
   * Identity (`getX`) MUST come from `group[0]`, or the axis stops being monotone and the cursor
   * key stops naming a real slot start.
   */
  merge: (group: T[]) => T
}

const DEFAULT_MIN_BAND_PX = 3

/**
 * Terminal-gutter cap, as a fraction of the plot width.
 *
 * A gutter that exists only so a centred terminal tick label does not clip is half a label wide —
 * right at 1500px and absurd at 390, where half a `DD.MM HH:MM` label is 48px of a 338px chart
 * spent on empty margin. A gutter measured from an AXIS's own labels is never capped: shrinking
 * that one clips the reading itself.
 */
const TERMINAL_GUTTER_MAX_FRACTION = { left: 0.14, right: 0.12 }

/**
 * The grouping half of {@link BandFold}, exported so a consumer can test their `merge` against the
 * arithmetic that will actually run rather than re-implementing it in the test file — the merge is
 * where the honesty rules live (max vs mean vs a rate recomputed from summed parts), and a test
 * that groups differently from the kind is testing the wrong function.
 */
export function foldBands<T>(data: readonly T[], cap: number, merge: (group: T[]) => T): T[] {
  if (cap <= 0) return []
  if (data.length <= cap) return [...data]
  const groupSize = Math.ceil(data.length / cap)
  const out: T[] = []
  for (let i = 0; i < data.length; i += groupSize) out.push(merge(data.slice(i, i + groupSize)))
  return out
}

/** Tooltip seams shared by `BandStrip` and `MirroredBars` — the `CartesianTooltipConfig` subset
 * that means anything on a banded plot (there is no per-point `follow` distinction to make that
 * `CartesianChart` doesn't already document identically). */
export type BandTooltipConfig<T> = {
  /** Default true — the tooltip tracks the pointer. `false` anchors it to the crosshair at the
   * plot's top edge, so a column of charts sharing one cursor lines every tooltip up on one x. */
  follow?: boolean
  /** Right-aligned badge in the tooltip header. */
  label?: (d: T) => { text: string; color: string } | null
  /** Overrides the header's date text — same seam, same reason, as
   * `CartesianTooltipConfig.formatHeader`. */
  formatHeader?: (key: string, d: T) => string
  /** Rows rendered BEFORE the derived rows. `hidden` is the same legend-toggle set the marks
   * draw from, so a hand-authored row cannot desync from it. */
  prependRows?: (d: T, ctx: BandTooltipRowContext) => ReactNode
  /** Rows appended after the derived rows. Same `ctx` as {@link prependRows}. */
  extraRows?: (d: T, ctx: BandTooltipRowContext) => ReactNode
  /**
   * Render this chart's tooltip when it is a cursor FOLLOWER, not only when it is the SOURCE.
   * Default false. A follower has no pointer under it, so it always anchors to the crosshair
   * regardless of `follow`; only the SOURCE is `aria-live`. Costs one `getBoundingClientRect`
   * per hovered frame per opted-in chart — see `CartesianTooltipConfig.onFollow`.
   */
  onFollow?: boolean
}

export type BandTooltipRowContext = { hidden: ReadonlySet<string> }

export type UseBandPlotInput<T> = {
  data: readonly T[]
  chartId: string
  getX: (d: T) => string
  formatX: (key: string) => string
  /** The plot rect's width, as handed down by `ChartFrame`. */
  width: number
  fold?: BandFold<T>
  cursorResolution?: CursorResolution
  /**
   * Which of the (possibly folded) keys get a tick. Default `smartTicks`. The seam exists because
   * `smartTicks` appends the final value unconditionally, which on a dense time axis puts the last
   * two labels on top of each other — a chart whose x labels are richer than `DD.MM` needs its own
   * rule.
   */
  xTickValues?: (keys: readonly string[], plotWidth: number) => readonly string[]
  /** Left-axis tick labels, already formatted. Empty for a plot with no left axis. */
  leftLabels?: readonly string[]
  /** Per-side margin overrides — applied last, so the escape hatch always wins. */
  margin?: Partial<ChartMargin>
  tooltip?: BandTooltipConfig<T> | false
}

export type BandPlot<T> = {
  /** The data actually drawn — `data` when it fits, the folded slots when it does not. */
  bands: T[]
  keys: string[]
  margin: ChartMargin
  plotWidth: number
  scale: BandScale
  cursor: ChartCursor<T>
  point: T | null
  /** Plot-local x of the crosshair, or null when no point resolves. */
  crosshairX: number | null
  /** Pitch between adjacent band origins. */
  step: number
  /** Drawn width of one band — the pitch minus a 1px separator, floored at 1. */
  bandWidth: number
  tickValues: string[]
  svgRef: RefObject<SVGSVGElement | null>
  tooltipAnchor: CursorAnchor | null
  showTooltip: boolean
  /** Only the cursor SOURCE announces — N followers on one page would fire N live-region updates
   * per pointer move. */
  ariaLive: boolean
}

/**
 * Wire a banded plot into the framework's measured margins, band scale, shared cursor and tooltip
 * positioning. Returns everything except the marks.
 */
export function useBandPlot<T>(input: UseBandPlotInput<T>): BandPlot<T> {
  const {
    data,
    chartId,
    getX,
    formatX,
    width,
    fold,
    cursorResolution,
    xTickValues,
    leftLabels,
    margin: marginOverride,
    tooltip,
  } = input

  const hasLeftAxis = leftLabels !== undefined && leftLabels.length > 0
  const xLabelsAll = useMemo(() => data.map((d) => formatX(getX(d))), [data, getX, formatX])

  // ── Pass 1: gutters, from the labels that will actually be painted ──────────────────────────
  const margin = useMemo<ChartMargin>(() => {
    const measured = autoMargin({
      ...(leftLabels !== undefined && { left: leftLabels }),
      bottom: xLabelsAll,
      ...(marginOverride !== undefined && { override: marginOverride }),
    })
    if (marginOverride?.left !== undefined && marginOverride.right !== undefined) return measured

    const halfXLabel = Math.ceil(maxTextWidth(xLabelsAll, VX.axisFont) / 2)
    // A band axis puts its FIRST tick on the plot's left edge, so the left gutter needs the same
    // half-label law `autoMargin` already applies on the right. `autoMargin` cannot know that —
    // its left law measures a left AXIS, which a band plot may not have.
    const left = hasLeftAxis ? measured.left : Math.max(measured.left, halfXLabel)
    return {
      ...measured,
      ...(marginOverride?.left === undefined && {
        left: hasLeftAxis
          ? left
          : capTerminalGutter(left, width, TERMINAL_GUTTER_MAX_FRACTION.left, VX.margin.left),
      }),
      ...(marginOverride?.right === undefined && {
        right: capTerminalGutter(
          measured.right,
          width,
          TERMINAL_GUTTER_MAX_FRACTION.right,
          VX.margin.right,
        ),
      }),
    }
  }, [leftLabels, xLabelsAll, marginOverride, hasLeftAxis, width])

  const plotWidth = Math.max(width - margin.left - margin.right, 0)

  // ── Pass 2: the fold, BEFORE the scale — so the domain, and therefore the cursor's key space,
  // is the grid actually drawn rather than the raw one ────────────────────────────────────────
  const minBandPx = fold?.minBandPx ?? DEFAULT_MIN_BAND_PX
  const merge = fold?.merge
  const bands = useMemo(
    () =>
      merge === undefined ? [...data] : foldBands(data, Math.floor(plotWidth / minBandPx), merge),
    [data, plotWidth, minBandPx, merge],
  )

  const keys = useMemo(() => bands.map(getX), [bands, getX])
  const scale = useMemo(
    () => scaleBand<string>({ domain: keys, range: [0, plotWidth] }),
    [keys, plotWidth],
  )

  // `+ bandwidth()/2` is mandatory: `useChartCursor`'s nearest-point loop compares the pointer
  // against `xScale(getKey(d))`, and `scaleBand` returns the band's LEFT edge. Passing `scale`
  // raw biases every snap by half a band — at 288 bands, a systematic one-slot-early cursor.
  const bandCenter = useCallback(
    (key: string) => {
      const v = scale(key)
      return v === undefined ? undefined : v + scale.bandwidth() / 2
    },
    [scale],
  )

  const cursor = useChartCursor<T>({
    data: bands,
    chartId,
    getKey: getX,
    xScale: bandCenter,
    marginLeft: margin.left,
    ...(cursorResolution !== undefined && { resolution: cursorResolution }),
  })

  const tickValues = useMemo(
    () => [
      ...(xTickValues === undefined ? smartTicks(keys, plotWidth) : xTickValues(keys, plotWidth)),
    ],
    [keys, plotWidth, xTickValues],
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const point = cursor.point
  const crosshairX = point === null ? null : (bandCenter(getX(point)) ?? null)

  const cfg = tooltip === false ? undefined : tooltip
  // Identical seam to `CartesianChart`: SOURCE always, FOLLOWER only when opted in. A follower has
  // no pointer under it, so it is always positioned via the anchored (crosshair) path.
  const isFollowerRender = !cursor.isSource && cfg?.onFollow === true
  const showTooltip = tooltip !== false && point !== null && (cursor.isSource || isFollowerRender)
  const useAnchored = cfg?.follow === false || isFollowerRender
  const anchorX = useAnchored ? crosshairX : null
  const svgRect = anchorX === null ? undefined : svgRef.current?.getBoundingClientRect()
  const tooltipAnchor =
    svgRect === undefined || anchorX === null
      ? cursor.anchor
      : { x: svgRect.left + margin.left + anchorX, y: svgRect.top + margin.top }

  const step = bands.length > 0 ? plotWidth / bands.length : 0
  const bandWidth = Math.max(step - 1, 1)

  return {
    bands,
    keys,
    margin,
    plotWidth,
    scale,
    cursor,
    point,
    crosshairX,
    step,
    bandWidth,
    tickValues,
    svgRef,
    tooltipAnchor,
    showTooltip,
    ariaLive: cursor.isSource,
  }
}

/** Shrink a half-label gutter on a narrow plot, but never below the token floor. */
function capTerminalGutter(gutter: number, width: number, fraction: number, floor: number): number {
  return Math.min(gutter, Math.max(floor, Math.round(width * fraction)))
}
