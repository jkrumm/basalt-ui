// The compile-time regression guard for `BasaltDataTable`'s `columns`/`data` generic agreement —
// `data-table-align.type-guard.ts` pins `meta.align` only (per audit-a-packaging.md §3); this pins
// the accessor/row-type agreement plus `bulkActions`/`onRowActivate`'s row typing.
import type { ReactNode } from 'react'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
import type { DataTableFacet } from 'basalt-ui/data/table'

type Row = { name: string; cost: number }
const col = createColumnHelper<Row>()

// ── 1. a column accessor for a key not on the row type errors ───────────────────────────────────

export const columns = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('cost', { header: 'Cost' }),
  // @ts-expect-error 'nope' is not a DeepKeys<Row> — createColumnHelper<Row> rejects it
  col.accessor('nope', { header: 'Nope' }),
]

// ── 2. facets[].columnId — a documented GAP, not pinned as a rejection ──────────────────────────
// `DataTableColumnId<T> = Extract<keyof T, string> | (string & {})` (`data-table.tsx:155`). The
// `(string & {})` arm exists so a bare `DataTableFacet[]`/`DataTableColumnPinning` (no type
// argument) "keeps working exactly as before" per that type's own doc — but the SAME arm means a
// TYPED `DataTableFacet<Row>` accepts an arbitrary string too: any string literal is assignable to
// `string & {}`. A `@ts-expect-error` on a wrong columnId below would NOT fire (TS2578, unused
// directive) — so, per the brief, this is reported rather than forced:
//   const badFacet: DataTableFacet<Row> = { columnId: 'totallyWrongKey', label: 'X', options: [] }
// compiles today. Only the VALID case is pinned as a positive.
export const validFacet: DataTableFacet<Row> = { columnId: 'cost', label: 'Cost', options: [] }

// ── 3. bulkActions rows + onRowActivate row are typed as Row, not unknown ───────────────────────

export function Table(): ReactNode {
  return (
    <BasaltDataTable
      data={[{ name: 'a', cost: 1 }]}
      columns={columns}
      enableRowSelection
      bulkActions={(rows) => [
        { key: 'total', label: `Total ${rows.reduce((sum, r) => sum + r.cost, 0)}` },
      ]}
      onRowActivate={(row) => {
        // No cast: `row.cost` must already be `number`.
        const cost: number = row.cost
        return cost
      }}
    />
  )
}

// PROVES: a column accessor naming a key off Row is a tsc error; bulkActions/onRowActivate receive
// Row, not unknown. `facets[].columnId` is DOCUMENTED as accepting any string (a design choice
// mirroring TanStack's own `accessorKey: (string & {}) | keyof TData`), not a compile-time gate —
// stated here rather than left as a silent gap in the audit's ask.
