/**
 * The footer reduce (docs/v3/concepts/data-table.md section 3, Footer): one pass over the flat rows
 * a footer or a group row speaks for. Absent values (`null`, `undefined`, `''`, `NaN`) are skipped,
 * never read as zero, so `count` is the rows that HAVE a value and `mean` divides by the numbers
 * it read. Nothing to reduce is `null`, which the cell draws as absent.
 *
 * Which reduce a column prints is the view's: a reader's pick (`display.aggregates`) from what the
 * kind allows, else the declared `footer`. A server table prints the server's `totals` and takes no
 * pick: a page sum is never a total.
 */
import type { Aggregate, TableDisplay, Totals } from '../contract'
import type { KindSpec } from '../core/kinds-spec'

/** A numeric kind's reduces, in the order a footer cell cycles them. */
export const NUMERIC_AGGREGATES: readonly Aggregate[] = ['sum', 'mean', 'min', 'max', 'count']

const NO_AGGREGATES: readonly Aggregate[] = []
const COUNT_ONLY: readonly Aggregate[] = ['count']

/** Whether a cell value counts as present: not `null`, `undefined`, `''`, an empty list or `NaN`. */
function present(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  return typeof v !== 'number' || !Number.isNaN(v)
}

export function aggregate<T>(
  fn: Aggregate,
  rows: readonly T[],
  value: (row: T) => unknown,
): number | null {
  let count = 0
  let numbers = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (const row of rows) {
    const v = value(row)
    if (!present(v)) continue
    count += 1
    if (typeof v !== 'number') continue
    numbers += 1
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (fn === 'count') return count
  if (numbers === 0) return null
  switch (fn) {
    case 'sum':
      return sum
    case 'mean':
      return sum / numbers
    case 'min':
      return min
    case 'max':
      return max
  }
}

/**
 * What a reader may pick for a column's footer: every reduce on a numeric kind (`number`, `money`),
 * `count` on any other kind with a value, nothing on `actions`, `spark` and `custom`.
 */
export function aggregatesOf<T>(
  spec: Pick<KindSpec<T>, 'kind' | 'footer' | 'drawTotal'>,
): readonly Aggregate[] {
  if (spec.footer !== undefined || spec.drawTotal !== undefined) return NUMERIC_AGGREGATES
  if (spec.kind === 'actions' || spec.kind === 'spark' || spec.kind === 'custom')
    return NO_AGGREGATES
  return COUNT_ONLY
}

/**
 * The reduce a column prints: the reader's pick when the kind allows it (`'none'` drops the declared
 * one), else the declared `footer`. A server table prints its declared footer only.
 */
export function aggregateOf<T>(
  spec: Pick<KindSpec<T>, 'id' | 'kind' | 'footer' | 'drawTotal'>,
  picked: TableDisplay['aggregates'],
  server: boolean,
): Aggregate | undefined {
  const declared = spec.footer?.fn
  if (server) return declared
  const pick = picked?.[spec.id]
  if (pick === 'none') return undefined
  if (pick !== undefined && aggregatesOf(spec).includes(pick)) return pick
  return declared
}

/**
 * The next reduce of a footer cell's cycle: the allowed ones in order, then none, then the first
 * again. The declared one is where a fresh column starts.
 */
export function nextAggregate(
  allowed: readonly Aggregate[],
  current: Aggregate | undefined,
): Aggregate | 'none' {
  if (current === undefined) return allowed[0] ?? 'none'
  const at = allowed.indexOf(current)
  return at === -1 || at === allowed.length - 1 ? 'none' : allowed[at + 1]!
}

/** What one footer cell holds: a reduced number, a server value, or absent. */
export type FooterValue = { kind: 'number'; value: number } | { kind: 'text'; value: string } | null

/**
 * The footer value of a column under reduce `fn` (absent: nothing). Client mode reduces `rows`
 * (every row matching the request, not the page); server mode reads `totals` and is absent without
 * them: a page sum is never a total.
 */
export function footerValue<T>(
  spec: KindSpec<T>,
  source: { kind: 'client'; rows: readonly T[] } | { kind: 'server'; totals: Totals | undefined },
  fn: Aggregate | undefined = spec.footer?.fn,
): FooterValue {
  if (fn === undefined) return null
  if (source.kind === 'server') {
    const v = source.totals?.[spec.id]
    if (v === undefined || v === null) return null
    return typeof v === 'number' ? { kind: 'number', value: v } : { kind: 'text', value: v }
  }
  const v = aggregate(fn, source.rows, spec.value)
  return v === null ? null : { kind: 'number', value: v }
}
