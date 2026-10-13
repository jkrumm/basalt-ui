// The compile-time regression guard for `BasaltDataTable`'s `columns`/`data` generic agreement —
// `data-table-align.type-guard.ts` pins `meta.align` only (per audit-a-packaging.md §3); this pins
// the accessor/row-type agreement plus `bulkActions`/`onRowActivate`'s row typing.
import type { ReactNode } from 'react'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'

type Row = { name: string; cost: number }
const col = createColumnHelper<Row>()

// ── 1. a column accessor for a key not on the row type errors ───────────────────────────────────

export const columns = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('cost', { header: 'Cost' }),
  // @ts-expect-error 'nope' is not a DeepKeys<Row> — createColumnHelper<Row> rejects it
  col.accessor('nope', { header: 'Nope' }),
]

// ── 2. bulkActions rows + onRowActivate row are typed as Row, not unknown ───────────────────────

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
// Row, not unknown.
