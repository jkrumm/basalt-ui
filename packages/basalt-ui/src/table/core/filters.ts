/**
 * Filter predicates of the table (docs/v3/concepts/data-table.md sections 3 and 8, invariant I17).
 * Pure and engine-agnostic: a predicate takes anything with `getValue(columnId)`, so the same
 * function runs as a TanStack `filterFn`, over plain rows in a test, and in `core/state`.
 *
 * Law:
 * - `contains` (text kinds) is a case-insensitive substring of the cell, any value of the model.
 * - `anyOf` (enum kinds) is the EXACT string, any value of the model. `Eng` never matches
 *   `Engineering`; the 2.x substring match was the bug (I17).
 * - A model with no usable value filters nothing and `autoRemove` drops it from the engine state.
 * - A filter on a column id the table does not have throws in development and is dropped in
 *   production, so a stale saved view cannot blank a table.
 */
import type { FilterModel } from '../contract'

export type FilterOp = FilterModel['op']

/** The row shape a predicate needs; a TanStack `Row` satisfies it. */
export type FilterRow = { getValue(columnId: string): unknown }

/**
 * The predicate of one operator. Its shape is TanStack's `FilterFn`: `(row, columnId, filterValue)`
 * with an `autoRemove` rule, so `constructFilterFn(op)` registers on a column unchanged.
 */
export type FilterFn = {
  (row: FilterRow, columnId: string, filterValue: readonly string[]): boolean
  autoRemove(filterValue: unknown): boolean
}

/** A cell value as the string a filter compares; absent values and objects have none. */
function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return null
}

const isUsable = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.some((entry) => typeof entry === 'string' && entry !== '')

/** The values a model really filters by: strings, never empty. */
export function usableValues(values: readonly unknown[] | undefined): string[] {
  return (values ?? []).filter((v): v is string => typeof v === 'string' && v !== '')
}

/** Whether one cell value passes one model; `contains` and `anyOf` as defined above. */
export function matchesFilter(op: FilterOp, cell: unknown, values: readonly string[]): boolean {
  const wanted = usableValues(values)
  if (wanted.length === 0) return true
  const text = textOf(cell)
  if (text === null) return false
  if (op === 'anyOf') return wanted.includes(text)
  const haystack = text.toLowerCase()
  return wanted.some((needle) => haystack.includes(needle.toLowerCase()))
}

function build(op: FilterOp): FilterFn {
  const fn = ((row, columnId, filterValue) =>
    matchesFilter(op, row.getValue(columnId), filterValue)) as FilterFn
  fn.autoRemove = (filterValue) => !isUsable(filterValue)
  return fn
}

const FILTER_FNS: Readonly<Record<FilterOp, FilterFn>> = {
  contains: build('contains'),
  anyOf: build('anyOf'),
}

/**
 * The `filterFn` of an operator, one stable function per operator (the engine compares by
 * identity, and a per-render function would re-run the filtered row model every render).
 */
export function constructFilterFn(op: FilterOp): FilterFn {
  return FILTER_FNS[op]
}

/** The engine's `columnFilters` entry: `value` is the model's value list. */
export type ColumnFilter = { id: string; value: readonly string[] }

/**
 * `request.filters` as engine state. Models with no usable value are dropped (the `autoRemove`
 * rule applied up front), and an id outside `known` throws in development, else is dropped.
 */
export function toColumnFilters(
  filters: readonly FilterModel[],
  known: ReadonlySet<string>,
): ColumnFilter[] {
  const out: ColumnFilter[] = []
  for (const model of filters) {
    if (!known.has(model.id)) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          `basalt-ui/table: filter on "${model.id}", but no column has that id (columns: ${[...known].join(', ')})`,
        )
      }
      continue
    }
    const value = usableValues(model.values)
    if (value.length > 0) out.push({ id: model.id, value })
  }
  return out
}

/** Whether a row passes every model (AND across columns); the reference for the engine path. */
export function rowMatches(
  filters: readonly FilterModel[],
  row: FilterRow,
  known: ReadonlySet<string>,
): boolean {
  return toColumnFilters(filters, known).every((entry) => {
    const model = filters.find((f) => f.id === entry.id)
    return constructFilterFn(model?.op ?? 'contains')(row, entry.id, entry.value)
  })
}
