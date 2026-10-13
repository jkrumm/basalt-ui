/**
 * `BandStrip` — a 1-D state strip: one gap-free band per slot over the shared x axis, no y
 * dimension (`docs/V2-SPEC.md` § 9.3). Each band is in one of the `states`, tinted by the state's
 * color (or an intensity `fill` of the datum's own), optionally carrying an inset `marker`.
 * Absence is a state like any other: color it `VX.neutral` for a flat, unhatched fill.
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
import { VX, alpha } from '../tokens'
import { CartesianRung } from './CartesianChart'
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
export type BandStripState<T> = Pick<
  ChartSeries<T>,
  'key' | 'label' | 'color' | 'tooltip' | 'legend' | 'note' | 'fillOpacity'
> & {
  /**
   * The tooltip row's value for a band in this state. `null` is an ABSENT reading and renders an
   * em dash; omit the function when the state's name is the whole reading ("Not measured").
   */
  formatValue?: (d: T) => string | null
}

/** One band: its state, and the two ways to qualify it. */
export type BandSpan = {
  /** A `states` key: the band's legend entry, fill and tooltip row. */
  state: string
  /** Overrides the state's fill — an intensity ramp WITHIN a state. `alpha(VX.*, …)`, never a hex. */
  fill?: string
  /**
   * A shorter, inset bar over the band, for a fact that must not be read off the fill ramp (a
   * renegotiation, a restart). Its color is a `states` entry, so the legend names it.
   */
  marker?: {
    /** Defaults to the band's own `state`. */
    state?: string
    /** Vertical inset from the band's top and bottom, in px. Default 6. */
    inset?: number
  }
}

/** Collapse adjacent data where one band per datum would be thinner than `minBandPx`. */
export type BandFold<T> = {
  /** Floor on a drawn band's px width. Default 3. */
  minBandPx?: number
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
  states: readonly BandStripState<T>[]
  /** Which state, fill and marker each datum has. Memoize it: a new function recompiles the chart. */
  getBand: (d: T) => BandSpan
  fold?: BandFold<T>
}

const DEFAULT_MIN_BAND_PX = 3
const DEFAULT_MARKER_INSET = 6

/** The whole strip is one row: a fixed unit domain, no ticks, no grid. */
const STRIP_AXIS = { domain: [0, 1], ticks: [], grid: false } as const satisfies AxisConfig<unknown>

/** Forces the rung's hidden `[0, 1]` x scale (`zx`) into existence; draws nothing. */
const ZX_ANCHOR = [{ fill: 'transparent' }] as const

/** Rendered by a `formatValue` that returned `null`. */
const NO_READING = '—'

/** A band whose state is not in `states`: a typo in dev, a neutral tint in production. */
const UNKNOWN_FILL = alpha(VX.neutral, 0.2)

type Cell = { f0: number; f1: number; y0: number; y1: number }

/** Adjacent data in groups of equal size, the last possibly shorter; `cap` is the max group count. */
function groupsOf<T>(data: readonly T[], cap: number): { start: number; items: T[] }[] {
  const size = Math.max(1, Math.ceil(data.length / Math.max(cap, 1)))
  const out: { start: number; items: T[] }[] = []
  for (let i = 0; i < data.length; i += size) out.push({ start: i, items: data.slice(i, i + size) })
  return out
}

export function BandStrip<T, X extends ChartX = ChartX>(props: BandStripProps<T, X>): ReactElement {
  const { states, getBand, fold, cursorResolution = 'leading', tooltip, ...rest } = props
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
        getValue: (d) => (getBand(d).state === s.key ? 1 : null),
        formatValue: (_v, d) => (s.formatValue ? (s.formatValue(d) ?? NO_READING) : ''),
      })),
    [states, getBand],
  )

  const marks = useCallback(
    (plot: PlotContext<T, X>): ChartMarks => {
      const byKey = new Map(states.map((s) => [s.key, s]))
      const visible = new Set(plot.visible.map((s) => s.key))
      const cap = Math.floor(plot.width / (fold?.minBandPx ?? DEFAULT_MIN_BAND_PX))
      const groups =
        fold && data.length > cap
          ? groupsOf(data, cap).map((g) => ({
              start: g.start,
              len: g.items.length,
              datum: g.items.length === 1 ? (g.items[0] as T) : fold.merge(g.items),
            }))
          : data.map((datum, start) => ({ start, len: 1, datum }))

      const fills = new Map<string, Cell[]>()
      const hits: PlotRow<T, X>[] = []
      const paint = (color: string, cell: Cell): void => {
        const cells = fills.get(color)
        if (cells) cells.push(cell)
        else fills.set(color, [cell])
      }
      const n = data.length
      for (const g of groups) {
        const span = getBand(g.datum)
        const state = byKey.get(span.state)
        if (!state && process.env.NODE_ENV !== 'production')
          throw new Error(
            `BandStrip: state "${span.state}" names no \`states\` entry (known: ${[...byKey.keys()].join(', ')})`,
          )
        if (state && !visible.has(span.state)) continue
        const f0 = g.start / n
        const f1 = (g.start + g.len) / n
        paint(span.fill ?? (state ? alpha(state.color, state.fillOpacity ?? 1) : UNKNOWN_FILL), {
          f0,
          f1,
          y0: 0,
          y1: 1,
        })
        const marker = span.marker
        const markerState = byKey.get(marker?.state ?? span.state)
        if (marker && markerState && visible.has(markerState.key)) {
          const inset = (marker.inset ?? DEFAULT_MARKER_INSET) / Math.max(plot.height, 1)
          paint(markerState.color, { f0, f1, y0: inset, y1: 1 - inset })
        }
        for (let i = g.start; i < g.start + g.len; i++)
          hits.push({ x: x(data[i] as T), y: 1, series: span.state, datum: g.datum })
      }

      return [
        ...[...fills].map(([fill, cells], i) =>
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
            }),
          ),
        ),
        barY(hits, { id: 'hit', x: rowX, y1: 0, y2: 1, fill: 'transparent' }),
      ]
    },
    [states, getBand, fold, data, x],
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
