/**
 * `BandStrip` — a 1-D state strip: one gap-free band per slot over the shared x axis, no y
 * dimension (`docs/V2-SPEC.md` § 9.3). Each band is in one of the `states`, tinted by the state's
 * color (or an intensity `fill` of the datum's own), optionally carrying an inset `marker`.
 * Absence is a state like any other: color it `VX.neutral` for a flat, unhatched fill. Name it
 * with `absentState` and a folded band can carry an `absentFraction` share of it.
 *
 * The rung supplies the legend, cursor, crosshair and tooltip. The visible bands are decorative
 * rects on the rung's `[0, 1]` zone scale (a band scale pads its slots, a strip must not), and an
 * invisible bar per slot on the real x scale carries the pointer, so the cursor keys stay the
 * slots' own.
 */
import { barY } from '@tanstack/charts/bar'
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { useCallback, useMemo } from 'react'
import type { ReactElement } from 'react'
import { oneOf } from '../common/errors'
import { NON_FINITE } from '../format/shared'
import { VX, alpha } from '../tokens'
import { CartesianRung } from './CartesianChart'
import { emphasis } from './marks'
import { rowX } from './types'
import type {
  AxisConfig,
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
  ChartX,
  PlotContext,
  PlotRow,
} from './types'

/** A state a strip can draw. A band has no number to plot, so `formatValue` reads the datum. */
export type BandStripSeries<T> = Pick<
  ChartSeries<T>,
  'key' | 'label' | 'color' | 'tooltip' | 'legend' | 'note' | 'fillOpacity'
> & {
  /**
   * The tooltip row's value for a band in this state. `null` is an ABSENT reading and renders an
   * em dash; omit the function when the state's name is the whole reading ("Not measured").
   */
  formatValue?: ((d: T) => string | null) | undefined
}

/** One band: its state, and the two ways to qualify it. */
export type BandSpan = {
  /** A `states` key: the band's legend entry, fill and tooltip row. */
  state: string
  /** Overrides the state's fill — an intensity ramp WITHIN a state. `alpha(VX.*, …)`, never a hex. */
  fill?: string | undefined
  /**
   * 0..1 of the band's width that no source sample covers, painted from its right edge in the
   * `absentState` color. A fold owes the reader this: a band whose merge reports the one measured
   * member of three would otherwise read as fully measured. Needs `absentState` on the strip.
   */
  absentFraction?: number | undefined
  /**
   * A shorter, inset bar over the band, for a fact that must not be read off the fill ramp (a
   * renegotiation, a restart). Its color is a `states` entry, so the legend names it.
   */
  marker?:
    | {
        /** Defaults to the band's own `state`. */
        state?: string | undefined
        /** Vertical inset from the band's top and bottom, in px. Default 6. */
        inset?: number | undefined
      }
    | undefined
}

/** Collapse adjacent data where one band per datum would be thinner than `minBandPx`. */
export type BandFold<T> = {
  /** Floor on a drawn band's px width. Default 3. */
  minBandPx?: number | undefined
  /**
   * The consumer's merge of a group of adjacent data into the datum drawn in its place — whether
   * that is a max, a sum or a recomputed rate is a question about the measurement. Keep the first
   * datum's `x`, or the cursor key stops naming a real slot.
   */
  merge: (group: T[]) => T
}

export type BandStripProps<T, X extends ChartX = ChartX> = Omit<
  CartesianChartProps<T, X>,
  'marks' | 'series' | 'y' | 'y2' | 'zones' | 'xZones' | 'refLines'
> & {
  states: readonly BandStripSeries<T>[]
  /** Which state, fill and marker each datum has. Memoize it: a new function recompiles the chart. */
  getBand: (d: T) => BandSpan
  fold?: BandFold<T> | undefined
  /**
   * The `states` key that means "not measured". A band in it is flat-filled like any state; a
   * band in another state paints its `absentFraction` share in this state's color, and the
   * tooltip adds this state's row. Absent stays a legended, flat `VX.neutral` state, never a
   * hatch: it reads as "no data" by hue and by sitting at the band's right edge, not as zero.
   */
  absentState?: string | undefined
}

const DEFAULT_MIN_BAND_PX = 3
const DEFAULT_MARKER_INSET = 6

/** The whole strip is one row: a fixed unit domain, no ticks, no grid. */
const STRIP_AXIS = {
  domain: [0, 1],
  ticks: [],
  grid: false,
} as const satisfies AxisConfig<unknown>

/** Forces the rung's hidden `[0, 1]` x scale (`zx`) into existence; draws nothing. */
const ZX_ANCHOR = [{ fill: 'transparent' }] as const

/** A band whose state is not in `states`: a typo in dev, a neutral tint in production. */
const UNKNOWN_FILL = alpha(VX.neutral, 0.2)

type Cell = { f0: number; f1: number; y0: number; y1: number }
/** Cells sharing one paint: a `rect` mark takes a constant fill and opacity. */
type Layer = { fill: string; opacity: number; cells: Cell[] }
/** A run of adjacent slots drawn as one band; `items` are the source data it stands for. */
type Group<T> = { start: number; items: T[] }
/** A slot that answers the pointer: its own source datum, and the (possibly merged) one it reads. */
type Hit<T> = { source: T; state: string; datum: T }

/** Adjacent data in groups of equal size, the last possibly shorter, at most `cap` groups. */
function groupsOf<T>(data: readonly T[], cap: number): Group<T>[] {
  const size = Math.max(1, Math.ceil(data.length / Math.max(cap, 1)))
  const out: Group<T>[] = []
  data.forEach((d, i) => {
    const last = out.at(-1)
    if (last && last.items.length < size) last.items.push(d)
    else out.push({ start: i, items: [d] })
  })
  return out
}

/** Appends a cell to the layer with this paint, creating it in first-use order. */
function paintInto(layers: Map<string, Layer>, fill: string, opacity: number, cell: Cell): void {
  const key = `${fill}|${opacity}`
  const layer = layers.get(key)
  if (layer) layer.cells.push(cell)
  else layers.set(key, { fill, opacity, cells: [cell] })
}

type LayoutInput<T> = {
  data: readonly T[]
  getBand: (d: T) => BandSpan
  fold: BandFold<T> | undefined
  absentState: string | undefined
  states: ReadonlyMap<string, BandStripSeries<T>>
  /** State keys the legend has not toggled off. */
  visible: ReadonlySet<string>
  width: number
  height: number
  /** Legend-hover dimming for a state key. */
  emphasis: (key: string) => number
}

/** NaN and out-of-range fractions (a 0/0 on an un-folded slot) must not reach an SVG attribute. */
const clampFraction = (f: number | undefined): number =>
  f === undefined || !Number.isFinite(f) ? 0 : Math.min(1, Math.max(0, f))

/**
 * The share of a band the strip's absent state owns. A band already in that state is absent in
 * whole, so the fraction only qualifies the others.
 */
function absentShareOf(span: BandSpan, absentKey: string | undefined): number {
  return absentKey === undefined || span.state === absentKey
    ? 0
    : clampFraction(span.absentFraction)
}

const unknownState = (prop: string, got: string, known: Iterable<string>): Error =>
  new Error(oneOf('BandStrip', prop, [...known], got))

/** Paints a band as its measured part, then the absent share from the right edge. */
function paintSplit(
  layers: Map<string, Layer>,
  cell: { f0: number; f1: number },
  measured: { fill: string; opacity: number },
  absent: { share: number; fill: string; opacity: number },
): number {
  const split = cell.f1 - (cell.f1 - cell.f0) * absent.share
  if (absent.share < 1)
    paintInto(layers, measured.fill, measured.opacity, { ...cell, f1: split, y0: 0, y1: 1 })
  if (absent.share > 0)
    paintInto(layers, absent.fill, absent.opacity, { f0: split, f1: cell.f1, y0: 0, y1: 1 })
  return split
}

/**
 * Where every band and marker goes, and which slots answer the pointer. Pure: base layers and
 * marker layers come back separately so the caller can paint all markers after all bands (a
 * marker in another state's color must never sit under a later band).
 */
function layoutBands<T>(input: LayoutInput<T>): {
  base: Layer[]
  markers: Layer[]
  hits: Hit<T>[]
} {
  const { data, getBand, fold, states, visible, absentState: absentKey } = input
  const absentStyle = absentKey === undefined ? undefined : states.get(absentKey)
  if (absentKey !== undefined && !absentStyle && process.env.NODE_ENV !== 'production')
    throw unknownState('BandStrip.absentState', absentKey, states.keys())
  // A hidden absent state paints nothing and answers no pointer: the measured fill spans the slot.
  const absentVisible =
    absentKey !== undefined && absentStyle !== undefined && visible.has(absentKey)
  const cap = Math.floor(input.width / (fold?.minBandPx ?? DEFAULT_MIN_BAND_PX))
  const groups: Group<T>[] =
    fold && data.length > cap
      ? groupsOf(data, cap)
      : data.map((d, start) => ({ start, items: [d] }))
  const base = new Map<string, Layer>()
  const markers = new Map<string, Layer>()
  const hits: Hit<T>[] = []

  for (const g of groups) {
    const datum = fold && g.items.length > 1 ? fold.merge(g.items) : g.items[0]
    if (datum === undefined) continue
    const span = getBand(datum)
    const state = states.get(span.state)
    if (!state && process.env.NODE_ENV !== 'production')
      throw unknownState('BandSpan.state', span.state, states.keys())
    if (state && !visible.has(span.state)) continue
    const cell = { f0: g.start / data.length, f1: (g.start + g.items.length) / data.length }
    const opacity = input.emphasis(span.state)
    const declared = absentShareOf(span, absentKey)
    if (
      absentKey === undefined &&
      clampFraction(span.absentFraction) > 0 &&
      process.env.NODE_ENV !== 'production'
    )
      throw new Error('BandStrip: BandSpan.absentFraction needs the strip to name an `absentState`')
    const absent = absentVisible ? declared : 0
    const split = paintSplit(
      base,
      cell,
      {
        fill: span.fill ?? (state ? alpha(state.color, state.fillOpacity ?? 1) : UNKNOWN_FILL),
        opacity,
      },
      {
        share: absent,
        fill: absentStyle ? alpha(absentStyle.color, absentStyle.fillOpacity ?? 1) : UNKNOWN_FILL,
        opacity: absentKey === undefined ? 1 : input.emphasis(absentKey),
      },
    )

    if (span.marker && absent < 1) {
      const markerKey = span.marker.state ?? span.state
      const markerState = states.get(markerKey)
      if (!markerState && process.env.NODE_ENV !== 'production')
        throw unknownState('BandSpan.marker.state', markerKey, states.keys())
      if (!markerState || visible.has(markerKey)) {
        const inset = (span.marker.inset ?? DEFAULT_MARKER_INSET) / Math.max(input.height, 1)
        paintInto(markers, markerState?.color ?? UNKNOWN_FILL, input.emphasis(markerKey), {
          ...cell,
          f1: split,
          y0: inset,
          y1: 1 - inset,
        })
      }
    }
    // An unknown state (production only) answers no pointer: a tooltip row needs its series.
    if (state)
      for (const source of g.items) {
        if (absent < 1) hits.push({ source, state: span.state, datum })
        if (absent > 0 && absentKey !== undefined) hits.push({ source, state: absentKey, datum })
      }
  }
  return { base: [...base.values()], markers: [...markers.values()], hits }
}

export function BandStrip<T, X extends ChartX = ChartX>(props: BandStripProps<T, X>): ReactElement {
  const {
    states,
    getBand,
    fold,
    absentState,
    cursorResolution = 'leading',
    tooltip,
    ...rest
  } = props
  const { data, x } = rest

  const series = useMemo<ChartSeries<T>[]>(
    () =>
      states.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        mark: 'bar' as const,
        ...(s.tooltip !== undefined && { tooltip: s.tooltip }),
        ...(s.legend !== undefined && { legend: s.legend }),
        ...(s.note !== undefined && { note: s.note }),
        getValue: (d) => {
          const span = getBand(d)
          const share = absentShareOf(span, absentState)
          if (span.state === s.key) return share < 1 ? 1 : null
          return s.key === absentState && share > 0 ? 1 : null
        },
        formatValue: (_v, d) => (s.formatValue ? (s.formatValue(d) ?? NON_FINITE) : ''),
      })),
    [states, getBand, absentState],
  )

  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const { base, markers, hits } = layoutBands({
        data,
        getBand,
        fold,
        absentState,
        states: new Map(states.map((s) => [s.key, s])),
        visible: new Set(plot.visible.map((s) => s.key)),
        width: plot.width,
        height: plot.height,
        emphasis: (key) => emphasis(plot.highlighted, { key }),
      })
      const rows: PlotRow<T, X>[] = hits.map((h) => ({
        x: x(h.source),
        y: 1,
        series: h.state,
        datum: h.datum,
      }))
      return [
        ...[...base, ...markers].map(({ fill, opacity, cells }, i) =>
          decorative(
            rect(cells, {
              id: `band-${i}`,
              x1: 'f0',
              x2: 'f1',
              y1: 'y0',
              y2: 'y1',
              xScale: 'zx',
              fill,
              inset: 0,
              ...(opacity < 1 && { fillOpacity: opacity }),
            }),
          ),
        ),
        ...(rows.length > 0
          ? [
              barY(rows, {
                id: 'hit',
                key: (r) => `${String(r.x)}|${r.series}`,
                x: rowX,
                y1: 0,
                y2: 1,
                fill: 'transparent',
              }),
            ]
          : []),
      ]
    },
    [states, getBand, fold, absentState, data, x],
  )

  return (
    <CartesianRung
      {...rest}
      series={series}
      marks={marks}
      band
      y={STRIP_AXIS}
      xZones={ZX_ANCHOR}
      cursorResolution={cursorResolution}
      {...(tooltip !== undefined && { tooltip })}
    />
  )
}
