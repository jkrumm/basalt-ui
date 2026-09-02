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
 * // With the title, the toolbar + pagination bar:
 * <BasaltDataTable
 *   title="Top pages"
 *   data={rows}
 *   columns={columns}
 *   enableGlobalFilter
 *   facets={[{ columnId: 'department', label: 'Department', options: departmentOptions }]}
 *   actions={<Button>Export</Button>}
 *   enablePagination
 * />
 */
import {
  Box,
  Checkbox,
  Group,
  Pagination,
  Select,
  Skeleton,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import type { MantineSpacing } from '@mantine/core'
import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnPinningState,
  FilterFn,
  PaginationState,
  RowData,
  RowSelectionState,
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
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { BASALT_PREFIX } from '../common/errors'
import { assertRequiredProps, useValidateProps } from '../common/validate'
import { FilterSet } from '../controls'
import { ActionGroup, BarActionSlot } from '../controls/actions'
import type { BarAction, SlotActions } from '../controls/actions'
// `EnumFilter` is deliberately NOT on the `./controls` barrel (`docs/CONTROLS-SPEC.md` §3 —
// reaching for it directly is hand-rolling a filter, `basalt/hand-rolled-filter`); a facet column
// is the one place inside the framework itself that legitimately builds a `FieldHandle` over
// something that is not a store field, so it reaches past the barrel on purpose.
import { EnumFilter } from '../controls/enum-filter'
import { MultiSelectFilter } from '../controls/multi-select-filter'
import { CtlSlot } from '../theme'
import { alpha, VX } from '../tokens'
import type { EnumField, FieldHandle, MultiField } from '../state'
import { WidgetHeader } from '../widget-header'
import { ErrorState } from '../dashboard/query-state'
import type { QueryStateLike } from '../dashboard/query-state'
import { dataQueryBranch } from './query-branch'
import { isDev } from '../utils/is-dev'
import classes from './data-table.module.css'

// ── Column alignment ──────────────────────────────────────────────────────────

/** Horizontal alignment of a column's header AND its cells. */
export type DataTableAlign = 'left' | 'center' | 'right'

/**
 * Alignment lives on the column def's `meta`, not on a parallel prop array, so it travels with the
 * column it describes and survives reordering.
 *
 * Declared as a module augmentation of TanStack's own `ColumnMeta` so `meta: { aling: 'right' }` is
 * a TYPE error (excess-property check on the object literal) rather than a silently ignored key —
 * and a wrong VALUE (`'end'`, `'centre'`) throws at render. A misspelled alignment that quietly
 * left-aligns a money column is the class of defect that looks correct in review.
 */
declare module '@tanstack/react-table' {
  // TData/TValue are TanStack's own parameters — required to match its declaration, unused here.
  // oxlint-disable-next-line no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: DataTableAlign
    /**
     * Opt OUT of the automatic mono-numeral cell style. The table applies it whenever the cell's
     * raw value is a number — which is right for a plain figure and wrong for a numeric accessor
     * whose `cell` renders its own chrome (a coloured `Text`, a `Badge`, a sparkline), because the
     * `<td>`'s mono font then overrides what the cell asked for.
     */
    numeral?: boolean
  }
}

const ALIGNMENTS: ReadonlySet<string> = new Set<DataTableAlign>(['left', 'center', 'right'])

/** Reads `meta.align` off a column, throwing on a value that is not one of the three. */
function resolveAlign<T>(column: Column<T, unknown>): DataTableAlign | undefined {
  const align = column.columnDef.meta?.align
  if (align === undefined) return undefined
  if (!ALIGNMENTS.has(align)) {
    throw new Error(
      `BasaltDataTable: column "${column.id}" has meta.align=${JSON.stringify(align)} — ` +
        "expected 'left' | 'center' | 'right'.",
    )
  }
  return align
}

// ── Facets ────────────────────────────────────────────────────────────────────

/** A single selectable option inside a {@link DataTableFacet}'s `EnumFilter`/`MultiSelectFilter` pill. */
export type DataTableFacetOption = {
  /** The raw filter value, compared against the column's stringified cell value. */
  value: string
  /** Label shown in the pill's popover. */
  label: string
}

/**
 * A TanStack column id typed off the row shape `T` where `accessor`/manual `id` inference allows
 * it — `Extract<keyof T, string>` for a real field name, widened by `(string & {})` so a
 * synthetic/derived column id (no matching key on `T`) still type-checks. Defaults to `unknown` so
 * a bare `DataTableFacet[]` / `DataTableColumnPinning` (no type argument) keeps working exactly as
 * before. Shared by {@link DataTableFacet}'s `columnId` and {@link DataTableColumnPinning}'s
 * `left`/`right`.
 */
export type DataTableColumnId<T = unknown> = Extract<keyof T, string> | (string & {})

/**
 * Declares one faceted column filter, rendered as an `EnumFilter` pill (or `MultiSelectFilter`
 * when `multiple` is set) inside a `FilterSet` in the toolbar (`docs/CONTROLS-SPEC.md` §3).
 *
 * @example
 * const facets: DataTableFacet<Employee>[] = [
 *   { columnId: 'department', label: 'Department', options: [{ value: 'Engineering', label: 'Engineering' }] },
 *   { columnId: 'role', label: 'Role', multiple: true, options: roleOptions },
 * ]
 * <BasaltDataTable data={rows} columns={columns} facets={facets} />
 */
export type DataTableFacet<T = unknown> = {
  /** The TanStack column id — the column's manual `id`, or its `accessorKey` string. */
  columnId: DataTableColumnId<T>
  /** The pill's label — read at rest (single-select) and as the `Filters`/count fallback (multi). */
  label: string
  /** Selectable options for this facet. */
  options: DataTableFacetOption[]
  /** Render a `MultiSelectFilter` (any-of match) instead of an `EnumFilter` (exact match). @default false */
  multiple?: boolean
}

/**
 * Column ids pinned to each edge — the same `T`-derived id union as {@link DataTableFacet}'s
 * `columnId`, applied to TanStack's own `ColumnPinningState` shape (`{ left, right }`, each a bare
 * `string[]` unrelated to any row type). Structurally assignable to `ColumnPinningState`, so no
 * cast is needed where this flows into `useState<ColumnPinningState>`.
 */
export type DataTableColumnPinning<T = unknown> = {
  left?: DataTableColumnId<T>[]
  right?: DataTableColumnId<T>[]
}

/**
 * The "no filter" member of a single-select facet's `FieldHandle`. A closed enum field always has
 * a real member as its fallback (C4) — there is no "unset" — so a facet, whose underlying
 * `column.getFilterValue()` genuinely can be `undefined`, needs one synthetic option to stand for
 * that state. Rendered as the enum's first radio; picking it clears the column filter, same as every
 * other value change.
 *
 * Its label is `Any <facet>`, and it used to be a bare `All`. The pill now reads the SELECTED
 * option's label at every value including the fallback (`controls/enum-filter.tsx` — a bar reading
 * `Compare` over a field holding `'previous'` is the bug that law fixes), and a toolbar with three
 * facets would then have read `All` three times. `Any project` is the one label that works in both
 * places at once: it is a legible popover row for "no constraint", and a legible pill readout of the
 * state the filter is actually in. Derived from `facet.label`, so no facet has to declare it.
 */
const FACET_ALL_VALUE = '__basalt_facet_all__'

/** The synthetic row's label — see {@link FACET_ALL_VALUE}. */
function facetAllLabel<T>(facet: DataTableFacet<T>): string {
  return `Any ${facet.label.toLowerCase()}`
}

/**
 * Presents a single-select facet column as a `FieldHandle<EnumField<string>>` so it can render
 * through the shared `EnumFilter` pill instead of a hand-rolled `Select` (`basalt/hand-rolled-filter`).
 * `use()` reads/writes `column.getFilterValue()`/`setFilterValue()` directly — no internal
 * subscription needed, since the enclosing `BasaltDataTable` already re-renders on every
 * `columnFilters` change and this handle is rebuilt fresh each render alongside its column.
 */
function facetEnumHandle<T>(
  column: Column<T, unknown>,
  facet: DataTableFacet<T>,
): FieldHandle<EnumField<string>> {
  return {
    kind: 'enum',
    fallback: FACET_ALL_VALUE,
    options: [{ value: FACET_ALL_VALUE, label: facetAllLabel(facet) }, ...facet.options],
    use: () => {
      const current = (column.getFilterValue() as string | undefined) ?? FACET_ALL_VALUE
      return [
        current,
        (next: string) => {
          column.setFilterValue(next === FACET_ALL_VALUE ? undefined : next)
        },
      ] as const
    },
    // A facet column has no lane to unset: clearing the column filter IS its fallback state.
    clear: () => {
      column.setFilterValue(undefined)
    },
    isDefault: (value) => value === FACET_ALL_VALUE,
  }
}

/**
 * Presents a multi-select facet column as a `FieldHandle<MultiField<string>>`. Unlike the
 * single-select case, `MultiField`'s own fallback — an empty selection — already means "no
 * constraint", so no synthetic option is needed here.
 */
function facetMultiHandle<T>(
  column: Column<T, unknown>,
  facet: DataTableFacet<T>,
): FieldHandle<MultiField<string>> {
  return {
    kind: 'multi',
    fallback: [],
    options: facet.options,
    use: () => {
      const current = (column.getFilterValue() as readonly string[] | undefined) ?? []
      return [
        current,
        (next: readonly string[]) => {
          column.setFilterValue(next.length > 0 ? [...next] : undefined)
        },
      ] as const
    },
    // Same as the single-select facet: an empty column filter is this handle's fallback.
    clear: () => {
      column.setFilterValue(undefined)
    },
    isDefault: (value) => value.length === 0,
  }
}

/**
 * Resolves a facet's `columnId` against the table. A mistyped id used to fall through to
 * `if (!column) return null` — the facet pill silently vanished from the toolbar, the same class
 * of defect the sibling `meta.align` lane and `manualPagination` both treat as a dev-time throw.
 * Mirrors `resolveAlign`'s dev-throw shape: throw naming the id in dev
 * (`basaltViteConfig` defines `process.env.NODE_ENV`, so a production bundle constant-folds this
 * away), degrade to "no pill for this facet" in production.
 */
function resolveFacetColumn<T>(
  table: TanstackTable<T>,
  facet: DataTableFacet<T>,
): Column<T, unknown> | undefined {
  const column = table.getColumn(facet.columnId)
  if (column) return column
  if (isDev()) {
    const knownIds = table
      .getAllColumns()
      .map((known) => known.id)
      .join(', ')
    throw new Error(
      `BasaltDataTable: facet columnId "${facet.columnId}" matches no column — known column ids: ` +
        `${knownIds}.`,
    )
  }
  return undefined
}

// ── Row selection ─────────────────────────────────────────────────────────────

/**
 * The synthetic checkbox column `enableRowSelection` prepends. Its id is namespaced so it can never
 * collide with a real accessor key, and it is excluded from sorting — a checkbox column sorts by
 * selection state, which is a reordering nobody asked for.
 */
const SELECT_COLUMN_ID = '__basalt_select__'

/**
 * Built per render inside a `useMemo`, not hoisted as a constant: `ColumnDef` is generic in `T`, and
 * a single shared instance would have to be cast at every call site.
 *
 * `onClick`'s `stopPropagation` is the load-bearing line. The checkbox lives inside the row, and a
 * row carrying `onRowActivate` opens a detail from a click — so without it, ticking the box also
 * navigated away from the table the tick was meant to act on.
 */
function selectionColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: SELECT_COLUMN_ID,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        size="xs"
        aria-label="Select all rows"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        size="xs"
        aria-label={`Select row ${row.index + 1}`}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(event) => event.stopPropagation()}
      />
    ),
  }
}

/**
 * The bar a selection raises, above the table and below its header — the count, then the actions,
 * through the SAME `BarAction[]` vocabulary `PageBar` uses, so the ≤3-inline fold and the mobile
 * kebab are basalt's here too (law C7/C15) instead of a hand-rolled `Group` of buttons.
 *
 * It renders only while at least one row is selected. A bar reserved at zero is a row of page
 * furniture that says nothing, and a table that changes height when the first box is ticked is the
 * price of not reserving it — the cheaper of the two, because the selection is what the reader just
 * caused.
 */
function BulkActionBar({ count, actions }: { count: number; actions: BarAction[] }) {
  return (
    <Group className={classes.bulkBar} gap="xs" align="center" wrap="wrap" mb="xs">
      <Text className={classes.bulkCount}>{count} selected</Text>
      <CtlSlot>
        <ActionGroup secondary={actions} />
      </CtlSlot>
    </Group>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

/**
 * The four boxes `BasaltDataTable` paints: `root` is the outer fragment's replacement wrapper,
 * `toolbar` is the search/facets/actions row, `table` is the Mantine `Table` itself, `footer` is
 * the pagination bar.
 */
export type BasaltDataTableSlot = 'root' | 'toolbar' | 'table' | 'footer'

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
export type BasaltDataTableProps<T> = BasaltProps &
  SlotStylesProps<BasaltDataTableSlot> & {
    // ── Header (WidgetHeader, docs/CONTROLS-SPEC.md §2.2) ──────────────────────────

    /**
     * Optional heading rendered above the toolbar via `WidgetHeader tier="widget"`. `count` always
     * reads `table.getRowCount()` (C11) — never a raw `data.length` — so it tracks the row model
     * (post-filter/-pagination) rather than the unfiltered input.
     */
    title?: string
    /** Optional leading icon, forwarded to `WidgetHeader`. */
    icon?: ReactNode
    /** Optional muted line rendered below the title row. */
    subtitle?: string

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
     * Enable column sorting via clickable headers. Client-side — the rows in `data` are what get
     * reordered.
     *
     * Under `manualPagination` that is one page, so leaving this on without also passing
     * `manualSorting` is a contract violation and throws in dev — see `manualPagination`.
     * @default true
     */
    enableSorting?: boolean
    /**
     * Hand sorting to the server: the table stops reordering `data` locally and renders it in the
     * order given, while the headers keep toggling `SortingState` and reporting it through
     * `onSortingChange` — which is where you re-request the sorted page.
     *
     * This is the required companion to `manualPagination` whenever sort headers are live; without
     * it a server-paginated table sorts one page and the "of N" bar presents that as a sort of all N.
     * @default false
     * @example
     * <BasaltDataTable
     *   data={page.rows}
     *   columns={columns}
     *   enablePagination
     *   manualPagination
     *   manualSorting
     *   rowCount={page.total}
     *   onSortingChange={(s) => refetch({ sort: s[0] })}
     * />
     */
    manualSorting?: boolean
    /** Stripe alternate rows. Forwarded to Mantine `Table` — `'odd'`/`'even'` pick the phase. */
    striped?: boolean | 'odd' | 'even'
    /** Highlight hovered rows. Forwarded to Mantine `Table`. */
    highlightOnHover?: boolean
    /**
     * Rendered when no rows are VISIBLE — `data` is empty, or a filter/page matches none of it.
     * Falls back to a simple message when omitted. (Before 1.25.0 this tracked `data.length` alone,
     * so a search matching nothing rendered a blank `<tbody>` with no message at all.)
     */
    emptyState?: ReactNode
    /**
     * When true, renders skeleton placeholder rows instead of the empty-state branch.
     * The header remains visible. Use while async data is loading.
     *
     * Superseded by `query`, which resolves this branch AND the two this prop cannot express — pass
     * both and `query` wins, with a dev warning.
     */
    isLoading?: boolean
    /**
     * The result behind `data`, resolved into a body: pending → the skeleton rows below, error with
     * no data → an `ErrorState` row spanning the table (with the query's own `refetch` behind
     * Retry), anything else → the rows, or `emptyState` when none are visible.
     *
     * This is law C3's uniform container contract (`docs/CONTROLS-SPEC.md` §1). The table had NO
     * error branch at all (components audit #3), so a 500 rendered *No data to display.* — the
     * exact false claim `QueryState` was built to delete, one container over.
     *
     * The header, toolbar, `<thead>` and pagination bar stay drawn through every branch: only the
     * `<tbody>` swaps, which is why this is not `QueryState` wrapped around the table. A refetch
     * that fails while rows are already on screen keeps the rows — compose `QueryState` AROUND the
     * table when you want its cached-data banner too.
     *
     * @example
     * const q = useQuery({ queryKey: ['rows'], queryFn: () => api.rows() })
     * <BasaltDataTable data={q.data ?? []} columns={columns} query={q} />
     */
    query?: QueryStateLike<unknown>
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
     * Faceted column filters, rendered in the toolbar as `EnumFilter`/`MultiSelectFilter` pills
     * inside a `FilterSet`, wired to TanStack's per-column `columnFilters` state. The toolbar
     * renders whenever this array is non-empty, `enableGlobalFilter` is set, or `actions` is passed.
     * @example
     * facets={[{ columnId: 'department', label: 'Department', options: departmentOptions }]}
     */
    facets?: DataTableFacet<T>[]
    /** Called whenever the faceted column filters change — the seam for server-side faceting. */
    onColumnFiltersChange?: (filters: ColumnFiltersState) => void
    /**
     * Hand filtering to the server: the table stops narrowing `data` locally and renders every row
     * given, while the search input and facets keep reporting through `onGlobalFilterChange` /
     * `onColumnFiltersChange` — which is where you re-request the filtered page.
     *
     * Required alongside `manualPagination` whenever `enableGlobalFilter` or `facets` is set;
     * without it the controls narrow one page while "of N" keeps counting the whole set.
     * @default false
     */
    manualFiltering?: boolean
    /**
     * Right-aligned toolbar slot (e.g. an "Export" button). Renders the toolbar row even when no
     * search input or facets are configured. Renamed from `toolbarActions` — the toolbar (search +
     * facets + this slot) is wrapped in `CtlSlot` (C1/C5), so its controls resolve to the `ctl` tier.
     *
     * Two accepted forms (law C15): a typed `BarAction[]`, projected through the same row `PageBar`
     * and `ActionGroup` use — ≤3 inline, the rest folded into `More`, one kebab below `sm` — or an
     * opaque `ReactNode`, rendered verbatim exactly as before.
     */
    actions?: SlotActions

    // ── Row activation + selection ────────────────────────────────────────────────

    /**
     * Makes each row openable — click, or Enter on a focused row — with the ROW's original datum.
     * The hook that pairs a table with `PageAside`: row → detail, without the caller adding an
     * `onClick` to every cell renderer.
     *
     * The row keeps its native `<tr>` semantics and takes `tabIndex=0` plus `data-activatable`,
     * never `role="button"`: a role swap takes the row out of the table's row/cell semantics, so a
     * screen reader stops announcing each cell's column header — which is the reason the data is in
     * a table. Cursor and focus ring come from the module class.
     *
     * A click that originates inside the selection checkbox does NOT activate (the checkbox stops
     * the event); a click on a control your own `cell` renders should do the same.
     *
     * @example
     * <BasaltDataTable data={rows} columns={columns} onRowActivate={(row) => setSelected(row)} />
     */
    onRowActivate?: (row: T) => void
    /**
     * Prepends a checkbox column (header = select-all on the page) and arms TanStack's row-selection
     * feature. Selection is uncontrolled unless `rowSelection` is passed.
     * @default false
     */
    enableRowSelection?: boolean
    /**
     * Controlled selection — TanStack's own `RowSelectionState` (`Record<rowId, boolean>`), keyed by
     * `getRowId` (row index by default). Omit for uncontrolled selection held by the table.
     */
    rowSelection?: RowSelectionState
    /** Called with the next `RowSelectionState` on every selection change, controlled or not. */
    onRowSelectionChange?: (selection: RowSelectionState) => void
    /**
     * Stable row id, handed to TanStack. Pass one whenever the selection must survive a re-sort, a
     * page change or a refetch — the default id is the row's INDEX, so row 3 stays "selected" when a
     * different record moves into position 3.
     */
    getRowId?: (row: T, index: number) => string
    /**
     * The actions a selection offers, rendered in a bar above the table while at least one row is
     * selected — and nothing at all while none is.
     *
     * A FUNCTION of the selected rows, not a bare array, and that is the whole signature decision:
     * `BarActionItem.onClick` is `() => void` (the one vocabulary every home shares, unforked), so
     * the rows have to reach the handler through the closure the caller writes here. It also means
     * an UNCONTROLLED table can offer bulk actions at all — the selection lives inside the table,
     * and this is how it gets out.
     *
     * @example
     * bulkActions={(rows) => [
     *   { key: 'export', label: `Export ${rows.length}`, onClick: () => exportCsv(rows) },
     *   { key: 'delete', label: 'Delete', danger: true, onClick: () => remove(rows) },
     * ]}
     */
    bulkActions?: (rows: T[]) => BarAction[]

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
     *
     * **It imposes a contract, enforced at render.** `data` is now one page, but the pagination bar
     * says "Showing 1–25 of 412" — so every OTHER client-side control becomes a claim about 412 rows
     * that it can only make about 25. Each has to be resolved explicitly, because only the call site
     * knows whether the server does the work:
     *
     * - `rowCount` (or `pageCount`) must be given, or "of N" counts the page and the pager collapses
     *   to a single page nobody can leave;
     * - sorting must be handed over with `manualSorting`, or switched off with `enableSorting={false}`;
     * - `enableGlobalFilter` / `facets`, if used, must be handed over with `manualFiltering`;
     * - `enablePagination` must be on, or `manualPagination` is inert and the page renders as if it
     *   were the whole table.
     *
     * Unresolved, each throws in dev and degrades to the honest render in production (no sort
     * headers, no filter controls, no "of N") — never to the plausible wrong answer.
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
    initialColumnPinning?: DataTableColumnPinning<T>

    // ── Body chrome ─────────────────────────────────────────────────────────────

    /**
     * Caps the scrolling body (px number or CSS length) so a long table cannot blow a card out
     * vertically — the header stays put and the rows scroll under it. Renders Mantine's
     * `Table.ScrollContainer type="native"`, which is the same node the docs sanction as the raw
     * escape for a bespoke table: the blessed lane and the escape hatch produce identical DOM, so
     * adopting one does not contradict the other.
     *
     * `type="native"` is required rather than preferred: `ScrollArea`'s custom viewport is the
     * positioning context a sticky `<thead>` resolves against, so the default `'scrollarea'` type
     * pins the header to the page viewport instead of the table's box.
     */
    maxHeight?: number | string
    /**
     * `min-width` below which the body scrolls horizontally. Setting either this or `maxHeight`
     * turns on the scroll container; `maxHeight` alone implies `minWidth: 0`.
     */
    minWidth?: number | string
    /** Sticky header row. Pair with `maxHeight` to stick within the table rather than the page. */
    stickyHeader?: boolean
    /**
     * Offset for a sticky header sitting under a fixed app header (px number or CSS length).
     *
     * WINDOW-scroll only, and IGNORED whenever `maxHeight`/`minWidth` turn on the scroll container:
     * that box is then the header's own scrollport, so an offset would park the `<thead>` that many
     * pixels down inside the body — painting it over the rows instead of above them. Inside the
     * container the header sticks to the scroller's own top edge.
     */
    stickyHeaderOffset?: number | string
    /** Vertical cell padding. Forwarded to Mantine `Table`. */
    verticalSpacing?: MantineSpacing
    /** Horizontal cell padding. Forwarded to Mantine `Table`. */
    horizontalSpacing?: MantineSpacing
    /** Row separators. Forwarded to Mantine `Table`. @default true (Mantine's own default) */
    withRowBorders?: boolean
    /**
     * Outer table border — a full box around the table.
     *
     * **`false` by default since this minor** (it was `true`). Three separate faults, all visible on
     * the playground's `Controls (mobile)` page at 390px: its TOP edge sat directly under the table's
     * own `WidgetHeader`, separating a header from its own content; its BOTTOM edge landed on the last
     * row's own hairline, two rules at zero distance; and its left/right edges carried no information
     * at all on a table that fills the page (`docs/DESIGN-SPEC.md` §8 — a border is a layout divider,
     * and there is nothing here to divide). The head-row rule and the between-row rules stay, so the
     * table still reads as a table.
     *
     * Pass `true` for a table that genuinely needs a frame — a small table floating in whitespace
     * beside other content, where the box IS the grouping.
     *
     * @default false
     */
    withTableBorder?: boolean
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

/**
 * The header row's two halves. The lead SHRINKS and the toolbar does not — a title can ellipsize, a
 * 220px search field with a facet pill beside it cannot, and when both were shrinkable flex split
 * the overflow between them and clipped the search's placeholder mid-word.
 */
const TABLE_HEADER_LEAD_STYLE: CSSProperties = { flex: '1 1 auto', minWidth: 0 }
const TABLE_TOOLBAR_STYLE: CSSProperties = { flex: '0 0 auto' }
/**
 * The toolbar search's width. Mantine's Input grows to its container, which in a `justify:
 * space-between` row means "whatever is left" — so the field was 600px on a wide table and 180px on a
 * narrow one, for the same one-word query. A stated width also makes the toolbar's own minimum width
 * knowable, which is what lets it wrap under the title below `sm` with no media query.
 */
const SEARCH_WIDTH = 220
/** The rows-per-page Select's width — see `SEARCH_WIDTH` for why a toolbar field states one. */
const PAGE_SIZE_WIDTH = 116

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

// ── The manual-pagination contract ────────────────────────────────────────────

/** One client-side control that `manualPagination` turns into a claim the table cannot support. */
type ManualPaginationBreach = 'inert' | 'total' | 'sorting' | 'filtering'

const BREACH_REMEDY: Record<ManualPaginationBreach, string> = {
  inert:
    '`enablePagination` is not set, so `manualPagination` never reaches the table and the server ' +
    'page renders as if it were the whole set, with no bar to say otherwise. Pass ' +
    '`enablePagination`, or drop `manualPagination`.',
  total:
    'neither `rowCount` nor `pageCount` was given, so "of N" counts only the rows on this page and ' +
    'the pager collapses to one page nobody can leave. Pass `rowCount={total}`.',
  sorting:
    'client-side sorting is still armed. It reorders only the rows in `data` — one page — while the ' +
    'header chevron and "of N" together present it as a sort of all of them. Pass `manualSorting` ' +
    'and sort in the request you make from `onSortingChange`, or `enableSorting={false}`.',
  filtering:
    'the search input / facets still filter client-side. They narrow only the rows in `data` — one ' +
    'page — while "of N" keeps counting the whole set. Pass `manualFiltering` and filter in the ' +
    'request you make from `onGlobalFilterChange` / `onColumnFiltersChange`, or drop ' +
    '`enableGlobalFilter` / `facets`.',
}

/**
 * Every way the props on hand contradict `manualPagination`. Computed from PROPS only — never from
 * the table instance, whose `getCanSort()` would read back the very `enableSorting` this decides.
 */
function manualPaginationBreaches(config: {
  columns: readonly { enableSorting?: boolean }[]
  enablePagination: boolean
  manualPagination: boolean
  rowCount: number | undefined
  pageCount: number | undefined
  enableSorting: boolean
  manualSorting: boolean
  enableGlobalFilter: boolean
  hasFacets: boolean
  manualFiltering: boolean
}): ManualPaginationBreach[] {
  if (!config.manualPagination) return []
  if (!config.enablePagination) return ['inert']
  const breaches: ManualPaginationBreach[] = []
  if (config.rowCount === undefined && config.pageCount === undefined) breaches.push('total')
  const anyColumnMaySort = config.columns.some((column) => column.enableSorting !== false)
  if (config.enableSorting && anyColumnMaySort && !config.manualSorting) breaches.push('sorting')
  if ((config.enableGlobalFilter || config.hasFacets) && !config.manualFiltering)
    breaches.push('filtering')
  return breaches
}

function manualPaginationMessage(breaches: ManualPaginationBreach[]): string {
  return (
    'BasaltDataTable: `manualPagination` is set, so `data` is one server page — but:\n  · ' +
    breaches.map((breach) => BREACH_REMEDY[breach]).join('\n  · ') +
    '\nEach has to be resolved explicitly: only the call site knows whether the server does the ' +
    'work, so there is no default that is not a guess about the data.'
  )
}

/** Bounded by the sixteen possible breach sets, so it cannot grow with render count. */
const reportedBreaches = new Set<string>()

/**
 * Dev throws; production reports once and lets the caller degrade.
 *
 * Split deliberately from BandStrip's datum/prop rule rather than copied. That rule throws on a bad
 * PROP because a prop is authored, deterministic, and caught the first time the component renders —
 * all true here. What differs is that a bad `meta.align` has no honest render (every alignment we
 * could pick might be the wrong one, and would look right in review), whereas this one does: a
 * table with no sort headers, no filter controls and no "of N" asserts nothing false. Throwing in
 * production would add no correctness the degradation does not already give, and would convert a
 * misreport on a rarely-visited page into a blank one. The report is what keeps the degradation
 * from being its own silence.
 */
function enforceManualPaginationContract(breaches: ManualPaginationBreach[]): void {
  if (breaches.length === 0) return
  const message = manualPaginationMessage(breaches)
  if (isDev()) throw new Error(message)
  if (reportedBreaches.has(message)) return
  reportedBreaches.add(message)
  console.error(message)
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A sortable data table backed by TanStack Table and rendered with Mantine primitives.
 * Generic over `T` — column types are inferred from `ColumnDef<T>`.
 *
 * Sorting is local/client-side by default (no `any`); `manualSorting` hands it to the server.
 * When `enableSorting` is `false` the table is read-only. An `emptyState` node is rendered
 * whenever no rows are visible — empty `data`, or a filter that matches none of it.
 *
 * `manualPagination` imposes a contract on the rest of the props (see its docblock): every
 * client-side control it would turn into a false claim about the unseen rows must be handed to the
 * server or switched off, and an unresolved one throws in dev rather than misreporting.
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
export function BasaltDataTable<T>(props: BasaltDataTableProps<T>) {
  // F-ERR-1: without this, a table missing `data`/`columns` fails deep inside `useReactTable` as a
  // raw `TypeError` caught by `BasaltErrorBoundary` — a blank subtree with no message naming either
  // prop.
  assertRequiredProps('BasaltDataTable', props, ['data', 'columns'])
  const {
    title,
    icon,
    subtitle,
    data,
    columns,
    enableSorting = true,
    manualSorting = false,
    striped,
    highlightOnHover,
    emptyState,
    isLoading = false,
    query,
    skeletonRows = 5,
    initialSorting,
    onSortingChange,
    enableGlobalFilter = false,
    globalFilterPlaceholder = 'Search…',
    searchIcon,
    initialGlobalFilter,
    onGlobalFilterChange,
    facets,
    onColumnFiltersChange,
    manualFiltering = false,
    actions,
    onRowActivate,
    enableRowSelection = false,
    rowSelection,
    onRowSelectionChange,
    getRowId,
    bulkActions,
    enablePagination = false,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    initialPagination,
    onPaginationChange,
    manualPagination = false,
    rowCount,
    pageCount,
    enablePinning = false,
    initialColumnPinning,
    maxHeight,
    minWidth,
    stickyHeader,
    stickyHeaderOffset,
    verticalSpacing,
    horizontalSpacing,
    withRowBorders,
    withTableBorder = false,
    className,
    style,
    classNames,
  } = props
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter ?? '')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>(
    initialPagination ?? { pageIndex: 0, pageSize: pageSizeOptions[0] ?? 10 },
  )
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialColumnPinning ?? {})
  // Uncontrolled by default; `rowSelection`, when passed, is the truth and this only mirrors it so
  // the updater below has a base to apply against.
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})
  const rowSelectionState = rowSelection ?? internalRowSelection

  // `stickyHeaderOffset` is DROPPED whenever the table owns a scroll container — see
  // `resolvedStickyHeaderOffset` below for why it is always wrong there. Dropping it silently is
  // the part worth a message: the header still sticks, so the table looks right until it overlaps
  // the page chrome the offset was measured against, and nothing anywhere says the prop was ignored.
  //
  // The second check is `query` beside `isLoading`: `query` resolves the pending branch AND the two
  // `isLoading` cannot express, so it wins outright. Silently, that reads as the boolean having no
  // effect — which is indistinguishable from a bug in the caller's own loading flag.
  useValidateProps(
    'BasaltDataTable',
    () => [
      stickyHeaderOffset === undefined || (maxHeight === undefined && minWidth === undefined)
        ? null
        : `${BASALT_PREFIX} BasaltDataTable: prop "stickyHeaderOffset" is ignored beside ` +
          '"maxHeight"/"minWidth" — those render a scroll container, and the sticky `<thead>` then ' +
          "anchors to that box's own top edge rather than to the window. Drop the offset, or drop " +
          'the cap and let the page scroll.',
      query === undefined || props.isLoading === undefined
        ? null
        : `${BASALT_PREFIX} BasaltDataTable: props "query" and "isLoading" are both set — "query" ` +
          'wins and "isLoading" is ignored. `query` already resolves the pending branch, plus the ' +
          'error and empty ones the boolean cannot express. Drop "isLoading".',
    ],
    [stickyHeaderOffset, maxHeight, minWidth, query === undefined, props.isLoading === undefined],
  )

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

  const handleColumnFiltersChange = useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      setColumnFilters((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        onColumnFiltersChange?.(next)
        return next
      })
    },
    [onColumnFiltersChange],
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

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      // CONTROLLED: the caller's map is the base AND the only writer. Mirroring it into state too
      // would leave a copy that the caller never moves, and that stale copy becomes the selection
      // the moment `rowSelection` goes back to `undefined` — plus every tick would render twice for
      // one change. Report the next map and let the caller own it.
      if (rowSelection !== undefined) {
        onRowSelectionChange?.(typeof updater === 'function' ? updater(rowSelection) : updater)
        return
      }
      setInternalRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        onRowSelectionChange?.(next)
        return next
      })
    },
    [rowSelection, onRowSelectionChange],
  )

  // Facets are TanStack `columnFilters` entries under the hood — inject an exact-match (or
  // any-of, for `multiple`) filterFn onto the matching column so the built-in `includesString`
  // auto-filter (substring match) never misfires against a Select's exact option value.
  const facetColumns = useMemo(() => {
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

  // The checkbox column is PREPENDED here rather than asked of the caller, so `columns` stays the
  // caller's own data columns and `meta.align` / `numeral` never have to reason about a synthetic
  // one. Everything counting columns downstream reads `columnCount`, below.
  const tableColumns = useMemo(
    () => (enableRowSelection ? [selectionColumn<T>(), ...facetColumns] : facetColumns),
    [facetColumns, enableRowSelection],
  )

  // Enforced before the table is built, so the degraded options below are the ones TanStack gets —
  // a degraded table must not merely hide a control, it must not compute the answer either.
  const hasFacets = Boolean(facets && facets.length > 0)
  const breaches = manualPaginationBreaches({
    columns,
    enablePagination,
    manualPagination,
    rowCount,
    pageCount,
    enableSorting,
    manualSorting,
    enableGlobalFilter,
    hasFacets,
    manualFiltering,
  })
  enforceManualPaginationContract(breaches)
  // Unreachable in dev (the line above threw); in production these are the honest fallbacks.
  const sortingEnabled = enableSorting && !breaches.includes('sorting')
  const filteringEnabled = !breaches.includes('filtering')
  const totalIsAuthoritative = !breaches.includes('total')

  const table = useReactTable<T>({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnPinning,
      ...(enablePagination && { pagination }),
      ...(enableRowSelection && { rowSelection: rowSelectionState }),
    },
    onSortingChange: handleSortingChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnPinningChange: setColumnPinning,
    ...(enablePagination && { onPaginationChange: handlePaginationChange }),
    ...(enableRowSelection && {
      enableRowSelection: true,
      onRowSelectionChange: handleRowSelectionChange,
    }),
    ...(getRowId !== undefined && { getRowId }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Both row models stay installed and are BYPASSED by these flags, which is TanStack's own
    // seam — so a degraded table renders `data` in the order and completeness the server sent it.
    // Forced only by a BREACH, never by `enableSorting={false}` on its own: that pair still applies
    // an `initialSorting` today (it disables the header control, not the row model) and a table
    // that is not misreporting has no business losing it.
    manualSorting: manualSorting || breaches.includes('sorting'),
    manualFiltering: manualFiltering || breaches.includes('filtering'),
    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
      manualPagination,
      ...(manualPagination && rowCount !== undefined && { rowCount }),
      ...(manualPagination && pageCount !== undefined && { pageCount }),
    }),
    enableSorting: sortingEnabled,
    enableColumnPinning: enablePinning,
  })

  const showSearch = enableGlobalFilter && filteringEnabled
  const showFacets = hasFacets && filteringEnabled
  const showToolbar = showSearch || showFacets || Boolean(actions)

  // ── The query branch (law C3) ───────────────────────────────────────────────
  // `query`, when given, owns the body: it resolves the pending branch `isLoading` used to own,
  // plus the error branch the table had none of. `isLoading` stays live for every caller who never
  // had a query result to hand — the dev warning above covers the pair.
  const branch = query === undefined ? undefined : dataQueryBranch('BasaltDataTable', query)
  const showSkeleton = branch === undefined ? isLoading : branch === 'pending'
  const queryError = branch === 'error' && query !== undefined ? query : undefined

  // Every colSpan and every skeleton row counts the RENDERED columns, which is one more than
  // `columns` once the checkbox column is prepended — a stale count left the empty state and the
  // error row one cell short of the header.
  const columnCount = columns.length + (enableRowSelection ? 1 : 0)

  // `getSelectedRowModel()` is TanStack's own memo, so its `rows` array keeps its identity until
  // the selection or the row model actually moves — which is what makes both memos below hold.
  const selectedModelRows = enableRowSelection ? table.getSelectedRowModel().rows : undefined
  const selectedRows = useMemo(
    () => selectedModelRows?.map((row) => row.original) ?? [],
    [selectedModelRows],
  )
  // `bulkActions` is the caller's function of the selection, and calling it inline rebuilt every
  // action object on every render of the table — new `onClick` identities into the whole bar, for a
  // selection that had not changed.
  const bulkBarActions = useMemo(
    () =>
      bulkActions === undefined || selectedRows.length === 0
        ? undefined
        : bulkActions(selectedRows),
    [bulkActions, selectedRows],
  )
  const headerGroups = enablePinning ? getOrderedHeaderGroups(table) : table.getHeaderGroups()
  // The rows actually rendered, not `data` — a filter or a page index that matches nothing leaves
  // `data` non-empty while the body has nothing in it, and a blank body reads as a broken table.
  const rows = table.getRowModel().rows

  // A capped body or a horizontal floor both need the same native scroll node; pinning keeps its
  // simpler overflow-x Box when neither is set.
  const scrolls = maxHeight !== undefined || minWidth !== undefined
  // `stickyHeaderOffset` is a WINDOW-scroll concept — the height of whatever fixed chrome the page
  // scrolls under (the AppShell header plus `PageBar` row 2). Inside the scroll container it is
  // always wrong: that box is the sticky header's own scrollport, so the offset parks the `<thead>`
  // that many pixels DOWN INSIDE the body rather than above it. MEASURED on `/data-stress`
  // (`stickyHeader` + `minWidth`, no `maxHeight`): `calc(48px + 46px)` put the header at y=339 with
  // row 1 at y=284 and row 2 at y=327 — the header painted over row 2 at initial scroll, at 1440x900
  // and 390x844 alike. `overflow-x: auto` computes `overflow-y` to `auto` too, so the container is a
  // scrollport even with no `maxHeight` and the header never scrolls back into place. The scroller's
  // own top edge is the only correct anchor here, so the offset is dropped rather than honoured.
  const resolvedStickyHeaderOffset = scrolls ? undefined : stickyHeaderOffset

  const tableNode = (
    <Table
      className={cx(classNames?.table)}
      {...(striped !== undefined && { striped })}
      {...(highlightOnHover !== undefined && { highlightOnHover })}
      {...(stickyHeader !== undefined && { stickyHeader })}
      {...(resolvedStickyHeaderOffset !== undefined && {
        stickyHeaderOffset: resolvedStickyHeaderOffset,
      })}
      {...(verticalSpacing !== undefined && { verticalSpacing })}
      {...(horizontalSpacing !== undefined && { horizontalSpacing })}
      {...(withRowBorders !== undefined && { withRowBorders })}
      withTableBorder={withTableBorder}
    >
      <Table.Thead>
        {headerGroups.map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = sortingEnabled && header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              const toggleSorting = header.column.getToggleSortingHandler()
              const pinnedStyle = enablePinning
                ? getPinnedCellStyle(table, header.column)
                : undefined
              const align = resolveAlign(header.column)
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
                    ...(align !== undefined && { textAlign: align }),
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
        {queryError !== undefined ? (
          // The branch the table did not have (components audit #3). It spans every rendered
          // column and carries the query's OWN `refetch` behind Retry, so the failure is reported
          // where the rows would have been — not as an empty table saying nothing failed.
          <Table.Tr>
            <Table.Td colSpan={columnCount}>
              <ErrorState
                error={queryError.error}
                title="Could not load"
                tier="section"
                retrying={queryError.fetchStatus === 'fetching'}
                onRetry={() => void queryError.refetch()}
              />
            </Table.Td>
          </Table.Tr>
        ) : showSkeleton ? (
          Array.from({ length: skeletonRows }, (_, rowIndex) => (
            <Table.Tr key={`skeleton-${rowIndex}`}>
              {Array.from({ length: columnCount }, (__, colIndex) => (
                <Table.Td key={`skeleton-${rowIndex}-${colIndex}`}>
                  <Skeleton height={16} radius="sm" />
                </Table.Td>
              ))}
            </Table.Tr>
          ))
        ) : rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={columnCount}>
              {emptyState ?? (
                <Text c="dimmed" ta="center" size="sm" py="sm">
                  No data to display.
                </Text>
              )}
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((row) => {
            const cells = enablePinning
              ? [
                  ...row.getLeftVisibleCells(),
                  ...row.getCenterVisibleCells(),
                  ...row.getRightVisibleCells(),
                ]
              : row.getVisibleCells()
            return (
              <Table.Tr
                key={row.id}
                {...(enableRowSelection && row.getIsSelected() && { 'data-selected': true })}
                {...(onRowActivate !== undefined && {
                  className: classes.activatable,
                  'data-activatable': true,
                  tabIndex: 0,
                  onClick: () => onRowActivate(row.original),
                  // Enter only. Space is the browser's own page-scroll on a focused non-button, and
                  // stealing it from a keyboard reader moving down a long table costs more than the
                  // second activation key buys.
                  onKeyDown: (event: ReactKeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key !== 'Enter') return
                    // Only the ROW's own Enter. A cell may hold a button, a link or the selection
                    // checkbox, and keydown bubbles — so without this an Enter on a nested control
                    // fired that control AND opened the row's detail behind it.
                    if (event.target !== event.currentTarget) return
                    event.preventDefault()
                    onRowActivate(row.original)
                  },
                })}
              >
                {cells.map((cell) => {
                  const pinnedStyle = enablePinning
                    ? getPinnedCellStyle(table, cell.column)
                    : undefined
                  const align = resolveAlign(cell.column)
                  return (
                    <Table.Td
                      key={cell.id}
                      style={{
                        ...(typeof cell.getValue() === 'number' &&
                        cell.column.columnDef.meta?.numeral !== false
                          ? NUMERIC_CELL_STYLE
                          : undefined),
                        ...(align !== undefined && { textAlign: align }),
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
  // The CURRENT page size is always an option, even when it is not in `pageSizeOptions`. Mantine's
  // Select renders EMPTY when its `value` matches no row, so a table opened at
  // `initialPagination.pageSize: 5` against the default `[10, 25, 50, 100]` showed a blank
  // rows-per-page box — a control stating nothing, next to a range label stating `1–5`.
  const pageSizeRows = [...new Set([...pageSizeOptions, paginationState.pageSize])]
    .sort((a, b) => a - b)
    .map((size) => ({ value: String(size), label: `${size} / page` }))
  const total = table.getRowCount()
  const rangeStart = total === 0 ? 0 : paginationState.pageIndex * paginationState.pageSize + 1
  const rangeEnd = Math.min((paginationState.pageIndex + 1) * paginationState.pageSize, total)

  return (
    <div className={cx(classNames?.root, className)} {...(style !== undefined && { style })}>
      {/*
       * ONE header row: the `WidgetHeader` (title · count) on the left, the toolbar right-aligned in
       * the SAME row. It was two stacked rows with `mb="xs"` on each, so a titled table with search
       * spent title → 11px → search → 11px → thead before a single datum appeared, and the toolbar
       * read as page furniture rather than as this table's controls.
       *
       * `wrap="wrap"` is the below-`sm` behaviour and needs no media query: the toolbar's minimum
       * width (a 220px search plus its pills) exceeds what is left beside a title on a phone, so flex
       * wraps it under the title on its own. `align="center"` puts the 30px toolbar controls on the
       * title's optical line rather than on its baseline.
       */}
      {(title !== undefined || showToolbar) && (
        <Group justify="space-between" align="center" wrap="wrap" gap="xs" mb="xs">
          {title !== undefined ? (
            <Box style={TABLE_HEADER_LEAD_STYLE}>
              <WidgetHeader
                tier="widget"
                title={title}
                {...(icon !== undefined && { icon })}
                {...(subtitle !== undefined && { subtitle })}
                count={table.getRowCount()}
              />
            </Box>
          ) : null}
          {showToolbar && (
            <CtlSlot>
              <Group
                className={cx(classNames?.toolbar)}
                gap="xs"
                wrap="wrap"
                align="center"
                style={TABLE_TOOLBAR_STYLE}
              >
                {showSearch && (
                  <TextInput
                    radius="md"
                    w={SEARCH_WIDTH}
                    placeholder={globalFilterPlaceholder}
                    leftSection={searchIcon}
                    value={globalFilter}
                    onChange={(event) => handleGlobalFilterChange(event.currentTarget.value)}
                  />
                )}
                {showFacets && (
                  <FilterSet>
                    {facets?.map((facet) => {
                      const column = resolveFacetColumn(table, facet)
                      if (!column) return null
                      return facet.multiple ? (
                        <MultiSelectFilter
                          key={facet.columnId}
                          field={facetMultiHandle(column, facet)}
                          label={facet.label}
                        />
                      ) : (
                        <EnumFilter
                          key={facet.columnId}
                          field={facetEnumHandle(column, facet)}
                          label={facet.label}
                        />
                      )
                    })}
                  </FilterSet>
                )}
                {actions !== undefined && <BarActionSlot actions={actions} />}
              </Group>
            </CtlSlot>
          )}
        </Group>
      )}
      {bulkBarActions !== undefined && (
        <BulkActionBar count={selectedRows.length} actions={bulkBarActions} />
      )}
      {scrolls ? (
        <Table.ScrollContainer
          type="native"
          minWidth={minWidth ?? 0}
          {...(maxHeight !== undefined && { maxHeight })}
        >
          {tableNode}
        </Table.ScrollContainer>
      ) : enablePinning ? (
        <Box style={{ overflowX: 'auto' }}>{tableNode}</Box>
      ) : (
        tableNode
      )}
      {enablePagination && (
        <Group
          className={cx(classNames?.footer)}
          justify="space-between"
          mt="xs"
          wrap="wrap"
          gap="xs"
          align="center"
        >
          <Text style={RANGE_LABEL_STYLE}>
            Showing {rangeStart}–{rangeEnd}
            {totalIsAuthoritative ? ` of ${total}` : ''}
          </Text>
          <Group gap="xs" align="center">
            <Select
              size="ctl"
              radius="md"
              w={PAGE_SIZE_WIDTH}
              data={pageSizeRows}
              value={String(paginationState.pageSize)}
              onChange={(value) => value && table.setPageSize(Number(value))}
              allowDeselect={false}
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
    </div>
  )
}
