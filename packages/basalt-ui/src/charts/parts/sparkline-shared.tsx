/**
 * What `Sparkline` and `MiniBars` share (docs/v3/concepts/charts-cards-kanban.md sections 3, 4): the
 * point rows, the pooling, the text alternative and the one frame that is a plain image with a name
 * until `axisLabels` makes it able to answer. Hand SVG and HTML on `core/compile-spark.ts`; no
 * engine, no tooltip (S2, `docs/v3/spikes/charts-s2.md`).
 */
import { useId, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import { NON_FINITE, useFormat } from '../../core/format'
import type { Format } from '../../core/format'
import type { SparkPoint } from '../contract'

/** The label row under the plot, px. A box of height 72 is a 56 plot and this row. */
export const LABEL_ROW = 16
/** Air round a line's plot, px: the now dot and the stroke at the extremes stay inside the box. */
export const PLOT_INSET = 3
/** The densest a pooled line or bar series may draw (one point per pixel of a 480 px cell, halved). */
export const LINE_CAP = 240
export const BAR_CAP = 120
/** The glyph `offScaleMarks` draws past a bounded axis; a capped spark point takes the same. */
export const OFF_SCALE_CARET = '▲'

/** A point: its value, date and name, and `n`, its 1-based place in the series the page gave. */
export type Row = { v: number | null; at: Date | null; label: string | null; n: number }

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)

const toDate = (at: Date | number): Date | null => {
  const d = at instanceof Date ? at : new Date(at)
  return Number.isNaN(d.getTime()) ? null : d
}

/** A non-finite value is a gap (`null`), never a zero. */
export function toRows(series: readonly SparkPoint[]): Row[] {
  return series.map((p, i) => {
    if (typeof p === 'object' && p !== null) {
      return {
        v: finite(p.value) ? p.value : null,
        at: p.at === undefined ? null : toDate(p.at),
        label: p.label === undefined || p.label === '' ? null : p.label,
        n: i + 1,
      }
    }
    return { v: finite(p) ? p : null, at: null, label: null, n: i + 1 }
  })
}

const GAP = (from: Row | undefined): Row => ({
  v: null,
  at: from?.at ?? null,
  label: null,
  n: from?.n ?? 0,
})

/** The rows of a run of finite values that hold its peak and its dip, in order. */
function peaks(run: readonly Row[]): Row[] {
  if (run.length <= 2) return [...run]
  let lo = 0
  let hi = 0
  run.forEach((r, i) => {
    if ((r.v as number) < (run[lo]!.v as number)) lo = i
    if ((r.v as number) > (run[hi]!.v as number)) hi = i
  })
  return lo === hi ? [run[lo]!] : [run[Math.min(lo, hi)]!, run[Math.max(lo, hi)]!]
}

/**
 * Self-pooling: a series longer than `cap` keeps, per bucket, the peak and the dip of a line (the
 * value furthest from zero of a bar) and every gap, so a spike survives and a gap is never closed.
 * A series within its cap comes back untouched.
 */
export function pool(rows: readonly Row[], cap: number, kind: 'line' | 'bar'): readonly Row[] {
  if (rows.length <= cap) return rows
  const buckets = kind === 'line' ? Math.floor(cap / 2) : cap
  const size = rows.length / buckets
  const out: Row[] = []
  const push = (r: Row): void => {
    if (r.v === null && out.at(-1)?.v === null) return
    out.push(r)
  }
  for (let b = 0; b < buckets; b++) {
    const slice = rows.slice(Math.floor(b * size), Math.floor((b + 1) * size))
    if (kind === 'bar') {
      let best: Row | undefined
      for (const r of slice)
        if (finite(r.v) && (!best || Math.abs(r.v) > Math.abs(best.v!))) best = r
      push(best ?? GAP(slice[0]))
      continue
    }
    let run: Row[] = []
    for (const r of slice) {
      if (finite(r.v)) {
        run.push(r)
        continue
      }
      for (const p of peaks(run)) push(p)
      run = []
      push(GAP(r))
    }
    for (const p of peaks(run)) push(p)
  }
  return out
}

export const meanOf = (rows: readonly Row[]): number | undefined => {
  let sum = 0
  let n = 0
  for (const r of rows) {
    if (!finite(r.v)) continue
    sum += r.v
    n++
  }
  return n === 0 ? undefined : sum / n
}

/** The default number format: compact, in the page locale. */
export const compactNumber = (f: Format) => (v: number) =>
  f.number(v, { notation: 'compact', maximumFractionDigits: 1 })

/**
 * A point's x: its `label`, else its day, else its place (`#8`), so a series of bare numbers still
 * reads an x beside its y.
 */
export function pointName(row: Row | undefined, f: Format): string | null {
  if (row === undefined) return null
  if (row.label !== null) return row.label
  if (row.at !== null) return f.date(row.at, 'short', { year: undefined })
  return row.n > 0 ? `#${f.number(row.n)}` : null
}

/** `42 · W41` for a named point, `42 · 12 Oct` for a dated one, `42 · #8` for a plain one, an em dash for a gap. */
export function readoutOf(row: Row | undefined, format: (v: number) => string, f: Format): string {
  if (row === undefined || !finite(row.v)) return NON_FINITE
  const name = pointName(row, f)
  return name === null ? format(row.v) : `${format(row.v)} · ${name}`
}

/**
 * The polite announcement of a step: `W41: 42` (the name first, as a sentence reads), `#8: 42` for
 * a plain point, `W41: no data` for a gap.
 */
export function announceOf(row: Row | undefined, format: (v: number) => string, f: Format): string {
  const name = pointName(row, f)
  const value = row === undefined || !finite(row.v) ? 'no data' : format(row.v)
  return name === null ? value : `${name}: ${value}`
}

/** The sentence every chart carries: min, max and last. */
export function summaryOf(rows: readonly Row[], format: (v: number) => string): string {
  let lo: number | undefined
  let hi: number | undefined
  let last: number | undefined
  for (const r of rows) {
    if (!finite(r.v)) continue
    if (lo === undefined || r.v < lo) lo = r.v
    if (hi === undefined || r.v > hi) hi = r.v
    last = r.v
  }
  if (lo === undefined || hi === undefined || last === undefined) return 'No data'
  return `Min ${format(lo)}, max ${format(hi)}, last ${format(last)}`
}

export type SparkFrameProps = {
  slot: 'sparkline' | 'mini-bars'
  ariaLabel: string
  summary: string
  height: number | 'fill'
  width: number | undefined
  axisLabels: readonly [string, string, string] | undefined
  rows: readonly Row[]
  readout: (row: Row | undefined) => string
  /** The sentence the live region reads for a step. */
  announce: (row: Row | undefined) => string
  /** The row under a pointer, from its x and the plot element. */
  indexAt: (clientX: number, plot: HTMLElement) => number
  children: (active: number | null) => ReactNode
}

/**
 * The frame. Without `axisLabels` it is an image with a name and no tab stop. With them it is a chart
 * host as the chart kinds are (a `group` described as a chart, one tab stop) that can answer: arrow
 * keys, Home and End (or a pointer) move a readout naming the point into the middle slot of the label
 * row, which at rest holds its own label, and a polite live region reads each step.
 */
export function SparkFrame(props: SparkFrameProps): ReactElement {
  const { slot, ariaLabel, summary, height, width, axisLabels, rows, readout, announce, indexAt } =
    props
  const summaryId = useId()
  const [active, setActive] = useState<number | null>(null)
  const interactive = axisLabels !== undefined && rows.length > 0
  const last = rows.length - 1
  const current = active ?? last
  const sized = typeof height === 'number' ? { height } : undefined

  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? current + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? current - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (step === null) return
    e.preventDefault()
    setActive(Math.min(last, Math.max(0, step)))
  }
  const onPointer = (e: PointerEvent<HTMLElement>): void => {
    setActive(indexAt(e.clientX, e.currentTarget))
  }

  const a11y = interactive
    ? ({
        role: 'group',
        'aria-roledescription': 'chart',
        tabIndex: 0,
        'data-active-index': active ?? undefined,
        onKeyDown,
        onFocus: () => setActive((a) => a ?? last),
        onBlur: () => setActive(null),
      } as const)
    : ({ role: 'img', tabIndex: -1 } as const)

  return (
    <div
      data-slot={slot}
      aria-label={ariaLabel}
      aria-describedby={summaryId}
      style={{ ...sized, width }}
      className={cn(
        'relative flex min-w-0 flex-col outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand',
        // A box that clips its overflow (a StatCard's chart) would cut the outer ring: it rings inside.
        "[[data-slot='stat-chart']_&]:-outline-offset-2",
        height === 'fill' && 'h-full',
        width === undefined && 'w-full',
      )}
      {...a11y}
    >
      <span id={summaryId} className="sr-only">
        {summary}
      </span>
      {interactive && (
        <span data-slot="spark-live" aria-live="polite" className="sr-only">
          {active === null ? '' : announce(rows[active])}
        </span>
      )}
      <div
        data-slot="spark-plot"
        className="relative mx-0.75 min-h-0 flex-1"
        {...(interactive
          ? {
              onPointerMove: onPointer,
              onPointerDown: onPointer,
              onPointerLeave: (e: PointerEvent<HTMLElement>) => {
                if (!e.currentTarget.parentElement?.contains(document.activeElement))
                  setActive(null)
              },
            }
          : {})}
      >
        {props.children(active)}
      </div>
      {axisLabels === undefined ? null : (
        <div
          data-slot="spark-labels"
          aria-hidden="true"
          className="grid h-4 shrink-0 grid-cols-[1fr_2fr_1fr] items-end text-xs leading-4 text-muted-foreground tabular-nums"
        >
          <span className="truncate">{axisLabels[0]}</span>
          {/* The readout's column is fixed, half the row: a reading changes its text, never the labels beside it. */}
          <span
            data-slot="chart-readout"
            className={cn('truncate px-1 text-center', active !== null && 'text-foreground')}
          >
            {active === null ? axisLabels[1] : readout(rows[active])}
          </span>
          <span className="truncate justify-self-end">{axisLabels[2]}</span>
        </div>
      )}
    </div>
  )
}

/** `format` defaulted to the compact page-locale number, plus the formatter for dated readouts. */
export function useSparkFormat(format: ((v: number) => string) | undefined): {
  f: Format
  fmt: (v: number) => string
} {
  const f = useFormat()
  return { f, fmt: format ?? compactNumber(f) }
}
