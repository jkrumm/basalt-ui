// Spike (W1 ledger): today's DataTable wiring on Table v8 — the incumbent the v9 variants are measured against.
import { Checkbox, Table, TextInput } from '@mantine/core'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnFiltersState,
  ColumnPinningState,
  FilterFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SpikeRow } from './rows'

const anyOf: FilterFn<SpikeRow> = (row, id, value: string[]) =>
  value.length === 0 || value.includes(row.getValue<string>(id))

const col = createColumnHelper<SpikeRow>()
const columns = [
  col.display({
    id: 'select',
    cell: ({ row }) => (
      <Checkbox checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
    ),
  }),
  col.accessor('name', { header: 'Name' }),
  col.accessor('team', { header: 'Team', filterFn: anyOf }),
  col.accessor('revenue', { header: 'Revenue' }),
  col.accessor('updated', {
    header: 'Updated',
    cell: (c) => c.getValue().toISOString().slice(0, 10),
  }),
]

export function SpikeTableV8({
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
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['name'] })
  const table = useReactTable({
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
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })
  return (
    <>
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
                  style={{ left: header.column.getStart('left') }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
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
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
    </>
  )
}
