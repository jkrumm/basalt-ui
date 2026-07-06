/**
 * ./data — BasaltDataTable: a sortable data table over @tanstack/react-table, rendered with Mantine.
 * Optional peer: @tanstack/react-table >=8 <9.
 *
 * @example
 * import { BasaltDataTable } from 'basalt-ui/data'
 * import { createColumnHelper } from '@tanstack/react-table'
 *
 * type Row = { name: string; age: number }
 * const col = createColumnHelper<Row>()
 * const columns = [
 *   col.accessor('name', { header: 'Name' }),
 *   col.accessor('age',  { header: 'Age'  }),
 * ]
 * <BasaltDataTable data={rows} columns={columns} />
 */
import { Box, Skeleton, Table, Text } from '@mantine/core'
import type { ColumnDef, SortingState, Updater } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'

// ── Props ─────────────────────────────────────────────────────────────────────

/**
 * Props for {@link BasaltDataTable}.
 *
 * @example
 * const props: BasaltDataTableProps<User> = {
 *   data: users,
 *   columns,
 *   enableSorting: true,
 *   striped: true,
 *   highlightOnHover: true,
 *   emptyState: <Text c="dimmed">No results found.</Text>,
 * }
 */
export type BasaltDataTableProps<T> = {
  /** Row data array. */
  data: T[]
  /**
   * Column definitions. Use `createColumnHelper<T>()` from `@tanstack/react-table`
   * for a typed accessor builder — `col.accessor('field', …)` columns sort by value.
   */
  // The cell-value type varies per column, so the array is heterogeneous in TValue. `any` here
  // is the TanStack-idiomatic escape (accessor columns infer their own TValue); row typing stays
  // exact via the `T` data generic.
  // oxlint-disable-next-line typescript/no-explicit-any -- TanStack-idiomatic heterogeneous column array
  columns: ColumnDef<T, any>[]
  /**
   * Enable column sorting via clickable headers.
   * @default true
   */
  enableSorting?: boolean
  /** Stripe alternate rows. Forwarded to Mantine `Table`. */
  striped?: boolean
  /** Highlight hovered rows. Forwarded to Mantine `Table`. */
  highlightOnHover?: boolean
  /** Rendered when `data` is empty. Falls back to a simple message when omitted. */
  emptyState?: ReactNode
  /**
   * When true, renders skeleton placeholder rows instead of the empty-state branch.
   * The header remains visible. Use while async data is loading.
   */
  isLoading?: boolean
  /**
   * Number of skeleton rows to render when `isLoading` is true.
   * @default 5
   */
  skeletonRows?: number
  /**
   * Initial sorting state. Drives `useState` initial value — useful for restoring
   * sort order from URL search params (e.g. `initialSorting={Route.useSearch().sorting}`).
   * @example
   * // URL-sync pattern with TanStack Router
   * const { sorting } = Route.useSearch()
   * <BasaltDataTable initialSorting={sorting} onSortingChange={(s) => navigate({ search: { sorting: s } })} … />
   */
  initialSorting?: SortingState
  /**
   * Called whenever the internal sorting state changes. Receives the new `SortingState`.
   * The table continues to manage sorting internally (uncontrolled) when this is omitted.
   */
  onSortingChange?: (sorting: SortingState) => void
}

// ── Sort indicator ────────────────────────────────────────────────────────────

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (!direction) return null
  return (
    <Box component="span" ml={4} aria-hidden>
      {direction === 'asc' ? '↑' : '↓'}
    </Box>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A sortable data table backed by TanStack Table and rendered with Mantine primitives.
 * Generic over `T` — column types are inferred from `ColumnDef<T>`.
 *
 * Sorting is local/client-side (no `any`). When `enableSorting` is `false` the table
 * is read-only. An `emptyState` node is rendered when `data` is empty.
 *
 * @example
 * <BasaltDataTable
 *   data={users}
 *   columns={columns}
 *   enableSorting
 *   striped
 *   highlightOnHover
 *   emptyState={<Text c="dimmed">No users found.</Text>}
 * />
 */
export function BasaltDataTable<T>({
  data,
  columns,
  enableSorting = true,
  striped,
  highlightOnHover,
  emptyState,
  isLoading = false,
  skeletonRows = 5,
  initialSorting,
  onSortingChange,
}: BasaltDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])

  const handleSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      setSorting((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        onSortingChange?.(next)
        return next
      })
    },
    [onSortingChange],
  )

  const table = useReactTable<T>({
    data,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting,
  })

  return (
    <Table
      {...(striped !== undefined && { striped })}
      {...(highlightOnHover !== undefined && { highlightOnHover })}
      withTableBorder
      withColumnBorders
    >
      <Table.Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = enableSorting && header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              const toggleSorting = header.column.getToggleSortingHandler()
              return (
                <Table.Th
                  key={header.id}
                  onClick={canSort ? toggleSorting : undefined}
                  onKeyDown={
                    canSort
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          toggleSorting?.(event)
                        }
                      : undefined
                  }
                  tabIndex={canSort ? 0 : undefined}
                  aria-sort={
                    canSort
                      ? sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  style={canSort ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && <SortIndicator direction={sorted} />}
                </Table.Th>
              )
            })}
          </Table.Tr>
        ))}
      </Table.Thead>
      <Table.Tbody>
        {isLoading ? (
          Array.from({ length: skeletonRows }, (_, rowIndex) => (
            <Table.Tr key={`skeleton-${rowIndex}`}>
              {columns.map((_, colIndex) => (
                <Table.Td key={`skeleton-${rowIndex}-${colIndex}`}>
                  <Skeleton height={16} radius="sm" />
                </Table.Td>
              ))}
            </Table.Tr>
          ))
        ) : data.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              {emptyState ?? (
                <Text c="dimmed" ta="center" size="sm" py="sm">
                  No data to display.
                </Text>
              )}
            </Table.Td>
          </Table.Tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Td>
              ))}
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  )
}
