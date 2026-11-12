/**
 * The footer reduce (docs/v3/concepts/data-table.md section 3, Footer): one pass over the flat rows
 * a footer or a group row speaks for. Absent values (`null`, `undefined`, a non-number) are skipped,
 * never read as zero, so `count` is the rows that HAVE a value and `mean` divides by that count.
 * Nothing to reduce is `null`, which the cell draws as absent.
 */
import type { Totals } from '../contract'
import type { Aggregate, KindSpec } from '../core/kinds-spec'

export function aggregate<T>(
  fn: Aggregate,
  rows: readonly T[],
  value: (row: T) => unknown,
): number | null {
  let count = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (const row of rows) {
    const v = value(row)
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    count += 1
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (fn === 'count') return count
  if (count === 0) return null
  switch (fn) {
    case 'sum':
      return sum
    case 'mean':
      return sum / count
    case 'min':
      return min
    case 'max':
      return max
  }
}

/** What one footer cell holds: a reduced number, a server value, or absent. */
export type FooterValue = { kind: 'number'; value: number } | { kind: 'text'; value: string } | null

/**
 * The footer value of a column. Client mode reduces `rows` (every row matching the request, not the
 * page); server mode reads `totals` and is absent without them: a page sum is never a total.
 */
export function footerValue<T>(
  spec: KindSpec<T>,
  source: { kind: 'client'; rows: readonly T[] } | { kind: 'server'; totals: Totals | undefined },
): FooterValue {
  const footer = spec.footer
  if (footer === undefined) return null
  if (source.kind === 'server') {
    const v = source.totals?.[spec.id]
    if (v === undefined || v === null) return null
    return typeof v === 'number' ? { kind: 'number', value: v } : { kind: 'text', value: v }
  }
  const v = aggregate(footer.fn, source.rows, spec.value)
  return v === null ? null : { kind: 'number', value: v }
}
