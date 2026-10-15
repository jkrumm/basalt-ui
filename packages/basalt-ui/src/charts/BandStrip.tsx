/**
 * `BandStrip` — a 1-D state strip: one gap-free band per slot over the shared x axis, no y
 * dimension (`docs/V2-SPEC.md` § 9.3). Each band is in one of the `states`, tinted by the state's
 * color (or an intensity `fill` of the datum's own), optionally carrying an inset `marker`.
 * Absence is a state like any other: a flat, unhatched fill whose color differs from every
 * measured state's, not only by alpha. Name it with `absentState` and a folded band can carry an
 * `absentFraction` share of it.
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
import { oneOf, requiredProp } from '../common/errors'
import { NON_FINITE } from '../format/shared'
import { VX, alpha } from '../tokens'
import { CartesianRung } from './CartesianChart'
import { groupsOf, resolveNamedState } from './band-fold'
import type { Group, NamedChartState } from './band-fold'
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
export type BandStripSeries<T> = NamedChartState & {
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

export type BandStripProps<T, X extends ChartX = ChartX, K extends string = string> = Omit<
  CartesianChartProps<T, X>,
  'marks' | 'series' | 'y' | 'y2' | 'zones' | 'xZones' | 'refLines'
> & {
  states: readonly (BandStripSeries<T> & { key: K })[]
  /** Which state, fill and marker each datum has. Memoize it: a new function recompiles the chart. */
  getBand: (d: T) => BandSpan
  fold?: BandFold<T> | undefined
  /**
   * The `states` key that means "not measured". A band in it is flat-filled like any state; a
   * band in another state paints its `absentFraction` share in this state's color, and the
   * tooltip adds this state's row. Absent stays a legended, flat state, never a
   * hatch: it reads as "no data" by hue and by sitting at the band's right edge, not as zero.
   */
  absentState?: K | undefined
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
/** A slot that answers the pointer: its own source datum, and the (possibly merged) one it reads. */
type Hit<T> = { slot: number; source: T; state: string; datum: T }

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
  f === undefined || Number.isNaN(f) ? 0 : Math.min(1, Math.max(0, f))

/**
 * The share of a band the strip's absent state owns. A band already in that state is absent in
 * whole, so the fraction only qualifies the others.
 */
function absentShareOf(span: BandSpan, absentKey: string | undefined): number {
  return absentKey === undefined || span.state === absentKey
    ? 0
    : clampFraction(span.absentFraction)
}

/**
 * The one visibility-aware split that paint, hits and the tooltip all read: the absent share that
 * is drawn (a hidden absent state gives its share back to the primary part) and whether the
 * primary part is drawn (a hidden primary state leaves its part unpainted, the absent part
 * untouched). `isVisible` is the legend's test, in whichever form the caller holds it.
 */
function resolveAbsent(
  span: BandSpan,
  absentKey: string | undefined,
  isVisible: (key: string) => boolean,
): { share: number; primaryShown: boolean } {
  const share = absentKey !== undefined && isVisible(absentKey) ? absentShareOf(span, absentKey) : 0
  return { share, primaryShown: share < 1 && isVisible(span.state) }
}

/** A state's tooltip value: its own reading, an em dash for `null`, empty when the name says it all. */
const stateValue = <T,>(s: BandStripSeries<T>, d: T): string =>
  s.formatValue ? (s.formatValue(d) ?? NON_FINITE) : ''

const unknownState = (prop: string, got: string, known: Iterable<string>): Error =>
  new Error(oneOf('BandStrip', prop, [...known], got))

type PaintCtx<T> = {
  base: Map<string, Layer>
  markers: Map<string, Layer>
  states: ReadonlyMap<string, BandStripSeries<T>>
  visible: ReadonlySet<string>
  height: number
  emphasis: (key: string) => number
  /** The strip's absent state, when it names a real entry of `states`. */
  absentKey: string | undefined
}

/**
 * Paints one band: its primary part (when shown), its absent share from the right edge, and its
 * marker over the primary part. Returns which states answer the pointer for the band's slots.
 */
function paintSpan<T>(
  ctx: PaintCtx<T>,
  span: BandSpan,
  cell: { f0: number; f1: number },
): { primary: boolean; absent: boolean } {
  const { states, visible, absentKey } = ctx
  const state = states.get(span.state)
  if (!state && process.env.NODE_ENV !== 'production')
    throw unknownState('BandSpan.state', span.state, states.keys())
  if (
    absentKey === undefined &&
    clampFraction(span.absentFraction) > 0 &&
    process.env.NODE_ENV !== 'production'
  )
    throw new Error(
      requiredProp('BandStrip', 'absentState', 'a BandSpan carries an absentFraction'),
    )
  const { share, primaryShown } = resolveAbsent(span, absentKey, (k) => visible.has(k))
  // An unknown state (production only) has no visibility to toggle: it always paints.
  const primary = state ? primaryShown : share < 1
  const absentStyle = absentKey === undefined ? undefined : states.get(absentKey)
  const split = cell.f1 - (cell.f1 - cell.f0) * share
  if (primary)
    paintInto(
      ctx.base,
      span.fill ?? (state ? alpha(state.color, state.fillOpacity ?? 1) : UNKNOWN_FILL),
      ctx.emphasis(span.state),
      { ...cell, f1: split, y0: 0, y1: 1 },
    )
  if (share > 0 && absentStyle && absentKey !== undefined)
    paintInto(
      ctx.base,
      alpha(absentStyle.color, absentStyle.fillOpacity ?? 1),
      ctx.emphasis(absentKey),
      { f0: split, f1: cell.f1, y0: 0, y1: 1 },
    )

  if (span.marker && primary) {
    const markerKey = span.marker.state ?? span.state
    const markerState = states.get(markerKey)
    if (!markerState && process.env.NODE_ENV !== 'production')
      throw unknownState('BandSpan.marker.state', markerKey, states.keys())
    if (!markerState || visible.has(markerKey)) {
      const inset = (span.marker.inset ?? DEFAULT_MARKER_INSET) / Math.max(ctx.height, 1)
      paintInto(ctx.markers, markerState?.color ?? UNKNOWN_FILL, ctx.emphasis(markerKey), {
        ...cell,
        f1: split,
        y0: inset,
        y1: 1 - inset,
      })
    }
  }
  // An unknown state (production only) answers no pointer: a tooltip row needs its series.
  return { primary: primary && state !== undefined, absent: share > 0 }
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
  const { data, getBand, fold, absentState: absentKey } = input
  const cap = Math.floor(input.width / (fold?.minBandPx ?? DEFAULT_MIN_BAND_PX))
  const groups: Group<T>[] =
    fold && data.length > cap
      ? groupsOf(data, cap)
      : data.map((d, start) => ({ start, items: [d] }))
  const ctx: PaintCtx<T> = {
    base: new Map(),
    markers: new Map(),
    states: input.states,
    visible: input.visible,
    height: input.height,
    emphasis: input.emphasis,
    absentKey,
  }
  const hits: Hit<T>[] = []

  for (const g of groups) {
    const datum = fold && g.items.length > 1 ? fold.merge(g.items) : g.items[0]
    if (datum === undefined) continue
    const span = getBand(datum)
    const cell = { f0: g.start / data.length, f1: (g.start + g.items.length) / data.length }
    const answers = paintSpan(ctx, span, cell)
    g.items.forEach((source, i) => {
      const slot = g.start + i
      if (answers.primary) hits.push({ slot, source, state: span.state, datum })
      if (answers.absent && absentKey !== undefined)
        hits.push({ slot, source, state: absentKey, datum })
    })
  }
  return { base: [...ctx.base.values()], markers: [...ctx.markers.values()], hits }
}

export function BandStrip<T, X extends ChartX = ChartX, K extends string = string>(
  props: BandStripProps<T, X, K>,
): ReactElement {
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
  // Resolved once: a misconfigured absent state degrades to primary-only paint, hits and rows.
  const absentKey = resolveNamedState(
    'BandStrip',
    'BandStrip.absentState',
    absentState,
    states.map((s) => s.key),
  )

  const series = useMemo<ChartSeries<T>[]>(
    () =>
      states.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        mark: 'bar' as const,
        ...(s.fillOpacity !== undefined && { fillOpacity: s.fillOpacity }),
        ...(s.tooltip !== undefined && { tooltip: s.tooltip }),
        ...(s.legend !== undefined && { legend: s.legend }),
        ...(s.note !== undefined && { note: s.note }),
        getValue: (d) => {
          const span = getBand(d)
          const share = absentShareOf(span, absentKey)
          if (span.state === s.key) return share < 1 ? 1 : null
          return s.key === absentKey && share > 0 ? 1 : null
        },
        formatValue: (_v, d) => stateValue(s, d),
      })),
    [states, getBand, absentKey],
  )

  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const { base, markers, hits } = layoutBands({
        data,
        getBand,
        fold,
        absentState: absentKey,
        states: new Map(states.map((s) => [s.key, s])),
        visible: new Set(plot.visible.map((s) => s.key)),
        width: plot.width,
        height: plot.height,
        emphasis: (key) => emphasis(plot.highlighted, { key }),
      })
      const rowKeys = new Map<PlotRow<T, X>, string>()
      const rows: PlotRow<T, X>[] = hits.map((h) => {
        const row = { x: x(h.source), y: 1, series: h.state, datum: h.datum }
        rowKeys.set(row, `${h.slot}|${h.state}`)
        return row
      })
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
                // One row per source slot and state, whatever the x values look like.
                key: (r) => rowKeys.get(r) ?? '',
                x: rowX,
                y1: 0,
                y2: 1,
                fill: 'transparent',
              }),
            ]
          : []),
      ]
    },
    [states, getBand, fold, absentKey, data, x],
  )

  // `getValue` cannot see the legend, so a fully absent band has no primary row. When the absent
  // state is hidden the strip paints the primary fill instead, and its row is added back here by
  // the same `resolveAbsent` that paints it.
  const tooltipWithPrimary = useMemo<BandStripProps<T, X>['tooltip']>(() => {
    if (tooltip === false || absentKey === undefined) return tooltip
    return {
      ...tooltip,
      rows: (d, ctx) => {
        const span = getBand(d)
        const primary = states.find((s) => s.key === span.state)
        const { primaryShown } = resolveAbsent(span, absentKey, (k) =>
          ctx.visible.some((s) => s.key === k),
        )
        const readdPrimary =
          primary?.tooltip !== false &&
          primary &&
          primaryShown &&
          absentShareOf(span, absentKey) === 1
        return [
          ...(readdPrimary
            ? [
                {
                  label:
                    primary.note === undefined
                      ? primary.label
                      : `${primary.label} · ${primary.note}`,
                  value: stateValue(primary, d),
                  color: primary.color,
                },
              ]
            : []),
          ...(tooltip?.rows?.(d, ctx) ?? []),
        ]
      },
    }
  }, [tooltip, absentKey, getBand, states])

  return (
    <CartesianRung
      {...rest}
      series={series}
      marks={marks}
      band
      y={STRIP_AXIS}
      xZones={ZX_ANCHOR}
      cursorResolution={cursorResolution}
      {...(tooltipWithPrimary !== undefined && { tooltip: tooltipWithPrimary })}
    />
  )
}
