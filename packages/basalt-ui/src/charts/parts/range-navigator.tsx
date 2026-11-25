/**
 * `RangeNavigator` — the overview strip under a long time series: the whole history drawn small, the
 * window the chart above shows held by a brush (the engine's `brushX`: drag it, drag either handle,
 * or step a handle with the arrow keys), and the window kept in a `field.range` handle. A preset of
 * the handle is a span back from the last datum (`spans`); a brush commit writes `custom` with two
 * ISO days, so the URL, the presets and the brush are one state. `RangeNavigator.window` turns the same
 * value into the main chart's `x.domain` and rows.
 *
 * @useWhen a series spans far more time than one plot can show (years of daily data) and the reader picks the window
 * @neverWhen the history fits the plot (draw it whole), or the window is a filter of a table (use the range field's own control)
 */
import { brushX } from '@tanstack/charts/interaction/brush'
import type { BrushRange, BrushXChange } from '@tanstack/charts/interaction/brush'
import { controlledSignal } from '@tanstack/charts/interaction/signal'
import { useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { RangeValue } from '../../router/controls/codec'
import { alpha } from '../../tokens'
import type { ChartName, SeriesColor } from '../contract'
import { CV } from '../core/theme'
import { shortDate } from './tooltip'
import { CartesianPlot } from './cartesian'
import classes from './range-navigator.module.css'

/** Each preset's span in days back from the last datum, or `'all'` for the whole history. */
export type ChartWindowSpans<P extends string> = Readonly<Record<P, number | 'all'>>

/**
 * What the navigator reads and writes: a `field.range({ presets, custom: true })` handle, whose value
 * is a preset or `custom` with two ISO days.
 */
export type WindowHandle<P extends string> = {
  use(): readonly [RangeValue<P | 'custom'>, (value: RangeValue<P | 'custom'>) => void]
  /** The presets with their `.labels()`: the navigator's preset row. */
  readonly options?: readonly { readonly value: string; readonly label: string }[] | undefined
}

/** The window a chart shows: its x domain and the rows that reach into it. */
export type ChartWindow<D> = { domain: readonly [Date, Date]; data: readonly D[] }

const DAY_MS = 86_400_000

const isoDay = (t: number): string => new Date(t).toISOString().slice(0, 10)
const dayOf = (iso: string): number => Date.parse(`${iso}T00:00:00Z`)

/**
 * The window a range value picks out of `data` (sorted by `x`): a preset's span back from the last
 * datum (`'all'` the whole), a custom value its two days, both clamped to the data and snapped to the
 * nearest data inside. `data` keeps the rows inside plus one on each side, so the line runs to the
 * plot's edges. An empty `data` gives the epoch and no rows.
 *
 * `RangeNavigator.window`.
 *
 * @example
 * const view = RangeNavigator.window(rows, (d) => d.t, range, { '6m': 182, '1y': 365, all: 'all' })
 * <CartesianChart data={view.data} x={{ value: (d) => d.t, domain: view.domain }} … />
 */
export function chartWindow<D, P extends string>(
  data: readonly D[],
  x: (d: D) => Date,
  value: RangeValue<P | 'custom'>,
  spans: ChartWindowSpans<P>,
): ChartWindow<D> {
  const times = data.map((d) => x(d).getTime())
  const first = times[0]
  const last = times.at(-1)
  if (first === undefined || last === undefined) return { domain: [new Date(0), new Date(0)], data }
  let [lo, hi] = [first, last]
  if (value.preset === 'custom' && value.from !== undefined && value.to !== undefined) {
    lo = dayOf(value.from)
    hi = dayOf(value.to)
  } else {
    const span = spans[value.preset as P]
    if (typeof span === 'number') lo = last - span * DAY_MS
  }
  lo = Math.max(first, Math.min(lo, last))
  hi = Math.min(last, Math.max(hi, lo))
  const from = times.findIndex((t) => t >= lo)
  const to = times.findLastIndex((t) => t <= hi)
  if (from < 0 || to < from) return { domain: [new Date(lo), new Date(hi)], data: [] }
  return {
    domain: [new Date(times[from] as number), new Date(times[to] as number)],
    data: data.slice(Math.max(from - 1, 0), to + 2),
  }
}

export type RangeNavigatorProps<D, P extends string> = ChartName & {
  /** The whole history, sorted by `x`. */
  data: readonly D[]
  x: (d: D) => Date
  y: (d: D) => number | null
  color: SeriesColor
  /** The window: a `field.range({ presets, custom: true })` handle; the presets are `spans`' keys. */
  window: WindowHandle<P>
  spans: ChartWindowSpans<P>
  /** The strip's height in px (default 64), or `'fill'`: the preset row and the strip take the parent's height (a `ChartCard` pane). */
  height?: number | 'fill' | undefined
  /** `log` for a history over orders of magnitude, as the main chart draws it. */
  scale?: 'linear' | 'log' | undefined
  /** Writes the handles' values for assistive tech. Default: the short date (`Sep 14, 2026`). */
  format?: ((d: Date) => string) | undefined
  /**
   * The preset row above the strip, one option per key of `spans` labelled as the handle labels it.
   * `false` leaves the presets to a control elsewhere on the page. Default: shown.
   */
  presets?: false | undefined
}

const NAVIGATOR_HEIGHT = 64

/**
 * The overview of a long series with its window held by a brush, and the preset row above it.
 * `RangeNavigator.window(data, x, value, spans)` is the window the main chart draws: its `x.domain`
 * and the rows that reach into it.
 *
 * @useWhen a series spans far more time than one plot can show (years of daily data) and the reader picks the window
 * @neverWhen the history fits the plot (draw it whole), or the window is a table filter (use the range field's own control)
 */
export function RangeNavigator<D, P extends string>(
  props: RangeNavigatorProps<D, P>,
): ReactElement {
  const { data, x, window: handle, spans } = props
  const [value, setValue] = handle.use()
  const group = `basalt-navigator-${useId()}`
  const [preview, setPreview] = useState<BrushRange<Date> | null>(null)
  const chosen = chartWindow(data, x, value, spans).domain
  const range = preview ?? { start: chosen[0], end: chosen[1] }
  const values = useMemo(() => data.map(x), [data, x])
  const format = props.format ?? shortDate
  const controls = [
    brushX<Date>({
      range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(range, (next, { reason }) => {
        if (reason.type === 'preview') setPreview(next)
        else setPreview(null)
        if (reason.type !== 'commit') return
        const [a, b] = [next.start.getTime(), next.end.getTime()].toSorted((p, q) => p - q)
        setValue({ preset: 'custom', from: isoDay(a as number), to: isoDay(b as number) })
      }),
      values,
      format: (d) => format(d),
      ariaLabel: props.label,
      startAriaLabel: 'Window start',
      endAriaLabel: 'Window end',
      selectionStyle: { fill: alpha(CV.brand, 0.14), stroke: CV.brand, strokeWidth: 1 },
      handleStyle: { fill: CV.surface, stroke: CV.brand, strokeWidth: 1.5 },
    }),
  ]
  const fill = props.height === 'fill'
  const keys = Object.keys(spans) as P[]
  const labelOf = (key: string): string =>
    handle.options?.find((o) => o.value === key)?.label ?? key
  const strip = (
    <CartesianPlot<D>
      label={props.label}
      data={data}
      x={{ value: x }}
      y={{ ...(props.scale === 'log' && { scale: 'log' as const }) }}
      series={[
        {
          mark: 'line',
          key: 'overview',
          label: props.label,
          color: props.color,
          y: props.y,
          weight: 'quiet',
          ...(props.scale !== 'log' && { area: 'fade' as const }),
        },
      ]}
      height={fill ? 'fill' : (props.height ?? NAVIGATOR_HEIGHT)}
      tooltip={false}
      cursor={group}
      naming="legend"
      controls={controls}
    />
  )
  // A filled strip takes what the preset row leaves: its chart root is stretched as a pane's is.
  const body = fill ? <div className={FILL_SLOT}>{strip}</div> : strip
  if (props.presets === false) return fill ? <div style={fillColumn}>{body}</div> : strip
  return (
    <div style={fill ? fillColumn : column} data-basalt-navigator="">
      <fieldset aria-label={`${props.label}: window`} className={classes.presets}>
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className={classes.preset}
            aria-pressed={value.preset === key}
            onClick={() => setValue({ preset: key })}
          >
            {labelOf(key)}
          </button>
        ))}
      </fieldset>
      {body}
    </div>
  )
}

RangeNavigator.window = chartWindow

/** The classes a `ChartCard` pane stretches its chart with (`chart-panes.tsx`). */
const FILL_SLOT = 'min-h-0 flex-1 [&>[data-basalt-chart]]:h-full'

const column: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }
const fillColumn: CSSProperties = { ...column, height: '100%', minHeight: 0 }
