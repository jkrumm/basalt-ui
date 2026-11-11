/**
 * Compile-time proof of the table contract's "never" rows (docs/v3/concepts/data-table.md section
 * 9): one `@ts-expect-error` per bad line, proven by `tsc --noEmit`. Types only; nothing runs.
 */
import type { VirtualLike } from '../core/ports'
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
