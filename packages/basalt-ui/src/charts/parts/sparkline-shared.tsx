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

export type Row = { v: number | null; at: Date | null }

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)

const toDate = (at: Date | number): Date | null => {
  const d = at instanceof Date ? at : new Date(at)
  return Number.isNaN(d.getTime()) ? null : d
}

/** A non-finite value is a gap (`null`), never a zero. */
export function toRows(series: readonly SparkPoint[]): Row[] {
  return series.map((p) => {
    if (typeof p === 'object' && p !== null) {
      return { v: finite(p.value) ? p.value : null, at: toDate(p.at) }
    }
    return { v: finite(p) ? p : null, at: null }
  })
}

const GAP = (at: Date | null): Row => ({ v: null, at })

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
      push(best ?? GAP(slice[0]?.at ?? null))
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
      push(GAP(r.at))
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

/** `42 · 12 Oct` for a dated point, `42` for a plain one, an em dash for a gap. */
export function readoutOf(row: Row | undefined, format: (v: number) => string, f: Format): string {
  if (row === undefined || !finite(row.v)) return NON_FINITE
  return row.at === null
    ? format(row.v)
    : `${format(row.v)} · ${f.date(row.at, 'short', { year: undefined })}`
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
  /** The row under a pointer, from its x and the plot element. */
  indexAt: (clientX: number, plot: HTMLElement) => number
  children: (active: number | null) => ReactNode
}

/**
 * The frame. Without `axisLabels` it is an image with a name and no tab stop. With them it is a
 * `slider` that can answer: arrow keys, Home and End (or a pointer) move a readout into the middle
 * slot of the label row, which at rest holds its own label.
 */
export function SparkFrame(props: SparkFrameProps): ReactElement {
  const { slot, ariaLabel, summary, height, width, axisLabels, rows, readout, indexAt } = props
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
        role: 'slider',
        tabIndex: 0,
        'aria-orientation': 'horizontal',
        'aria-valuemin': 0,
        'aria-valuemax': last,
        'aria-valuenow': current,
        'aria-valuetext': readout(rows[current]),
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
        height === 'fill' && 'h-full',
        width === undefined && 'w-full',
      )}
      {...a11y}
    >
      <span id={summaryId} className="sr-only">
        {summary}
      </span>
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
          className="grid h-4 shrink-0 grid-cols-[1fr_auto_1fr] items-end text-xs leading-4 text-muted-foreground tabular-nums"
        >
          <span className="truncate">{axisLabels[0]}</span>
          <span className={cn('truncate px-1', active !== null && 'text-foreground')}>
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
