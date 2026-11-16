/**
 * Compile-time proof of the table contract's "never" rows (docs/v3/concepts/data-table.md section
 * 9): one `@ts-expect-error` per bad line, proven by `tsc --noEmit`. Types only; nothing runs.
 */
import type { ControlHandle, VirtualLike } from '../core/ports'
import { useDataTable } from './use-data-table'
import type { DataTableInstance, DataTableProps, KindColumn, Mode, UseDataTable } from './contract'

type Row = { id: string }

const getRowId = (row: Row) => row.id
const noColumns: readonly KindColumn<Row>[] = []
declare const virtual: VirtualLike
declare const instance: DataTableInstance<Row>

function acceptUse(props: UseDataTable<Row>): UseDataTable<Row> {
  return props
}
function table(props: DataTableProps<Row>): DataTableProps<Row> {
  return props
}
function mode(m: Mode): Mode {
  return m
}

const base = { id: 't', label: 'T', columns: noColumns, data: [], getRowId }

// ── Valid: must type-check ────────────────────────────────────────────────────────────────

mode({ kind: 'client' })
mode({ kind: 'server', rowCount: undefined })
mode({ kind: 'server', cursor: { hasNext: true, fetchNext: () => undefined } })
acceptUse({ ...base, mode: { kind: 'client' }, detail: () => null })
acceptUse({ ...base, mode: { kind: 'client' }, onRowActivate: () => undefined })
table({ table: instance })
table({ table: instance, height: 'auto' })
table({ table: instance, height: 'fill', virtual })

// ── Invalid: each line must fail ──────────────────────────────────────────────────────────

// @ts-expect-error a client table has no rowCount
mode({ kind: 'client', rowCount: 10 })

// @ts-expect-error rowCount and cursor are exclusive
mode({ kind: 'server', rowCount: 10, cursor: { hasNext: false, fetchNext: () => undefined } })

acceptUse({
  ...base,
  mode: { kind: 'client' },
  // @ts-expect-error a raw column (no KindColumn brand) is not a column
  columns: [{ id: 'x', header: 'X' }],
})

// @ts-expect-error virtual needs a definite scrollport, not height 'auto'
table({ table: instance, height: 'auto', virtual })

// @ts-expect-error detail and onRowActivate are exclusive
acceptUse({ ...base, mode: { kind: 'client' }, detail: () => null, onRowActivate: () => undefined })

// ── Page filters: a predicate's value is its own field's value ────────────────────────────

type Order = { project: string; amount: number }
declare const project: ControlHandle<string>
declare const minAmount: ControlHandle<number>

const acceptOrders = (options: UseDataTable<Order, readonly [string, number]>) => options
acceptOrders({
  id: 't',
  label: 'T',
  columns: [],
  data: [],
  getRowId: (row: Order) => row.project,
  mode: { kind: 'client' },
  filters: [
    { field: project, match: (row, value) => row.project === value },
    { field: minAmount, match: (row, value) => row.amount >= value },
  ],
})
acceptOrders({
  id: 't',
  label: 'T',
  columns: [],
  data: [],
  getRowId: (row: Order) => row.project,
  mode: { kind: 'client' },
  filters: [
    { field: project, match: (row, value) => row.project === value },
    // @ts-expect-error the second field is a number: its predicate takes a number, not a string
    { field: minAmount, match: (row: Order, value: string) => row.project === value },
  ],
})

// Through the hook: each entry's value is inferred from its own field.
const Inferred = (): void => {
  useDataTable({
    id: 't',
    label: 'T',
    columns: [] as readonly KindColumn<Order>[],
    data: [] as Order[],
    getRowId: (row) => row.project,
    mode: { kind: 'client' },
    filters: [
      { field: project, match: (row, value) => row.project === value },
      { field: minAmount, match: (row, value) => row.amount >= value },
    ],
  })
  useDataTable({
    id: 't',
    label: 'T',
    columns: [] as readonly KindColumn<Order>[],
    data: [] as Order[],
    getRowId: (row) => row.project,
    mode: { kind: 'client' },
    // @ts-expect-error `value` is the number field's: a string comparison does not compile
    filters: [{ field: minAmount, match: (row, value) => row.project === value }],
  })
}
void Inferred
