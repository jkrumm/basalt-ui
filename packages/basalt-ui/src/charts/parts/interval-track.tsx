/**
 * `IntervalTrack` — rows of spans and point events over one shared x axis (a calendar week by the
 * hour, the steps of a run by elapsed time, the outages of a line by day). Each row is a band; spans of
 * one row that overlap take a lane each, and a series on the `back` layer spans the row's full height
 * behind the lanes and takes none. A span is a tinted block: its series' registered `{ light, dark }`
 * pair mixed into the card at `TINT`, or outlined; with one lane series the spans paint neutral and the
 * accent is kept for the focused span. A datum with no end is a point; coincident points take a lane each. A mark
 * draws at least `MIN_MARK_PX`. Labels are placed by the kit's lane pass at the plot's own px width
 * (after, inside, before, else dropped by priority; never cut), so no page writes a breakpoint.
 * Built like `Heatmap`: its own definition on `core/compile` and the host, because `CartesianChart`
 * has no band y.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { ruleX } from '@tanstack/charts/rule'
import { text } from '@tanstack/charts/text'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from '@tanstack/charts/scales/time'
import type { ChartBuildContext, ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { useId, useMemo, useRef } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { BasaltProps } from '../../common/props'
import { useCoarsePointer } from '../../common/use-media-query'
import type { Empty } from '../../core/phase'
import type { Phase, QueryStateLike } from '../../core/ports'
import { BASALT, alpha } from '../../tokens'
import { resolveContainerClass } from '../../tokens/size-classes'
import { HEIGHT_MIN } from '../box'
import { chartLabels } from '../chart-labels'
import { chartName } from '../chart-name'
import type { ChartFocus, ChartName, SeriesColor } from '../contract'
import { engineRow, xGuide } from '../core/compile'
import type { CartesianDefinition } from '../core/compile'
import { engineTooltip } from '../core/cursor'
import { cardPortal } from '../core/portal'
import { xScaleFor } from '../core/scales'
import { CHART_THEME, CV, GRID_LINE } from '../core/theme'
import { engineFocusHandler, hostFocusProps } from '../focus'
import { ChartEngine, idPrefixOf } from '../host'
import { ChartLegend } from '../legend'
import { ChartPlaceholder, resolveChartState } from '../state'
import type { ChartSeries, ChartState, ChartTooltipRow, ResponsiveChartHeight } from '../types'
import { cssColor, toChartState } from './cartesian-adapt'
import { assignLanes } from '../../core/lanes'
import { LABEL_SLACK, cutToFit, placeLaneLabels } from './interval-layout'
import type { PlacedLaneLabel } from './interval-layout'

/** A value the x axis spans: a number (minutes, ms, a count) or a `Date`. */
export type IntervalX = number | Date

/** One series of spans: its legend entry and its paint. */
export type IntervalSeries<K extends string = string> = {
  key: K
  label: string
  /** A `{ light, dark }` pair from the app's series file. */
  color: SeriesColor
  /** `solid` (default) tints the span; `outline` draws it hollow (declined, planned, free). */
  fill?: 'solid' | 'outline' | undefined
  /**
   * `back` draws the series' spans the row's full height behind the lanes, taking no lane (a free
   * block, a maintenance window). Default `lane`.
   */
  layer?: 'lane' | 'back' | undefined
  /** `false` keeps it out of the legend. */
  legend?: false | undefined
}

export type IntervalTrackProps<
  T,
  X extends IntervalX = IntervalX,
  K extends string = string,
> = BasaltProps &
  ChartName & {
    data: readonly T[]
    /** The row a datum sits on (a day, a step, a host). */
    getRow: (d: T) => string
    /** Explicit row order, top to bottom. Default: first seen in `data`. A row with no data still draws. */
    rows?: readonly string[] | undefined
    /** A row's axis label. Default: the row key. Cut with an ellipsis where it does not fit. */
    formatRow?: ((row: string) => string) | undefined
    getStart: (d: T) => X
    /** The span's end; `null` or omitted draws a point event at the start. */
    getEnd?: ((d: T) => X | null) | undefined
    series: readonly IntervalSeries<K>[]
    getSeries: (d: T) => K
    /** A span's label, placed by the lane pass; `null` for none. */
    getLabel?: ((d: T) => string | null) | undefined
    /** Which label wins room first. Default: the span's length (a point ranks last). */
    getPriority?: ((d: T) => number) | undefined
    /** A row's own extent (working hours), drawn as a quiet band behind its spans. */
    rowExtent?: ((row: string) => readonly [X, X] | null) | undefined
    /** `[min, max]` of the x axis. Default: the extent of the spans and the row extents. */
    xDomain?: readonly [X, X] | undefined
    /** Tick and tooltip text for an x value. */
    formatX?: ((x: X) => string) | undefined
    /** A tick count, or the exact tick values. Default: round ticks by the container class. */
    xTicks?: number | readonly X[] | undefined
    /** The x axis name with its unit. */
    xTitle?: string | undefined
    /** `false` hides the legend. */
    legend?: false | undefined
    /** Rows after the span row (a status, an owner). `false` turns the tooltip off. */
    tooltip?: false | { rows?: ((d: T) => readonly ChartTooltipRow[]) | undefined } | undefined
    /**
     * `useChartFocus(data, …)`: pointing at a span or stepping with the arrow keys focuses it, it takes a
     * ring (a lane span also lifts one tone) while every other span keeps its paint, and `focus.readout` drives a card
     * fact. The track stays one tab stop.
     */
    focus?: ChartFocus<T> | undefined
    /** A fixed height, or `'fill'` (a `ChartCard` box) to take the parent's. Default: by lane count. */
    height?: number | ResponsiveChartHeight | 'fill' | undefined
    /** The load state, as on every data part: a `Phase` or a query result. */
    phase?: Phase | QueryStateLike | undefined
    /** The measured-empty state once the query settled; `cause` is the line the tile prints. */
    empty?: Empty | null | undefined
    /** @deprecated Use `phase` and `empty`; removed in the next minor. */
    state?: ChartState | undefined
  }

/** Px per lane at the natural height, and the air round a row's lanes, in lanes. */
const LANE_PX = 26
const ROW_PAD = 0.15
/** A span's share of its lane. */
const SPAN_INSET = 0.08
const MARGIN_TOP = 4
const LABEL_SIZE = BASALT.text.micro
/** The x tick row under the plot, and the axis title under it. */
const X_AXIS_PX = LABEL_SIZE + 14
const X_TITLE_PX = LABEL_SIZE + 8
const LABEL_GAP = 4
/** The least a mark paints, px: a short span or a point is widened to it, centred on its time. */
const MIN_MARK_PX = 6
/** The rect mark's default inset per edge, px: a box paints this much inside its edges. */
const RECT_INSET_PX = 0.75
/** Row labels take at most this share of the chart's width. */
const ROW_LABEL_SHARE = 0.3
const ROW_LABEL_AIR = 8
const OUTLINE_PX = 1
const RADIUS = 3
/** The focused span's ring, px. */
const LIFT_PX = 1.5
/** The card-coloured seam round a tinted span, px: two neighbours of one series read as two. */
const SEAM_PX = 1
/** The row extent's band: a quiet neutral, under the tint of the quietest span. */
const BAND_SHARE = 0.08

/**
 * The most of a colour mixed into the card that still holds `ink` at 4.5:1 for any colour at all
 * (black on the light card, white on the dark one): 43 % and 25 % with the shipped tokens, held here
 * with a margin for a derived palette. A focused lane span lifts to it (a back span takes a ring only); `interval-ink.test.tsx` holds it.
 */
export const TINT_CAP = { light: 0.4, dark: 0.22 } as const
/** A span's share of its colour at rest, under the cap, so an inside label is always `ink`. */
export const TINT = { light: 0.16, dark: 0.16 } as const
/** A colour mixed into the card at its scheme's share: an opaque fill, so its contrast is known. */
export const tint = (color: string, share: { light: number; dark: number }): string =>
  `light-dark(${mixCard(color, share.light)}, ${mixCard(color, share.dark)})`
const mixCard = (color: string, share: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(share * 100)}%, ${CV.surface})`
/** Round x ticks per container class. */
const TICKS = { micro: 2, narrow: 3, regular: 5, wide: 8 } as const

type Item<T> = {
  i: number
  d: T
  row: number
  /** The lane, or -1 on the `back` layer. */
  lane: number
  start: number
  end: number
  point: boolean
  series: string
  label: string | null
  priority: number
}

/** A drawn span on the y unit scale (0 at the top): `y1`..`y2` in lanes, `x1`..`x2` in data. */
type Box<T> = {
  id: number
  x1: number
  x2: number
  y1: number
  y2: number
  item: Item<T> | null
  /** What the engine hands the focus on a pointer: the span's own datum. */
  datum: T | null
}

type Text = {
  id: number
  x: number
  y: number
  text: string
  fill: string
  anchor: 'start' | 'end'
  dx: number
}

const toNum = (x: IntervalX): number => (x instanceof Date ? x.getTime() : x)

/** Lanes per row, each datum's lane, and the unit band each row spans. */
function trackModel<T>(input: {
  data: readonly T[]
  rows: readonly string[]
  getRow: (d: T) => string
  getStart: (d: T) => IntervalX
  getEnd: ((d: T) => IntervalX | null) | undefined
  getSeries: (d: T) => string
  getLabel: ((d: T) => string | null) | undefined
  getPriority: ((d: T) => number) | undefined
  back: ReadonlySet<string>
}) {
  const { data, rows } = input
  const rowIndex = new Map(rows.map((r, i) => [r, i]))
  const raw = data.flatMap((d, i) => {
    const row = rowIndex.get(input.getRow(d))
    if (row === undefined) return []
    const start = toNum(input.getStart(d))
    const endX = input.getEnd?.(d) ?? null
    const end = endX === null ? start : Math.max(start, toNum(endX))
    const series = input.getSeries(d)
    return [{ i, d, row, start, end, series }]
  })
  const items: Item<T>[] = []
  const laneCounts = rows.map((_, r) => {
    const own = raw.filter((it) => it.row === r)
    const laned = own.filter((it) => !input.back.has(it.series))
    const { lanes, count } = assignLanes(laned)
    for (const it of own) {
      const k = laned.indexOf(it)
      items.push({
        ...it,
        lane: k === -1 ? -1 : (lanes[k] ?? 0),
        point: it.end === it.start,
        label: input.getLabel?.(it.d) ?? null,
        priority: input.getPriority?.(it.d) ?? it.end - it.start,
      })
    }
    return count
  })
  const tops: number[] = []
  let total = 0
  for (const n of laneCounts) {
    tops.push(total)
    total += n + 2 * ROW_PAD
  }
  return { items, laneCounts, tops, total: Math.max(total, 1) }
}

/**
 * Rows of spans and point events on one shared x axis, with labels the kit places or drops.
 *
 * @useWhen spans with a start and an end sit on rows over time: a calendar week by the hour, the steps of a run, outages by day, shifts by person
 * @neverWhen the spans are one gap-free row of states (use BandStrip), a value is the answer (use Bars or Lines), or tasks depend on each other (a dependency view)
 */
export function IntervalTrack<T, X extends IntervalX = IntervalX, K extends string = string>(
  props: IntervalTrackProps<T, X, K>,
): ReactElement {
  const ariaLabel = chartName(props)
  const {
    data,
    getRow,
    formatRow = String,
    getStart,
    getEnd,
    series,
    getSeries,
    getLabel,
    getPriority,
    rowExtent,
    xDomain,
    formatX,
    xTicks,
    xTitle,
    legend,
    tooltip,
    focus,
    height,
    phase,
    empty,
    state: legacyState,
    className,
    style,
  } = props
  const state = toChartState(phase, empty, legacyState)
  const chartId = useId()
  const coarse = useCoarsePointer()
  const focused = focus?.datum ?? null
  // A boolean, not the handle: the handle is a new object every render and would rebuild the chart.
  const ownsKeys = focus !== undefined
  // One box object per datum across rebuilds: the engine re-reports focus whenever the focused
  // point's datum changes identity, and a fresh box per build would loop focus and render.
  const boxCache = useRef(new Map<number, Box<T>>())
  const tooltipRows = tooltip === false ? undefined : tooltip?.rows
  const showTooltip = tooltip !== false
  const rows = useMemo(
    () => props.rows ?? [...new Set(data.map(getRow))],
    [props.rows, data, getRow],
  )
  const seriesByKey = useMemo(
    () => new Map<string, IntervalSeries>(series.map((s) => [s.key, s])),
    [series],
  )
  const back = useMemo(
    () => new Set<string>(series.filter((s) => s.layer === 'back').map((s) => s.key)),
    [series],
  )
  const model = useMemo(
    () =>
      trackModel({ data, rows, getRow, getStart, getEnd, getSeries, getLabel, getPriority, back }),
    [data, rows, getRow, getStart, getEnd, getSeries, getLabel, getPriority, back],
  )
  const fill = height === 'fill'
  const boxHeight =
    height ??
    Math.max(
      HEIGHT_MIN,
      Math.round(model.total * LANE_PX + MARGIN_TOP + X_AXIS_PX + (xTitle ? X_TITLE_PX : 0)),
    )

  const definition = useMemo<CartesianDefinition>(() => {
    const { items, laneCounts, tops, total } = model
    const extents = rows.map((r) => {
      const e = rowExtent?.(r) ?? null
      return e === null ? null : ([toNum(e[0]), toNum(e[1])] as const)
    })
    const xs = [
      ...items.flatMap((it) => [it.start, it.end]),
      ...extents.flatMap((e) => (e === null ? [] : [...e])),
    ]
    const first = data[0]
    const isDate =
      (first !== undefined && getStart(first) instanceof Date) || xDomain?.[0] instanceof Date
    const domain =
      xDomain === undefined ? undefined : ([toNum(xDomain[0]), toNum(xDomain[1])] as const)
    const xModel = xScaleFor<number>(xs.length > 0 ? xs : [0, 1], false, domain)
    const [lo, hi] = xModel.extent ?? [0, 1]
    const span = hi > lo ? hi - lo : 1
    const asX = (v: number): X => (isDate ? new Date(v) : v) as X
    const fmt = (v: number): string => (formatX ? formatX(asX(v)) : String(v))
    const laneTop = (it: Item<T>): number => (tops[it.row] ?? 0) + ROW_PAD + Math.max(0, it.lane)
    const rowBand = (r: number): [number, number] => [
      (tops[r] ?? 0) + ROW_PAD * 0.5,
      (tops[r] ?? 0) + (laneCounts[r] ?? 1) + ROW_PAD * 1.5,
    ]
    const header = (it: Item<T>): string => it.label ?? formatRow(rows[it.row] ?? '')

    const tooltipOptions = showTooltip
      ? {
          use: engineTooltip,
          portal: cardPortal('card'),
          placement: ['bottom', 'top'] as const,
          content: (points: readonly ChartPoint[]) => {
            const it = (points[0]?.datum as Box<T> | undefined)?.item
            if (!it) return { rows: [] }
            const s = seriesByKey.get(it.series)
            const when = it.point ? fmt(it.start) : `${fmt(it.start)} to ${fmt(it.end)}`
            const head: ChartTooltipRow = {
              label: s?.label ?? it.series,
              value: when,
              ...(s && { color: paintOf(s, isOneSeries(series)) }),
            }
            return {
              title: header(it),
              rows: [head, ...(tooltipRows?.(it.d) ?? [])].map(engineRow),
            }
          },
        }
      : (false as const)

    return {
      chart: ({ width, height: boxPx }: ChartBuildContext): StoredChartSpec => {
        const cls = resolveContainerClass(width)
        // Row labels: as wide as the widest needs, at most a share of the chart, cut to fit; measured
        // with the lane pass's slack, so a wider face than the width table still fits its gutter.
        const measure = (t: string): number =>
          chartLabels.width(t, { size: LABEL_SIZE }) * LABEL_SLACK
        const room = Math.max(24, width * ROW_LABEL_SHARE)
        const rowText = rows.map((r) => {
          const full = formatRow(r)
          return measure(full) <= room ? full : (cutToFit(full, room, LABEL_SIZE) ?? '')
        })
        const widest = Math.max(0, ...rowText.map(measure))
        const left = Math.ceil(widest) + ROW_LABEL_AIR
        const right = Math.ceil(measure(fmt(hi)) / 2) + 2
        const bottom = X_AXIS_PX + (xTitle ? X_TITLE_PX : 0)
        const plotW = Math.max(1, width - left - right)
        const plotH = Math.max(1, boxPx - MARGIN_TOP - bottom)
        const px = (v: number): number => ((v - lo) / span) * plotW
        const minSpan = ((MIN_MARK_PX + 2 * RECT_INSET_PX) * span) / plotW
        // A mark draws at least MIN_MARK_PX: a short span or a point is widened about its time and
        // held inside the plot, so a mark at the edge never reaches the row labels.
        const markX = (it: Item<T>): [number, number] => {
          if (it.end - it.start >= minSpan) return [it.start, it.end]
          const mid = (it.start + it.end) / 2
          const x1 = Math.max(lo, Math.min(mid - minSpan / 2, hi - minSpan))
          return [x1, x1 + minSpan]
        }
        const labelsFit = plotH / total >= LABEL_SIZE + 2

        const boxOf = (it: Item<T>): Box<T> => {
          const [b0, b1] = rowBand(it.row)
          const y = laneTop(it)
          const [x1, x2] = markX(it)
          const next: Box<T> = {
            id: it.i,
            x1,
            x2,
            y1: it.lane < 0 ? b0 : y + SPAN_INSET,
            y2: it.lane < 0 ? b1 : y + 1 - SPAN_INSET,
            item: it,
            datum: it.d,
          }
          const kept = boxCache.current.get(it.i)
          if (kept === undefined) boxCache.current.set(it.i, next)
          return kept === undefined ? next : Object.assign(kept, next)
        }
        const isFocused = (it: Item<T>): boolean => focused !== null && it.d === focused
        const single = isOneSeries(series)

        // Round ticks over the domain (whole hours on a time axis), as many as the class holds.
        const count = typeof xTicks === 'number' ? xTicks : TICKS[cls]
        const tickValues = Array.isArray(xTicks)
          ? xTicks.map(toNum)
          : isDate
            ? scaleUtc()
                .domain([new Date(lo), new Date(hi)])
                .ticks(count)
                .map((d) => d.getTime())
            : scaleLinear().domain([lo, hi]).ticks(count)

        const marks = []
        marks.push(
          decorative(
            ruleX(tickValues, {
              id: 'grid',
              x: (v: number) => v,
              stroke: CV.grid,
              ...GRID_LINE,
            }),
          ),
        )
        const backdrops: Box<T>[] = extents.flatMap((e, r) => {
          if (e === null) return []
          const [y1, y2] = rowBand(r)
          return [{ id: -1 - r, x1: e[0], x2: e[1], y1, y2, item: null, datum: null }]
        })
        if (backdrops.length > 0)
          marks.push(
            decorative(
              rect(backdrops, {
                id: 'row-extent',
                ...AT_BOX,
                fill: alpha(CV.neutral, BAND_SHARE),
                radius: RADIUS,
              }),
            ),
          )
        // The back layer first, so a lane span over it wins the pointer.
        const ordered = [
          ...series.filter((s) => s.layer === 'back'),
          ...series.filter((s) => s.layer !== 'back'),
        ]
        // One interactive mark per series, the same whatever is focused, so the pointer's hit never moves.
        for (const s of ordered) {
          const boxes = items.filter((it) => it.series === s.key).map(boxOf)
          if (boxes.length === 0) continue
          const color = paintOf(s, single)
          marks.push(
            rect(boxes, {
              id: `span:${s.key}`,
              ...AT_BOX,
              radius: RADIUS,
              ...(s.fill === 'outline'
                ? { fill: CV.surface, stroke: color, strokeWidth: OUTLINE_PX }
                : { fill: seriesPaint(s, single), stroke: CV.surface, strokeWidth: SEAM_PX }),
            }),
          )
        }
        // The focused span takes a ring in its own colour (the accent on a one-series track) and a lane
        // span lifts one tone, to the cap; every other span keeps its paint. Decorative: no pointer.
        for (const it of items.filter(isFocused)) {
          const s = seriesByKey.get(it.series)
          if (s === undefined) continue
          const ring = isNeutral(s, single) ? CV.brand : cssColor(s.color)
          marks.push(
            decorative(
              rect([boxOf(it)], {
                id: 'lift',
                ...AT_BOX,
                radius: RADIUS,
                // A back span is a ring only: a tint over its full row would cover the lanes on it.
                fill: s.fill === 'outline' || s.layer === 'back' ? 'none' : tint(ring, TINT_CAP),
                stroke: ring,
                strokeWidth: LIFT_PX,
              }),
            ),
          )
        }

        // Labels, one lane at a time at the plot's px width; a back span labels in its row's first lane.
        const texts: Text[] = []
        if (labelsFit) {
          const lanes = new Map<string, Item<T>[]>()
          for (const it of items) {
            const k = `${it.row}:${Math.max(0, it.lane)}`
            lanes.set(k, [...(lanes.get(k) ?? []), it])
          }
          for (const lane of lanes.values()) {
            const spans = lane.map((it) => {
              const b = boxOf(it)
              return { key: it.i, from: px(b.x1), to: px(b.x2) }
            })
            const marksOn = spans.filter((sp) => lane.find((it) => it.i === sp.key)?.lane !== -1)
            const labels = lane.flatMap((it) => {
              const sp = spans.find((x) => x.key === it.i)
              return it.label === null || sp === undefined
                ? []
                : [{ ...sp, text: it.label, priority: it.priority }]
            })
            const { placed } = placeLaneLabels(labels, marksOn, {
              width: plotW,
              size: LABEL_SIZE,
              gap: LABEL_GAP,
            })
            for (const p of placed) {
              const it = lane.find((x) => x.i === p.key)
              if (it) texts.push(textOf(it, p))
            }
          }
        }
        if (texts.length > 0)
          marks.push(
            decorative(
              text(texts, {
                id: 'labels',
                x: 'x',
                y: 'y',
                key: 'id',
                text: 'text',
                fill: (t: Text) => t.fill,
                anchor: (t: Text) => t.anchor,
                dx: (t: Text) => t.dx,
                fontSize: LABEL_SIZE,
              }),
            ),
          )

        const guide = xGuide({
          model: xModel,
          xTicks: tickValues,
          format: (v) => fmt(+v),
          title: xTitle,
          cls,
          width,
        })
        const centres = rows.map((_, r) => (tops[r] ?? 0) + ROW_PAD + (laneCounts[r] ?? 1) / 2)
        return {
          marks,
          margin: { left, right, top: MARGIN_TOP, bottom },
          scales: {
            x: { scale: xModel.scale, ...guide },
            y: {
              scale: scaleLinear().domain([total, 0]),
              axis: {
                line: false,
                ticks: {
                  values: centres,
                  format: (v) => rowText[centres.indexOf(Number(v))] ?? '',
                  line: false,
                  size: 0,
                },
                tickLabels: { fontSize: LABEL_SIZE, opacity: 1 },
              },
            },
          },
          theme: CHART_THEME,
        } as StoredChartSpec

        function textOf(it: Item<T>, p: PlacedLaneLabel): Text {
          const b = boxOf(it)
          const y = it.lane < 0 ? laneTop(it) + 0.5 : (b.y1 + b.y2) / 2
          const s = seriesByKey.get(it.series)
          // Ink by what the label sits on: a tinted span is under the cap, so `ink` holds on it; the
          // card and the row band take the muted ink, which holds on both.
          const onBar = p.spot === 'inside' && s?.fill !== 'outline'
          const base = { id: it.i, y, text: p.text, fill: onBar ? CV.ink : CV.inkMuted }
          if (p.spot === 'after') return { ...base, x: b.x2, anchor: 'start', dx: LABEL_GAP }
          if (p.spot === 'inside') return { ...base, x: b.x2, anchor: 'end', dx: -LABEL_GAP }
          return { ...base, x: b.x1, anchor: 'end', dx: -LABEL_GAP }
        }
      },
      tooltip: tooltipOptions,
      // With `focus` the wrapper is the one tab stop and steps the track itself.
      ...(ownsKeys && { keyboard: false as const }),
    }
  }, [
    model,
    rows,
    rowExtent,
    data,
    getStart,
    xDomain,
    formatX,
    xTicks,
    xTitle,
    formatRow,
    series,
    seriesByKey,
    focused,
    showTooltip,
    tooltipRows,
    ownsKeys,
  ])

  const legendSeries = useMemo<ChartSeries<T>[]>(
    () =>
      series.map((s) => ({
        key: s.key,
        label: s.label,
        // The swatch shows the paint its spans take: neutral on a one-series track, tinted when solid.
        color: seriesPaint(s, isOneSeries(series)),
        mark: s.fill === 'outline' ? ('hollow' as const) : ('bar' as const),
        ...(s.legend !== undefined && { legend: s.legend }),
        getValue: () => null,
      })),
    [series],
  )
  const resolved = resolveChartState(state)
  const engineHeight = fill ? 'fill' : boxHeight
  const engine =
    resolved === null ? (
      <ChartEngine
        definition={definition}
        ariaLabel={ariaLabel}
        height={engineHeight}
        idPrefix={idPrefixOf(chartId)}
        coarse={coarse}
        onFocusDatum={engineFocusHandler(focus)}
      />
    ) : (
      <ChartPlaceholder state={state} height={engineHeight} ghost="grid" />
    )
  return (
    <div
      data-basalt-chart=""
      data-chart-kind="interval-track"
      {...(className !== undefined && { className })}
      style={fill ? { ...FILL_STYLE, ...style } : style}
    >
      {focus !== undefined && resolved === null ? (
        <div
          {...hostFocusProps(focus, ariaLabel, (key, index) =>
            stepTrack(model.items, key, index === null ? undefined : focus.items[index], (d) =>
              focus.items.indexOf(d),
            ),
          )}
          {...(fill && { style: FILL_WRAP })}
        >
          {engine}
          {focus.live}
        </div>
      ) : (
        engine
      )}
      {legend !== false && legendSeries.some((s) => s.legend !== false) && (
        <ChartLegend
          series={legendSeries}
          hidden={NONE_HIDDEN}
          mode="chips"
          groups={false}
          toggle={false}
          onToggle={noop}
          onHighlight={noop}
          concealed={resolved !== null}
        />
      )}
    </div>
  )
}

const AT_BOX = { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', key: 'id' } as const
/**
 * Colour names a category only when there are two: one lane series paints neutral, and the accent is
 * kept for the focused span. A back series keeps its own colour.
 */
const isOneSeries = (series: readonly IntervalSeries[]): boolean =>
  series.filter((s) => s.layer !== 'back').length <= 1
const isNeutral = (s: IntervalSeries, single: boolean): boolean => single && s.layer !== 'back'
const paintOf = (s: IntervalSeries, single: boolean): string =>
  isNeutral(s, single) ? CV.line : cssColor(s.color)
/** What a series shows in its legend swatch and paints its spans with: a solid span's tint, an outline's stroke. */
const seriesPaint = (s: IntervalSeries, single: boolean): string =>
  s.fill === 'outline' ? paintOf(s, single) : tint(paintOf(s, single), TINT)
const NONE_HIDDEN: ReadonlySet<string> = new Set()
const noop = (): void => {}
// A column: the box takes the height the legend row leaves, so the legend sits inside the parent.
/** The focus wrapper in a filled column: the height the legend row leaves, never more. */
const FILL_WRAP: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0',
  minHeight: 0,
}
const FILL_STYLE: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  height: '100%',
  minHeight: HEIGHT_MIN,
}

/**
 * The arrow keys over a track: Left and Right step along the row in start order, Up and Down move to
 * the adjacent row's span nearest in start, Home and End are the first and last span, Escape clears.
 * From no focus the first key lands on the first span (Left, Up and End: the last).
 */
export function stepTrack<T>(
  items: readonly { d: T; row: number; start: number }[],
  key: string,
  current: T | undefined,
  indexOf: (d: T) => number,
): number | null | undefined {
  if (key === 'Escape') return null
  const moves = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (!moves.includes(key)) return undefined
  const order = items.toSorted((a, b) => a.row - b.row || a.start - b.start)
  const pick = (it: { d: T } | undefined): number | undefined =>
    it === undefined ? undefined : indexOf(it.d)
  const here = order.find((it) => it.d === current)
  const back = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End'
  if (key === 'Home' || key === 'End' || here === undefined)
    return pick(back ? order.at(-1) : order[0])
  const at = order.indexOf(here)
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    const next = order[at + (key === 'ArrowRight' ? 1 : -1)]
    return pick(next !== undefined && next.row === here.row ? next : here)
  }
  const rowsWith = [...new Set(order.map((it) => it.row))]
  const target = rowsWith[rowsWith.indexOf(here.row) + (key === 'ArrowDown' ? 1 : -1)]
  if (target === undefined) return pick(here)
  const nearest = order
    .filter((it) => it.row === target)
    .reduce((best, it) =>
      Math.abs(it.start - here.start) < Math.abs(best.start - here.start) ? it : best,
    )
  return pick(nearest)
}
