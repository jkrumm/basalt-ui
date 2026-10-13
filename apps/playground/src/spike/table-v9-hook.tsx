// Spike (W1 ledger): the same table through `createTableHook` — measured to decide expose vs hide.
import { Checkbox, Table, TextInput } from '@mantine/core'
import { createTableHook } from '@tanstack/react-table-v9'
import type {
  ColumnFiltersState,
  ColumnPinningState,
  FilterFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table-v9'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SpikeRow } from './rows'
import { BASALT_TABLE_FEATURES } from './table-v9-features'
import type { BasaltTableFeatures } from './table-v9-features'

const { createAppColumnHelper, useAppTable } = createTableHook({
  features: BASALT_TABLE_FEATURES,
  enableRowSelection: true,
})

const anyOf: FilterFn<BasaltTableFeatures, SpikeRow> = (row, id, value: string[]) =>
  value.length === 0 || value.includes(row.getValue<string>(id))

const col = createAppColumnHelper<SpikeRow>()
const columns = col.columns([
  col.display({
    id: 'select',
    cell: ({ row }) => (
      <Checkbox checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
    ),
  }),
  col.accessor('name', { header: 'Name' }),
  col.accessor('team', { header: 'Team', filterFn: anyOf }),
  col.accessor('revenue', { header: 'Revenue', meta: { align: 'right' } }),
  col.accessor('updated', {
    header: 'Updated',
    cell: (c) => c.getValue().toISOString().slice(0, 10),
  }),
])

export function SpikeTableV9Hook({
  data,
  sort = [{ id: 'revenue', desc: true }],
}: {
  data: SpikeRow[]
  sort?: SortingState
}): ReactNode {
  const [sorting, setSorting] = useState<SortingState>(sort)
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    start: ['name'],
    end: [],
  })
  const table = useAppTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, pagination, rowSelection, columnPinning },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnPinningChange: setColumnPinning,
    getRowId: (row) => row.id,
  })
  return (
    <table.AppTable>
      <TextInput value={globalFilter} onChange={(e) => setGlobalFilter(e.currentTarget.value)} />
      <Table>
        <Table.Thead>
          {table.getHeaderGroups().map((group) => (
            <Table.Tr key={group.id}>
              {group.headers.map((header) => (
                <Table.Th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  data-pinned={header.column.getIsPinned() || undefined}
                  style={{ left: header.column.getStart('start') }}
                >
                  <table.FlexRender header={header} />
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <span
        data-selected={table.getSelectedRowModel().rows.length}
        data-pages={table.getPageCount()}
      />
    </table.AppTable>
  )
}
