/**
 * ./data — BasaltDataTable: a sortable data table over @tanstack/react-table, rendered with Mantine.
 * Optional peer: @tanstack/react-table >=8 <9.
 *
 * Ships with opt-in chrome layered on top of the base sortable table: a filter/search toolbar
 * (global search + faceted column Selects + an actions slot), a pagination bar ("Showing X–Y of N"
 * + rows-per-page + Mantine Pagination, client-side or server-driven), and sticky column pinning.
 * Every feature is opt-in via a boolean prop — a bare `<BasaltDataTable data columns />` renders
 * exactly as before.
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
 *
 * @example
 * // With the toolbar + pagination bar:
 * <BasaltDataTable
 *   data={rows}
 *   columns={columns}
 *   enableGlobalFilter
 *   facets={[{ columnId: 'department', label: 'Department', options: departmentOptions }]}
 *   toolbarActions={<Button size="xs">Export</Button>}
 *   enablePagination
 * />
 */
import {
  Box,
  Group,
  MultiSelect,
  Pagination,
  Select,
  Skeleton,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnPinningState,
  FilterFn,
  PaginationState,
  SortingState,
  Table as TanstackTable,
  Updater,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { alpha, VX } from '../tokens'

// ── Facets ────────────────────────────────────────────────────────────────────

/** A single selectable option inside a {@link DataTableFacet}'s Select/MultiSelect. */
export type DataTableFacetOption = {
  /** The raw filter value, compared against the column's stringified cell value. */
  value: string
  /** Label shown in the Select/MultiSelect dropdown. */
  label: string
}

/**
 * Declares one faceted column filter, rendered as a Mantine Select (or MultiSelect when
 * `multiple` is set) inside the toolbar.
 *
 * @example
 * const facets: DataTableFacet[] = [
 *   { columnId: 'department', label: 'Department', options: [{ value: 'Engineering', label: 'Engineering' }] },
 *   { columnId: 'role', label: 'Role', multiple: true, options: roleOptions },
 * ]
 * <BasaltDataTable data={rows} columns={columns} facets={facets} />
 */
export type DataTableFacet = {
  /** The TanStack column id — the column's manual `id`, or its `accessorKey` string. */
  columnId: string
  /** Label shown as the Select/MultiSelect placeholder. */
  label: string
  /** Selectable options for this facet. */
  options: DataTableFacetOption[]
  /** Render a MultiSelect (any-of match) instead of a single Select (exact match). @default false */
  multiple?: boolean
}

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

  // ── Toolbar (search + facets + actions) ──────────────────────────────────────

  /**
   * Shows a global search `TextInput` above the table, wired to TanStack's `globalFilter` state
   * (substring match against every column's stringified cell value).
   * @default false
   * @example
   * <BasaltDataTable data={rows} columns={columns} enableGlobalFilter searchIcon={<IconSearch size={14} />} />
   */
  enableGlobalFilter?: boolean
  /**
   * Placeholder for the global search input.
   * @default 'Search…'
   */
  globalFilterPlaceholder?: string
  /**
   * Leading icon rendered inside the global search input (Mantine `leftSection`). basalt-ui ships
   * no icon set — pass any `ReactNode` (e.g. `<IconSearch size={14} />`).
   */
  searchIcon?: ReactNode
  /**
   * Initial global filter value. Drives `useState` initial value — mirrors `initialSorting` for
   * restoring the search term from a URL search param.
   */
  initialGlobalFilter?: string
  /** Called whenever the internal global filter value changes. */
  onGlobalFilterChange?: (value: string) => void
  /**
   * Faceted column filters, rendered in the toolbar as Mantine Select/MultiSelect controls wired
   * to TanStack's per-column `columnFilters` state. The toolbar renders whenever this array is
   * non-empty, `enableGlobalFilter` is set, or `toolbarActions` is passed.
   * @example
   * facets={[{ columnId: 'department', label: 'Department', options: departmentOptions }]}
   */
  facets?: DataTableFacet[]
  /**
   * Right-aligned toolbar slot (e.g. an "Export" button). Renders the toolbar row even when no
   * search input or facets are configured.
   */
  toolbarActions?: ReactNode

  // ── Pagination ────────────────────────────────────────────────────────────────

  /**
   * Enables the bottom pagination bar ("Showing X–Y of N", rows-per-page `Select`, Mantine
   * `Pagination`) wired to TanStack's `pagination` state. Client-side by default — see
   * `manualPagination` for server-driven pagination.
   * @default false
   */
  enablePagination?: boolean
  /**
   * Rows-per-page choices offered in the pagination bar's Select.
   * @default [10, 25, 50, 100]
   */
  pageSizeOptions?: number[]
  /**
   * Initial pagination state. Drives `useState` initial value — mirrors `initialSorting` for
   * restoring the page/size from a URL search param.
   */
  initialPagination?: PaginationState
  /** Called whenever the internal pagination state changes. */
  onPaginationChange?: (pagination: PaginationState) => void
  /**
   * Disables local pagination slicing — pass the already-paginated page of `data` plus `rowCount`
   * (and optionally `pageCount`) for server-driven pagination. `onPaginationChange` is where you
   * fetch the next page.
   * @default false
   * @example
   * <BasaltDataTable
   *   data={page.rows}
   *   columns={columns}
   *   enablePagination
   *   manualPagination
   *   rowCount={page.total}
   *   initialPagination={{ pageIndex: page.index, pageSize: page.size }}
   *   onPaginationChange={(p) => fetchPage(p)}
   * />
   */
  manualPagination?: boolean
  /** Total row count across all pages. Required for `manualPagination` to render "of N" and compute page count. */
  rowCount?: number
  /** Total page count, when known. Only consulted under `manualPagination`; omit to derive it from `rowCount`/`pageSize`. */
  pageCount?: number

  // ── Column pinning ────────────────────────────────────────────────────────────

  /**
   * Enables sticky left/right column pinning — pinned columns stick to the edge with a panel
   * background and a hairline shadow separator while the table scrolls horizontally. Pin columns
   * via `initialColumnPinning` (`{ left: string[], right: string[] }`).
   * @default false
   * @example
   * <BasaltDataTable data={rows} columns={columns} enablePinning initialColumnPinning={{ left: ['name'] }} />
   */
  enablePinning?: boolean
  /** Initial column-pinning state — which column ids stick to the left/right edge. */
  initialColumnPinning?: ColumnPinningState
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

// ── Numeral cell idiom (docs/DESIGN-SPEC.md §3: "Stat/table numeral: mono, 12-12.5px, weight
// 500, ink") — auto-detected from the cell's raw value (no column-level opt-in prop needed) so
// every numeric column gets tabular, mono figures with zero call-site configuration.
const NUMERIC_CELL_STYLE: CSSProperties = {
  fontFamily: 'var(--mantine-font-family-monospace)',
  fontSize: VX.text.sm,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--vx-ink)',
}

// docs/DESIGN-SPEC.md §3: mono/micro-label idiom for the pagination bar's row-count label.
const RANGE_LABEL_STYLE: CSSProperties = {
  fontFamily: 'var(--mantine-font-family-monospace)',
  fontSize: VX.text.xs,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--vx-faint)',
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// ── Column pinning helpers ────────────────────────────────────────────────────

// Merges the left/center/right header-group triad TanStack exposes for pinning into the single
// render order (left → center → right) the header row needs — depth-indexed so grouped headers
// (multi-row) still line up.
function getOrderedHeaderGroups<T>(table: TanstackTable<T>) {
  const left = table.getLeftHeaderGroups()
  const center = table.getCenterHeaderGroups()
  const right = table.getRightHeaderGroups()
  return center.map((group, index) => ({
    ...group,
    headers: [...(left[index]?.headers ?? []), ...group.headers, ...(right[index]?.headers ?? [])],
  }))
}

// Sticky offset math (column.getStart('left') / getAfter('right')) is computed purely from the
// pinned columns' own `getSize()`, so only pinned cells need an explicit width to keep the offsets
// accurate — center columns stay naturally sized. The hairline shadow marks the edge column
// touching the unpinned center (first right-pinned index 0 / last left-pinned index).
function getPinnedCellStyle<T>(
  table: TanstackTable<T>,
  column: Column<T, unknown>,
): CSSProperties | undefined {
  const pinned = column.getIsPinned()
  if (!pinned) return undefined
  const size = column.getSize()
  const shared: CSSProperties = {
    position: 'sticky',
    zIndex: 1,
    width: size,
    minWidth: size,
    maxWidth: size,
    backgroundColor: VX.surface.panel,
  }
  if (pinned === 'left') {
    const isEdge = column.getPinnedIndex() === table.getLeftLeafColumns().length - 1
    return {
      ...shared,
      left: column.getStart('left'),
      boxShadow: isEdge ? `4px 0 6px -4px ${alpha(VX.ink, 0.18)}` : undefined,
    }
  }
  const isEdge = column.getPinnedIndex() === 0
  return {
    ...shared,
    right: column.getAfter('right'),
    boxShadow: isEdge ? `-4px 0 6px -4px ${alpha(VX.ink, 0.18)}` : undefined,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A sortable data table backed by TanStack Table and rendered with Mantine primitives.
 * Generic over `T` — column types are inferred from `ColumnDef<T>`.
 *
 * Sorting is local/client-side (no `any`). When `enableSorting` is `false` the table
 * is read-only. An `emptyState` node is rendered when `data` is empty.
 *
 * Toolbar (search + facets), pagination, and column pinning are opt-in chrome layered on top —
 * see the corresponding props below. None of them change rendering unless explicitly enabled.
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
  enableGlobalFilter = false,
  globalFilterPlaceholder = 'Search…',
  searchIcon,
  initialGlobalFilter,
  onGlobalFilterChange,
  facets,
  toolbarActions,
  enablePagination = false,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  initialPagination,
  onPaginationChange,
  manualPagination = false,
  rowCount,
  pageCount,
  enablePinning = false,
  initialColumnPinning,
}: BasaltDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter ?? '')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>(
    initialPagination ?? { pageIndex: 0, pageSize: pageSizeOptions[0] ?? 10 },
  )
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialColumnPinning ?? {})

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

  const handleGlobalFilterChange = useCallback(
    (updater: Updater<string>) => {
      setGlobalFilter((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        onGlobalFilterChange?.(next)
        return next
      })
    },
    [onGlobalFilterChange],
  )

  const handlePaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      setPagination((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        onPaginationChange?.(next)
        return next
      })
    },
    [onPaginationChange],
  )

  // Facets are TanStack `columnFilters` entries under the hood — inject an exact-match (or
  // any-of, for `multiple`) filterFn onto the matching column so the built-in `includesString`
  // auto-filter (substring match) never misfires against a Select's exact option value.
  const tableColumns = useMemo(() => {
    if (!facets || facets.length === 0) return columns
    const facetById = new Map(facets.map((facet) => [facet.columnId, facet]))
    return columns.map((column) => {
      const id = column.id ?? (column as { accessorKey?: string }).accessorKey
      const facet = id === undefined ? undefined : facetById.get(id)
      if (!facet) return column
      const filterFn: FilterFn<T> = facet.multiple
        ? (row, columnId, filterValue: string[]) =>
            !Array.isArray(filterValue) || filterValue.length === 0
              ? true
              : filterValue.includes(String(row.getValue(columnId)))
        : (row, columnId, filterValue: string) =>
            filterValue === null || filterValue === undefined || filterValue === ''
              ? true
              : String(row.getValue(columnId)) === filterValue
      filterFn.autoRemove = (value) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      return { ...column, filterFn }
    })
  }, [columns, facets])

  const table = useReactTable<T>({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnPinning,
      ...(enablePagination && { pagination }),
    },
    onSortingChange: handleSortingChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnPinningChange: setColumnPinning,
    ...(enablePagination && { onPaginationChange: handlePaginationChange }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
      manualPagination,
      ...(manualPagination && rowCount !== undefined && { rowCount }),
      ...(manualPagination && pageCount !== undefined && { pageCount }),
    }),
    enableSorting,
    enableColumnPinning: enablePinning,
  })

  const showToolbar =
    enableGlobalFilter || Boolean(facets && facets.length > 0) || Boolean(toolbarActions)
  const headerGroups = enablePinning ? getOrderedHeaderGroups(table) : table.getHeaderGroups()

  const tableNode = (
    <Table
      {...(striped !== undefined && { striped })}
      {...(highlightOnHover !== undefined && { highlightOnHover })}
      withTableBorder
    >
      <Table.Thead>
        {headerGroups.map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = enableSorting && header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              const toggleSorting = header.column.getToggleSortingHandler()
              const pinnedStyle = enablePinning
                ? getPinnedCellStyle(table, header.column)
                : undefined
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
                  style={{
                    ...(canSort ? { cursor: 'pointer', userSelect: 'none' } : undefined),
                    ...pinnedStyle,
                  }}
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
          table.getRowModel().rows.map((row) => {
            const cells = enablePinning
              ? [
                  ...row.getLeftVisibleCells(),
                  ...row.getCenterVisibleCells(),
                  ...row.getRightVisibleCells(),
                ]
              : row.getVisibleCells()
            return (
              <Table.Tr key={row.id}>
                {cells.map((cell) => {
                  const pinnedStyle = enablePinning
                    ? getPinnedCellStyle(table, cell.column)
                    : undefined
                  return (
                    <Table.Td
                      key={cell.id}
                      style={{
                        ...(typeof cell.getValue() === 'number' ? NUMERIC_CELL_STYLE : undefined),
                        ...pinnedStyle,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            )
          })
        )}
      </Table.Tbody>
    </Table>
  )

  const paginationState = table.getState().pagination
  const total = table.getRowCount()
  const rangeStart = total === 0 ? 0 : paginationState.pageIndex * paginationState.pageSize + 1
  const rangeEnd = Math.min((paginationState.pageIndex + 1) * paginationState.pageSize, total)

  return (
    <>
      {showToolbar && (
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs" mb="xs">
          <Group gap="xs" wrap="wrap" align="flex-end">
            {enableGlobalFilter && (
              <TextInput
                size="xs"
                radius="md"
                placeholder={globalFilterPlaceholder}
                leftSection={searchIcon}
                value={globalFilter}
                onChange={(event) => handleGlobalFilterChange(event.currentTarget.value)}
                w={220}
              />
            )}
            {facets?.map((facet) => {
              const column = table.getColumn(facet.columnId)
              if (!column) return null
              if (facet.multiple) {
                const value = (column.getFilterValue() as string[] | undefined) ?? []
                return (
                  <MultiSelect
                    key={facet.columnId}
                    size="xs"
                    radius="md"
                    placeholder={facet.label}
                    data={facet.options}
                    value={value}
                    onChange={(next) => column.setFilterValue(next.length > 0 ? next : undefined)}
                    clearable
                    w={200}
                  />
                )
              }
              const value = (column.getFilterValue() as string | undefined) ?? null
              return (
                <Select
                  key={facet.columnId}
                  size="xs"
                  radius="md"
                  placeholder={facet.label}
                  data={facet.options}
                  value={value}
                  onChange={(next) => column.setFilterValue(next ?? undefined)}
                  clearable
                  w={180}
                />
              )
            })}
          </Group>
          {toolbarActions}
        </Group>
      )}
      {enablePinning ? <Box style={{ overflowX: 'auto' }}>{tableNode}</Box> : tableNode}
      {enablePagination && (
        <Group justify="space-between" mt="xs" wrap="wrap" gap="xs" align="center">
          <Text style={RANGE_LABEL_STYLE}>
            Showing {rangeStart}–{rangeEnd} of {total}
          </Text>
          <Group gap="xs" align="center">
            <Select
              size="xs"
              radius="md"
              data={pageSizeOptions.map((size) => ({
                value: String(size),
                label: `${size} / page`,
              }))}
              value={String(paginationState.pageSize)}
              onChange={(value) => value && table.setPageSize(Number(value))}
              allowDeselect={false}
              w={110}
            />
            <Pagination
              size="sm"
              radius="md"
              total={Math.max(table.getPageCount(), 1)}
              value={paginationState.pageIndex + 1}
              onChange={(page) => table.setPageIndex(page - 1)}
            />
          </Group>
        </Group>
      )}
    </>
  )
}
