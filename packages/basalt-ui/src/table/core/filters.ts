/**
 * Filter predicates of the table (docs/v3/concepts/data-table.md sections 3 and 8, invariant I17).
 * Pure and engine-agnostic: a predicate takes anything with `getValue(columnId)`, so the same
 * function runs as a TanStack `filterFn`, over plain rows in a test, and in `core/state`.
 *
 * Law:
 * - `contains` (text kinds) is a case-insensitive substring of the cell, any value of the model.
 * - `anyOf` (enum kinds: `status`, `select`, `boolean`) is the EXACT string, any value of the
 *   model. `Eng` never matches `Engineering`; the 2.x substring match was the bug (I17). A boolean
 *   cell compares as `true` or `false`.
 * - `range` (numeric and date kinds) is `[from, to]`, both ends inclusive, either end `''` for an
 *   open side. A numeric column compares numbers; a date column compares calendar days
 *   (`YYYY-MM-DD`), the day an instant falls on in the table's time zone, so the filter keeps the
 *   rows whose cell prints a day inside the range. An absent cell never passes a set range.
 * - A model with no usable value filters nothing and `autoRemove` drops it from the engine state.
 * - A filter on a column id the table does not have throws in development and is dropped in
 *   production, so a stale saved view cannot blank a table.
 */
import type { FilterModel } from '../contract'

export type FilterOp = FilterModel['op']

/** What a `range` compares: numbers, or calendar days in `zone` (`undefined` is the runtime's zone). */
export type RangeDomain = { kind: 'number' } | { kind: 'day'; zone: string | undefined }

const NUMBER: RangeDomain = { kind: 'number' }

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

const isText = (entry: unknown): entry is string => typeof entry === 'string' && entry !== ''

/** The values a model really filters by: strings, never empty. */
export function usableValues(values: readonly unknown[] | undefined): string[] {
  return (values ?? []).filter(isText)
}

/** A range's two ends as text, `''` for an open side; anything past the second entry is ignored. */
export function rangeEnds(values: readonly unknown[] | undefined): [string, string] {
  const end = (value: unknown): string => (isText(value) ? value.trim() : '')
  return [end(values?.[0]), end(values?.[1])]
}

/** Whether a model's values filter anything: one usable value, or one set end of a range. */
export function isUsable(op: FilterOp, values: readonly unknown[] | undefined): boolean {
  if (op === 'range') return rangeEnds(values).some((end) => end !== '')
  return usableValues(values).length > 0
}

/** A number written as text, `null` for anything that is not one finite number. */
export function numberOf(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayFormats = new Map<string, Intl.DateTimeFormat>()

/**
 * The calendar day a cell falls on in `zone`, as `YYYY-MM-DD`: a zone-less day stays that day, an
 * ISO instant, a `Date` or epoch ms is read in the zone. `null` for anything else.
 */
export function dayOf(cell: unknown, zone: string | undefined): string | null {
  if (typeof cell === 'string' && DAY.test(cell)) return cell
  const date =
    cell instanceof Date
      ? cell
      : typeof cell === 'number' || typeof cell === 'string'
        ? new Date(cell)
        : null
  if (date === null || Number.isNaN(date.getTime())) return null
  const key = zone ?? ''
  let format = dayFormats.get(key)
  if (format === undefined) {
    // en-CA prints the parts in ISO order; the parts are read by type, so the order does not matter.
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dayFormats.set(key, format)
  }
  const parts = format.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
}

function inRange(cell: unknown, values: readonly string[], domain: RangeDomain): boolean {
  const [from, to] = rangeEnds(values)
  if (from === '' && to === '') return true
  if (domain.kind === 'day') {
    const day = dayOf(cell, domain.zone)
    if (day === null) return false
    return (from === '' || day >= from) && (to === '' || day <= to)
  }
  if (typeof cell !== 'number' || !Number.isFinite(cell)) return false
  const low = numberOf(from)
  const high = numberOf(to)
  return (low === null || cell >= low) && (high === null || cell <= high)
}

/** Whether one cell value passes one model; `contains`, `anyOf` and `range` as defined above. */
export function matchesFilter(
  op: FilterOp,
  cell: unknown,
  values: readonly string[],
  domain: RangeDomain = NUMBER,
): boolean {
  if (op === 'range') return inRange(cell, values, domain)
  const wanted = usableValues(values)
  if (wanted.length === 0) return true
  const text = textOf(cell)
  if (text === null) return false
  if (op === 'anyOf') return wanted.includes(text)
  const haystack = text.toLowerCase()
  return wanted.some((needle) => haystack.includes(needle.toLowerCase()))
}

function build(op: FilterOp, domain: RangeDomain): FilterFn {
  const fn = ((row, columnId, filterValue) =>
    matchesFilter(op, row.getValue(columnId), filterValue, domain)) as FilterFn
  fn.autoRemove = (filterValue) =>
    !Array.isArray(filterValue) || !isUsable(op, filterValue as readonly unknown[])
  return fn
}

const FILTER_FNS = new Map<string, FilterFn>()

/**
 * The `filterFn` of an operator, one stable function per operator and range domain (the engine
 * compares by identity, and a per-render function would re-run the filtered row model every render).
 */
export function constructFilterFn(op: FilterOp, domain: RangeDomain = NUMBER): FilterFn {
  const key =
    op === 'range' ? `range|${domain.kind}|${domain.kind === 'day' ? (domain.zone ?? '') : ''}` : op
  let fn = FILTER_FNS.get(key)
  if (fn === undefined) {
    fn = build(op, domain)
    FILTER_FNS.set(key, fn)
  }
  return fn
}

/** The engine's `columnFilters` entry: `value` is the model's value list (a range's two ends). */
export type ColumnFilter = { id: string; value: readonly string[] }

/** The values a model filters by in the engine: the usable list, or a range's two ends. */
export function filterValueOf(model: FilterModel): readonly string[] {
  return model.op === 'range' ? rangeEnds(model.values) : usableValues(model.values)
}

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
    if (isUsable(model.op, model.values)) out.push({ id: model.id, value: filterValueOf(model) })
  }
  return out
}

/**
 * Whether a row passes every model (AND across columns); the reference for the engine path.
 * `domainOf` names what a `range` column compares (numbers when it is absent).
 */
export function rowMatches(
  filters: readonly FilterModel[],
  row: FilterRow,
  known: ReadonlySet<string>,
  domainOf?: (columnId: string) => RangeDomain,
): boolean {
  return toColumnFilters(filters, known).every((entry) => {
    const model = filters.find((f) => f.id === entry.id)
    const domain = domainOf?.(entry.id) ?? NUMBER
    return constructFilterFn(model?.op ?? 'contains', domain)(row, entry.id, entry.value)
  })
}
