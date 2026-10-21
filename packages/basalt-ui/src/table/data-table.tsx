/**
 * ./table — BasaltDataTable: a sortable data table over @tanstack/react-table v9, rendered with
 * Mantine. Optional peer: @tanstack/react-table 9.2.8 (exact).
 *
 * Ships with opt-in chrome layered on top of the base sortable table: a filter/search toolbar
 * (global search + faceted column Selects + an actions slot), a pagination bar ("Showing X–Y of N"
 * + rows-per-page + Mantine Pagination, client-side or server-driven), and sticky column pinning.
 * Every feature is opt-in via a boolean prop — a bare `<BasaltDataTable data columns />` renders
 * exactly as before.
 *
 * @example
 * import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
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
  ActionIcon,
  Box,
  Checkbox,
  Group,
  Pagination,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import type { MantineSpacing } from '@mantine/core'
import type {
  Cell,
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnVisibilityState,
  FilterFn,
  PaginationState,
  RowData,
  RowSelectionState,
  SortingState,
  Table as TanstackTable,
} from '@tanstack/react-table'
import { constructFilterFn, FlexRender, useTable } from '@tanstack/react-table'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react'
import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedCallback } from '@mantine/hooks'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { BASALT_PREFIX } from '../common/errors'
import { HIT_COARSE } from '../common/hit-floor'
import { useMeasuredWidths } from '../common/use-measured-widths'
import { assertRequiredProps, useValidateProps } from '../common/validate'
import { FilterSet } from '../controls'
import { ActionGroup, BarActionSlot, OverflowMenu } from '../controls/actions'
import type { BarAction, BarActionItem, SlotActions } from '../controls/actions'
// `EnumFilter` is deliberately NOT on the `./controls` barrel (`docs/CONTROLS-SPEC.md` §3 —
// reaching for it directly is hand-rolling a filter, `basalt/hand-rolled-filter`); a facet column
// is the one place inside the framework itself that legitimately builds a `FieldHandle` over
// something that is not a store field, so it reaches past the barrel on purpose.
import { EnumFilter } from '../controls/enum-filter'
import { MultiSelectFilter } from '../controls/multi-select-filter'
import { CtlSlot } from '../theme'
import { IconSlot } from '../theme/icon-slot'
import { CONTAINER_CLASSES, VX } from '../tokens'
import type { EnumField, FieldHandle, MultiField } from '../state/fields'
import { WidgetHeader } from '../dashboard'
import { ErrorState } from '../dashboard/query-state'
import type { QueryStateLike } from '../dashboard/query-state'
import {
  activationProps,
  useCardProjection,
  useDataTableState,
  useNarrowerThan,
  useRowDisclosure,
} from './data-table-state'
export { planColumnFold } from './data-table-fold'
import { dataQueryBranch } from './query-branch'
import { basaltTableFeatures } from './table-features'
import type { BasaltColumnDef, BasaltTableFeatures, DataTableAlign } from './table-features'
import {
  columnDefId,
  columnLabel,
  FIXED_ID_ATTR,
  FOLD_ID_ATTR,
  foldOrder,
  foldToggleCellProps,
  FoldHeaderLabel,
  FoldToggle,
  PIN_MIN_WIDTH,
  pinnedCellProps,
  RowDisclosure,
  useColumnFold,
} from './data-table-fold'
import type { PinContext } from './data-table-fold'
import {
  CellContent,
  DEFAULT_CELL,
  kindAlign,
  kindClass,
  KindSkeleton,
  planColumnSizing,
  resolveKind,
} from './cell-kinds'
import classes from './data-table.module.css'

// ── Column alignment ──────────────────────────────────────────────────────────

// `meta.align` is typed by `BasaltColumnMeta` (`table-features.ts`); only the VALUE check lives here.

const ALIGNMENTS: ReadonlySet<string> = new Set<DataTableAlign>(['left', 'center', 'right'])

/**
 * Reads `meta.align` off a column, throwing on a value that is not one of the three — the one
 * check a type cannot make once a value arrives from an untyped caller. A misspelled alignment that
 * quietly left-aligns a money column looks correct in review.
 */
function resolveAlign<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
): DataTableAlign | undefined {
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
 * `start`/`end`.
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
 * `columnId`, applied to the `{ start, end }` shape. Not itself a TanStack `ColumnPinningState`: both edges are
 * optional here, and `useDataTableState` normalises a missing edge to `[]` before the table sees it.
 */
export type DataTableColumnPinning<T = unknown> = {
  start?: DataTableColumnId<T>[]
  end?: DataTableColumnId<T>[]
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
function facetEnumHandle<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
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
function facetMultiHandle<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
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
function resolveFacetColumn<T extends RowData>(
  table: TanstackTable<BasaltTableFeatures, T>,
  facet: DataTableFacet<T>,
): Column<BasaltTableFeatures, T, unknown> | undefined {
  const column = table.getColumn(facet.columnId)
  if (column) return column
  if (process.env.NODE_ENV !== 'production') {
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

/**
 * The facet filters, built with `constructFilterFn` so `autoRemove` is part of the typed definition:
 * a facet with nothing selected is dropped from `columnFilters` rather than kept as a no-op. They
 * match the column value's STRING form exactly (a Select's option values are strings), which is why
 * the built-in `includesString` auto-filter (substring) is never allowed to run on a facet column.
 */
const facetAutoRemove = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

const facetExact = constructFilterFn({
  filter: (dataValue, filterValue: string | null | undefined) =>
    filterValue === null || filterValue === undefined || filterValue === ''
      ? true
      : String(dataValue) === filterValue,
  autoRemove: facetAutoRemove,
})

const facetAnyOf = constructFilterFn({
  filter: (dataValue, filterValue: string[]) =>
    !Array.isArray(filterValue) || filterValue.length === 0
      ? true
      : filterValue.includes(String(dataValue)),
  autoRemove: facetAutoRemove,
})

// ── Row selection ─────────────────────────────────────────────────────────────

/**
 * The synthetic checkbox column `enableRowSelection` prepends. Its id is namespaced so it can never
 * collide with a real accessor key, and it is excluded from sorting — a checkbox column sorts by
 * selection state, which is a reordering nobody asked for.
 */
const SELECT_COLUMN_ID = '__basalt_select__'
/** The checkbox column's width when it pins beside an auto-pinned identifier — the pinned offsets
 * sum `getSize()`, so the real cell is held to it (the coarse hit floor, one tap target wide). */
const SELECT_COLUMN_SIZE = HIT_COARSE

/**
 * Built per render inside a `useMemo`, not hoisted as a constant: `ColumnDef` is generic in `T`, and
 * a single shared instance would have to be cast at every call site.
 *
 * The select cell's `stopPropagation` (see the `<Table.Td>`) is the load-bearing line. The checkbox
 * lives inside the row, and a row carrying `onRowActivate` opens a detail from a click — so without
 * it, ticking the box also navigated away from the table the tick was meant to act on.
 */
function selectionColumn<T extends RowData>(): ColumnDef<BasaltTableFeatures, T, unknown> {
  return {
    id: SELECT_COLUMN_ID,
    size: SELECT_COLUMN_SIZE,
    enableSorting: false,
    header: ({ table }) => (
      // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- wraps <Checkbox>, which oxlint cannot see is an input
      <label className={classes.selectHit}>
        <Checkbox
          size="xs"
          aria-label="Select all rows"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      </label>
    ),
    cell: ({ row }) => (
      // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- wraps <Checkbox>, which oxlint cannot see is an input
      <label className={classes.selectHit}>
        <Checkbox
          size="xs"
          aria-label={`Select row ${row.index + 1}`}
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
        />
      </label>
    ),
  }
}

// ── Row actions ───────────────────────────────────────────────────────────────

/** One per-row action: `BarActionItem`'s vocabulary with the row handed to the handler. */
export type DataTableRowAction<T = unknown> = {
  key: string
  label: string
  /** A lone action with an icon renders as that icon button; anything else folds into the menu. */
  icon?: ReactNode
  onClick: (row: T) => void
  danger?: boolean
  /** A disabled action renders inert and never fires. */
  disabled?: (row: T) => boolean
  /** A loading action shows the busy state (icon button) or sits inert (menu) and never fires. */
  loading?: (row: T) => boolean
}

/** The synthetic trailing column `rowActions` appends — namespaced like {@link SELECT_COLUMN_ID}. */
const ACTIONS_COLUMN_ID = '__basalt_actions__'

/** Wide enough for one 30px control plus the cell's horizontal padding. */
const ACTIONS_COLUMN_SIZE = 56

/**
 * The cells whose own controls must not read as "activate the row": a tickable selection cell (a
 * disabled row's tap IS a row tap) and every actions cell.
 */
function stopsRowActivation<T extends RowData>(
  cell: Cell<BasaltTableFeatures, T, unknown>,
): boolean {
  if (cell.column.id === ACTIONS_COLUMN_ID) return true
  return cell.column.id === SELECT_COLUMN_ID && cell.row.getCanSelect()
}

function RowActionCell<T>({
  actions,
  row,
  rowIndex,
  rowLabel,
}: {
  actions: readonly DataTableRowAction<T>[]
  row: T
  rowIndex: number
  rowLabel: ((row: T) => string) | undefined
}): ReactNode {
  const named = rowLabel?.(row)
  const [only] = actions
  if (actions.length === 1 && only?.icon !== undefined) {
    const inert = only.disabled?.(row) === true || only.loading?.(row) === true
    return (
      <ActionIcon
        variant="subtle"
        size="ctl"
        aria-label={named === undefined ? only.label : `${only.label}: ${named}`}
        disabled={only.disabled?.(row) === true}
        loading={only.loading?.(row) === true}
        {...(only.danger === true && { color: 'red' })}
        onClick={() => {
          if (!inert) only.onClick(row)
        }}
      >
        <IconSlot>{only.icon}</IconSlot>
      </ActionIcon>
    )
  }
  const items: BarActionItem[] = actions.map((action) => ({
    key: action.key,
    label: action.label,
    ...(action.icon !== undefined && { icon: action.icon }),
    ...(action.danger === true && { danger: true }),
    // The menu has no busy state of its own, so loading reads as inert there.
    disabled: action.disabled?.(row) === true || action.loading?.(row) === true,
    onClick: () => action.onClick(row),
  }))
  return (
    <OverflowMenu
      actions={items}
      trigger="kebab"
      label={named === undefined ? `Row ${rowIndex + 1} actions` : `Actions for ${named}`}
    />
  )
}

/**
 * Header-less: the `<th>` carries a screen-reader-only name and nothing sorts across it. Built per
 * render for the same reason as {@link selectionColumn} (`ColumnDef` is generic in `T`).
 */
function rowActionsColumn<T extends RowData>(
  actions: readonly DataTableRowAction<T>[],
  rowLabel: ((row: T) => string) | undefined,
): ColumnDef<BasaltTableFeatures, T, unknown> {
  return {
    id: ACTIONS_COLUMN_ID,
    size: ACTIONS_COLUMN_SIZE,
    enableSorting: false,
    enableHiding: false,
    header: () => <span className={classes.srOnly}>Actions</span>,
    cell: ({ row }) => (
      <RowActionCell
        actions={actions}
        row={row.original}
        rowIndex={row.index}
        rowLabel={rowLabel}
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
 * `toolbar` is the search/facets/actions row, `table` is whichever body renders — the Mantine
 * `Table`, or the card list's `Stack` while `renderCard` projects — and `footer` is the pagination
 * bar.
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
export type BasaltDataTableProps<T extends RowData> = BasaltProps &
  SlotStylesProps<BasaltDataTableSlot> & {
    // ── Header (WidgetHeader, docs/CONTROLS-SPEC.md §2.2) ──────────────────────────

    /**
     * Optional heading rendered above the toolbar via `WidgetHeader tier="widget"`. The count tag
     * beside it is automatic, not a prop (there is no `count`): it reads `table.getRowCount()` (C11)
     * — never a raw `data.length` — so it tracks the row model (post-filter/-pagination) rather
     * than the unfiltered input.
     */
    title?: string
    /** Optional leading icon, forwarded to `WidgetHeader`. */
    icon?: ReactNode
    /** Optional muted line rendered below the title row. */
    subtitle?: string

    /** Row data array. */
    data: T[]
    /**
     * Column definitions. Use `createColumnHelper<T>()` from `basalt-ui/table`
     * for a typed accessor builder — `col.accessor('field', …)` columns sort by value.
     */
    // The cell-value type varies per column, so the array is heterogeneous in TValue
    // (`BasaltColumnDef` carries the `any`); row typing stays exact via the `T` data generic.
    columns: BasaltColumnDef<T>[]
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
    /** Highlight hovered rows with `VX.surface.rowHover` on a fine pointer. Forwarded to Mantine `Table`.
     * @default true */
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
     * Number of skeleton rows to render when `isLoading` is true and neither a page size nor an
     * earlier load says better: a paginated table loads at its page size, any other at the row
     * count it last showed.
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
    /**
     * Initial facet filters — `[{ id: 'department', value: 'Engineering' }]` opens the table with
     * that facet preset. Uncontrolled, like `initialSorting`; `onColumnFiltersChange` reports edits.
     */
    initialColumnFilters?: ColumnFiltersState
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
     * search input or facets are configured. The toolbar (search + facets + this slot) is wrapped
     * in `CtlSlot` (C1/C5), so its controls resolve to the `ctl` tier.
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
     * A compact card projection of one row, rendered INSTEAD of the table while the table's own box
     * is narrower than the `regular` container class (`CONTAINER_CLASSES`, 480px) — keyed on the
     * width this table actually has, never the viewport, so a table in a narrow aside or a split
     * column swaps on a desktop too, and a full-width one does not swap early on a tablet.
     *
     * The cards are the SAME processed rows the table would draw — sorted, filtered and paged — so a
     * list can never disagree with its table; a fixed card order is `initialSorting`, not a second
     * sort. Everything around the body stays: the header (title · count · toolbar), the bulk bar,
     * the pager, and `query` / `isLoading` / `emptyState`. `onRowActivate` makes each card
     * activatable exactly as it does a row (click, or Enter on the focused card — never Space, the
     * browser's own page scroll on a focused non-button). The selection
     * checkbox is not projected — a card list with a selection keeps its bulk bar but no ticks.
     *
     * An activatable card takes `tabIndex=0` + `data-activatable`, never `role="button"`: a card is
     * where a row's actions and links land (argo's all do), and a `button` role makes every
     * descendant presentational, so those nested controls would vanish from the accessibility tree.
     * The affordance is the cursor and the focus ring, as on the row. `maxHeight` caps the card list
     * in a `ScrollArea`; `minWidth` does not apply — it is a horizontal floor for columns, and a
     * card list has none. `stickyHeader` has nothing to stick while the cards render. A card order
     * with no user sort is `data`'s own order — sort it there (or `initialSorting`) for a domain
     * order.
     *
     * Reach for it when the row carries more than the columns a phone can hold (a status + label +
     * age header, a clamped title, a prose line). A table that only needs to shed a column or two
     * already has that: the column fold hides the lowest-priority columns behind a per-row
     * disclosure with no prop at all. Server render and first paint are the table.
     *
     * @example
     * <BasaltDataTable data={items} columns={columns} onRowActivate={open}
     *   renderCard={(item) => <ItemCard item={item} />} />
     */
    renderCard?: (row: T) => ReactNode
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

    /**
     * Per-row actions as typed data. The table renders them itself in a trailing, pinned,
     * header-less column: an icon button for one action that carries an `icon`, an overflow menu
     * for anything else. Clicking either never fires `onRowActivate`. Never put a `Menu` or
     * `ActionIcon` in a `display` / `cell` renderer (`basalt/control-outside-home`).
     *
     * Pass a STABLE reference — a module constant or a `useMemo` — because the column is rebuilt
     * whenever the array identity changes. A `renderCard` projection owns its own card, so the
     * column renders in the table body only.
     *
     * State-dependent actions keep that array stable and read the state per row: put it in
     * `disabled(row)` / `loading(row)` (state in a ref or the row itself), or `useMemo` the array
     * keyed on exactly that state.
     *
     * @example
     * const ROW_ACTIONS: DataTableRowAction<Row>[] = [
     *   { key: 'edit', label: 'Edit', icon: <IconEdit />, onClick: (row) => edit(row) },
     *   { key: 'delete', label: 'Delete', danger: true, onClick: (row) => remove(row) },
     * ]
     * <BasaltDataTable rowActions={ROW_ACTIONS} rowLabel={(row) => row.name} … />
     */
    rowActions?: DataTableRowAction<T>[]
    /** Names a row for assistive tech in its action controls; default `Row N actions`. */
    rowLabel?: (row: T) => string

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
     * Enables sticky start/end column pinning — pinned columns stick to the edge with a panel
     * background and a hairline shadow separator while the table scrolls horizontally. Pin columns
     * via `initialColumnPinning` (`{ start: string[], end: string[] }`).
     * @default false
     * @example
     * <BasaltDataTable data={rows} columns={columns} enablePinning initialColumnPinning={{ start: ['name'] }} />
     */
    enablePinning?: boolean
    /** Initial column-pinning state — which column ids stick to the start/end edge. */
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
     * turns on the CAPPED scroll container; `maxHeight` alone implies `minWidth: 0`.
     *
     * It is a FLOOR, not the containment switch — since the shell made `AppShell.Main` the
     * scrollport, every table renders inside a `Table.ScrollContainer type="native"` whether or not
     * this is set (`minWidth: 0` when it is not), so a table wider than its column scrolls inside
     * its own card instead of widening the page. Reach for this only to hold a MINIMUM table width
     * — e.g. so eight columns keep their readable widths and scroll rather than compress.
     *
     * Setting it also switches the column fold OFF (a declared floor is the caller saying "this
     * table is at least this wide", which folding columns out would contradict), so a `minWidth`
     * table scrolls where the same table without it folds. `maxHeight` alone keeps the fold.
     *
     * The one table whose wrapper is MEASURED rather than declared is `stickyHeader` with neither
     * this nor `maxHeight`; see that prop and `useMeasuredContainment` in the implementation for
     * why, and pair it with `maxHeight` if the table must both scroll and stick.
     */
    minWidth?: number | string
    /**
     * Sticky header row. Pair with `maxHeight` to stick within the table rather than the page.
     *
     * On its own — no `maxHeight`, no `minWidth` — the header sticks against the page's scrollport
     * (`AppShell.Main`) only while the table FITS its container, and basalt measures that: the
     * wrapper declares no overflow while it fits and flips to `overflow-x: auto` once the table is
     * wider, publishing `data-contained`. The columns stay reachable either way and the page never
     * scrolls sideways, but a sticky header cannot stick inside an uncapped overflow box — it has
     * no scroll range — so it is inert at that width. A dev warning states the trade; pair this
     * with `maxHeight` for a table that must both scroll and stick at every width.
     */
    stickyHeader?: boolean
    /**
     * Offset for a sticky header sitting under whatever chrome scrolls above it (px number or CSS
     * length).
     *
     * PAGE-scroll only, and IGNORED whenever `maxHeight`/`minWidth` turn on the scroll container:
     * that box is then the header's own scrollport, so an offset would park the `<thead>` that many
     * pixels down inside the body — painting it over the rows instead of above them. Inside the
     * container the header sticks to the scroller's own top edge.
     *
     * Inside `BasaltShell` the page's scrollport is `AppShell.Main`, and the app header sits
     * OUTSIDE it — so the only chrome left to clear is `PageBar` row 2's band:
     * `var(--basalt-page-bar-h, 0px)`, not the header height plus it.
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

/**
 * A skeleton cell's floor by `meta.kind`, rem: roughly what a typical value of the kind measures, so
 * a loading table plans the same fold as the loaded one instead of squeezing every column to its
 * (narrow) header. A column without a kind keeps its natural width.
 */
const SKELETON_MIN_REM: Record<string, number> = {
  entity: 7,
  text: 6,
  'relative-time': 5,
  status: 4,
  money: 4.5,
  number: 3.5,
}

function skeletonMinWidth<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
): string | undefined {
  const kind = resolveKind(column)
  const rem = kind === undefined ? undefined : SKELETON_MIN_REM[kind]
  return rem === undefined ? undefined : `${rem}rem`
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

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const

// ── Numeral cell idiom (SPEC D33: figures are the proportional sans with `tabular-nums`, mono is
// for captions, times and code) — auto-detected from the cell's raw value (no column-level opt-in
// prop needed) so every numeric column gets tabular figures with zero call-site configuration.
const NUMERIC_CELL_STYLE: CSSProperties = {
  fontSize: VX.text.sm,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--vx-ink)',
}

// docs/DESIGN-SPEC.md §3: mono/micro-label idiom for the pagination bar's row-count label — the
// header's own micro size, so a paginated table reads in three sizes (micro, sm, the field's 16).
const RANGE_LABEL_STYLE: CSSProperties = {
  fontFamily: 'var(--mantine-font-family-monospace)',
  fontSize: VX.text.micro,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--vx-faint)',
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * The header row's two halves (`docs/waves/design-parity/SPEC.md` § 6.6). The TOOLBAR grows and the
 * title does not: the title ellipsizes into whatever it needs, and the toolbar takes the rest of the
 * row, so its facet row (`FilterSet`, `flex: 1 1 auto`) fills it and pushes the `actions` slot to
 * the right edge — beside the title when the two fit, full-width under it when they do not.
 *
 * Both SHRINK, and that half is not a preference. `CtlSlot` between the header row and the toolbar
 * is `display: contents`, so the toolbar `Group` IS the row's flex item — and a flex item with
 * `min-width: auto` cannot give up a pixel. MEASURED at 390x844 on `/data`: a 220px search beside a
 * 230px facet pill row, gap 11, is a 461px item in a 302px column, and `AppShell.Main` read
 * `scrollWidth` 505 against `clientWidth` 390 — the whole app draggable sideways over a table
 * header. `min-width: 0` lets the item shrink to the column; inside it the search gives up width
 * down to its floor and `FilterSet` folds what still does not fit behind its own `+N`.
 *
 * The toolbar is ONE row at every container width from the `compact` class (240px) up
 * (`.toolbar` in `data-table.module.css`, keyed on the header row's own width — never the
 * viewport). Only below it may the row wrap.
 */
const TABLE_HEADER_LEAD_STYLE: CSSProperties = { flex: '0 1 auto', minWidth: 0 }
const TABLE_TOOLBAR_STYLE: CSSProperties = { flex: '1 1 auto', minWidth: 0 }
/**
 * The toolbar search's width. Mantine's Input grows to its container, which in a `justify:
 * space-between` row means "whatever is left" — so the field was 600px on a wide table and 180px on a
 * narrow one, for the same one-word query. A stated width also makes the toolbar's own minimum width
 * knowable, which is what lets it wrap under the title below `sm` with no media query.
 *
 * The field states a BASIS and a `width`, both `SEARCH_WIDTH`: `flex: 0 1 <SEARCH_WIDTH>px` holds it
 * at 220px wherever 220 is available and lets it shrink where it is not, floored at `12ch` (a legible
 * query plus the search glyph) and capped at `100%` so it can never be the box that outgrows its
 * column. The `width` is the field's intrinsic contribution: the toolbar is sized by its items'
 * max-content, and an input's own (~196px) came out short of the basis, which wrapped the facet pills
 * under the search at 1440. It is no floor — `min-width: 12ch` is. A literal `w={220}` in a 302px
 * column was half of the overflow above.
 */
const SEARCH_WIDTH = 220
/**
 * The search gives up width FIRST. Flex shrinks items in proportion to `shrink × basis`; at `1` the
 * search and `FilterSet`'s row (`flex: 1 1 auto`, whose slots cannot shrink) split the deficit, so the
 * pills overflowed their own box and the phone's `Filters` pill was clipped. A large factor takes the
 * whole deficit from the search until its `12ch` floor, and only then from the pill row — where
 * `FilterSet`'s fold takes over.
 */
const SEARCH_SHRINK = 100
/** How long the global search waits after the last keystroke before filtering. */
const SEARCH_DEBOUNCE_MS = 250
const TABLE_SEARCH_STYLE: CSSProperties = {
  // `width` as well as the basis — see the `SEARCH_WIDTH` JSDoc.
  width: SEARCH_WIDTH,
  flex: `0 ${SEARCH_SHRINK} ${SEARCH_WIDTH}px`,
  minWidth: '12ch',
  maxWidth: '100%',
}
/** The rows-per-page Select's width — see `SEARCH_WIDTH` for why a toolbar field states one. */
const PAGE_SIZE_WIDTH = 116

// ── Column pinning helpers ────────────────────────────────────────────────────

// Merges the start/center/end header-group triad TanStack exposes for pinning into the single
// render order (start → center → end) the header row needs — depth-indexed so grouped headers
// (multi-row) still line up.
function getOrderedHeaderGroups<T extends RowData>(table: TanstackTable<BasaltTableFeatures, T>) {
  const start = table.getStartHeaderGroups()
  const center = table.getCenterHeaderGroups()
  const end = table.getEndHeaderGroups()
  return center.map((group, index) => ({
    ...group,
    headers: [...(start[index]?.headers ?? []), ...group.headers, ...(end[index]?.headers ?? [])],
  }))
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
  if (process.env.NODE_ENV !== 'production') throw new Error(message)
  if (reportedBreaches.has(message)) return
  reportedBreaches.add(message)
  console.error(message)
}

/**
 * MEASURED CONTAINMENT — the wrapper for the ONE table shape whose overflow mode cannot be decided
 * statically: `stickyHeader` with neither `maxHeight` nor `minWidth`.
 *
 * Every other table renders inside `Table.ScrollContainer type="native"`, because a bare `<table>`
 * sizes to its own min-content and would drag the page sideways. This shape cannot take that
 * container unconditionally: an `overflow-x: auto` box also computes `overflow-y`, making it the
 * sticky header's own scrollport with no scroll range, so the `<thead>` scrolls clean away.
 *
 * So the wrapper's overflow is MEASURED. While the table FITS, the wrapper is bare and the sticky
 * header sticks; once it is WIDER, the wrapper flips to `overflow-x: auto` and the header is inert.
 * The trade is deliberate: a header that stops sticking is recoverable, a page that scrolls
 * sideways is not.
 *
 * Three invariants: the observer stays alive in BOTH states (no one-way latch, so the wrapper
 * reverts when the space returns); equality counts as FITS (a `width: 100%` table reads
 * `offsetWidth === clientWidth`, which stops oscillation); and a zero `clientWidth` is `unknown`,
 * not overflow (the aside animates its width in from 0). `useLayoutEffect` runs before paint, so an
 * already-measurable table resolves without a flash; the default is bare for SSR and first paint.
 */
function useMeasuredContainment(active: boolean): {
  wrapperRef: RefObject<HTMLDivElement | null>
  contained: boolean
} {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [contained, setContained] = useState(false)

  // The same measured-fold core `useColumnFold` uses, so this shape no longer mounts a second
  // bespoke `ResizeObserver` on the wrapper + table.
  useMeasuredWidths({
    resolveRoot: () => wrapperRef.current,
    signature: String(active),
    enabled: active,
    // The TABLE too, not only the wrapper: a column set that re-measures (a facet filter changing
    // the widest cell, a font settling) moves the table's min-content width while the wrapper's
    // box never changes at all.
    extra: (root) => [root.querySelector('table')],
    onMeasure: (root) => {
      const table = root.querySelector('table')
      // Three answers, not two — see the docblock. A zero reading is an un-laid-out ancestor
      // (the aside animating in from 0), not overflow, so it moves neither the state nor the
      // observer; equality counts as FITS and stops the fit/contained oscillation.
      if (table === null || root.clientWidth === 0 || table.offsetWidth === 0) return
      const next = table.offsetWidth > root.clientWidth
      setContained((current) => (current === next ? current : next))
    },
  })

  return { wrapperRef, contained: active && contained }
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
export function BasaltDataTable<T extends RowData>(props: BasaltDataTableProps<T>) {
  // F-ERR-1: without this, a table missing `data`/`columns` fails deep inside `useTable` as a
  // raw `TypeError` caught by `RootBoundary` — a blank subtree with no message naming either
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
    highlightOnHover = true,
    emptyState,
    isLoading = false,
    query,
    skeletonRows,
    enableGlobalFilter = false,
    globalFilterPlaceholder = 'Search…',
    searchIcon,
    facets,
    manualFiltering = false,
    actions,
    onRowActivate,
    renderCard,
    enableRowSelection = false,
    getRowId,
    bulkActions,
    rowActions,
    rowLabel,
    enablePagination = false,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    manualPagination = false,
    rowCount,
    pageCount,
    enablePinning = false,
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
  const tableState = useDataTableState(props, pageSizeOptions[0] ?? 10)
  const { globalFilter, columnPinning, onGlobalFilterChange: handleGlobalFilterChange } = tableState
  // The input binds to a local draft so typing stays instant; the table (and `onGlobalFilterChange`)
  // only see the value once typing pauses. Invariant: the debounced commit is the ONLY writer of
  // `globalFilter`, so the draft never needs syncing back from it. `flushOnUnmount` delivers a
  // pending keystroke to `onGlobalFilterChange` rather than dropping it with the table.
  const [searchDraft, setSearchDraft] = useState(globalFilter)
  const commitSearch = useDebouncedCallback(handleGlobalFilterChange, {
    delay: SEARCH_DEBOUNCE_MS,
    flushOnUnmount: true,
  })

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
      stickyHeader !== true || maxHeight !== undefined || minWidth !== undefined
        ? null
        : `${BASALT_PREFIX} BasaltDataTable: prop "stickyHeader" with neither "maxHeight" nor ` +
          '"minWidth" sticks only while the table FITS its container. basalt measures it: a table ' +
          'wider than the space it has flips its wrapper to `overflow-x: auto` so the columns ' +
          'stay reachable and the page never scrolls sideways, and a sticky header cannot stick ' +
          'inside that box — it has no scroll range. Pair it with "maxHeight" for a table that ' +
          'must both scroll and stick.',
    ],
    [
      stickyHeaderOffset,
      maxHeight,
      minWidth,
      stickyHeader,
      query === undefined,
      props.isLoading === undefined,
    ],
  )

  // Facets are TanStack `columnFilters` entries under the hood — inject an exact-match (or
  // any-of, for `multiple`) filterFn onto the matching column so the built-in `includesString`
  // auto-filter (substring match) never misfires against a Select's exact option value.
  const facetColumns = useMemo(() => {
    if (!facets || facets.length === 0) return columns
    const facetById = new Map(facets.map((facet) => [facet.columnId, facet]))
    return columns.map((column) => {
      const id = columnDefId(column)
      const facet = id === undefined ? undefined : facetById.get(id)
      if (!facet) return column
      const filterFn: FilterFn<BasaltTableFeatures, T> = facet.multiple ? facetAnyOf : facetExact
      return { ...column, filterFn }
    })
  }, [columns, facets])

  // The checkbox column is PREPENDED here rather than asked of the caller, so `columns` stays the
  // caller's own data columns and `meta.align` / `numeral` never have to reason about a synthetic
  // one. Everything counting columns downstream reads `columnCount`, below.
  const hasRowActions = rowActions !== undefined && rowActions.length > 0
  const tableColumns = useMemo(
    () => [
      ...(enableRowSelection ? [selectionColumn<T>()] : []),
      ...facetColumns,
      ...(hasRowActions ? [rowActionsColumn<T>(rowActions, rowLabel)] : []),
    ],
    [facetColumns, enableRowSelection, hasRowActions, rowActions, rowLabel],
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

  // A capped body or a horizontal floor both need the same native scroll node — computed here,
  // ahead of the table, because `pageStickyHeader` (further down) needs it: `maxHeight` alone still
  // wants its own `ScrollArea` scrollport (a sticky `<thead>` resolves against it, not the measured
  // containment div, which offers no vertical scroll box at all), so EITHER prop rules out the
  // measured-containment shape.
  const scrolls = maxHeight !== undefined || minWidth !== undefined

  // Fold eligibility is narrower than `scrolls`: only `minWidth` is a genuinely DECLARED horizontal
  // floor — the caller is stating "this table is at least this wide," which folding columns out of
  // would contradict. `maxHeight` alone is a purely VERTICAL cap and orthogonal to column width, so
  // a `stickyHeader` + `maxHeight` table (the pairing this package's own docs recommend for a
  // capped, sticky-header body) still folds instead of silently regressing to horizontal scroll.
  const foldEligible = minWidth === undefined

  // The fold order is computed off the caller's OWN `columns` — never `tableColumns` — so the
  // selection checkbox (prepended below) is never a fold candidate; see `foldOrder`'s docblock for
  // the declared-order default and the explicit-priority rule. `enableHiding: false` and a PINNED
  // column are excluded outright, not merely de-prioritized — both are the caller stating this
  // column must stay visible, the same declaration a fold candidate has no way to override.
  const { columnFoldOrder, columnFoldFixedIds, pinCandidates } = useMemo(() => {
    const pinnedIds = new Set([...columnPinning.start, ...columnPinning.end])
    const excluded = new Set(
      columns.flatMap((column) => {
        const id = columnDefId(column)
        if (id === undefined) return []
        return column.enableHiding === false || pinnedIds.has(id) ? [id] : []
      }),
    )
    return {
      columnFoldOrder: foldOrder(columns).filter((id) => !excluded.has(id)),
      columnFoldFixedIds: [...excluded],
      // Leaf columns the caller did not pin itself, declared order: a caller's END pin must not
      // also become the start pin, where TanStack would resolve it as start.
      pinCandidates: columns.flatMap((column) => {
        const id = columnDefId(column)
        return id === undefined || 'columns' in column || pinnedIds.has(id) ? [] : [id]
      }),
    }
  }, [columns, columnPinning])
  // ── The query branch (law C3) ───────────────────────────────────────────────
  // `query`, when given, owns the body: it resolves the pending branch `isLoading` used to own,
  // plus the error branch the table had none of. `isLoading` stays live for every caller who never
  // had a query result to hand — the dev warning above covers the pair.
  const branch = query === undefined ? undefined : dataQueryBranch('BasaltDataTable', query)
  const showSkeleton = branch === undefined ? isLoading : branch === 'pending'
  const queryError = branch === 'error' && query !== undefined ? query : undefined
  // The card projection unmounts the table, so the fold and the containment wrapper go inactive with
  // it — their measuring effects re-attach to the remounted table when the width returns.
  const { cards: showCards, rootRef: projectionRootRef } = useCardProjection(
    renderCard !== undefined,
  )
  const renderedRows = useRef(0)
  // The row count the table last showed with data: a reload skeleton is that tall, not a guess.
  const [lastLoadedRows, setLastLoadedRows] = useState(0)
  const foldExtraIds = useMemo(
    () => [
      ...(enableRowSelection ? [SELECT_COLUMN_ID] : []),
      ...(hasRowActions ? [ACTIONS_COLUMN_ID] : []),
    ],
    [enableRowSelection, hasRowActions],
  )
  const {
    folded: foldedColumns,
    wrapperRef: foldWrapperRef,
    pinId: autoPinId,
    overflowing: foldOverflowing,
    widths: measuredWidths,
  } = useColumnFold({
    active: foldEligible && !showCards,
    order: columnFoldOrder,
    fixedIds: columnFoldFixedIds,
    extraIds: foldExtraIds,
    pinCandidates,
    // An explicit caller pin wins: the fold already treats it as fixed overhead, and a second,
    // implicit one beside it would stack two sticky columns nobody asked for.
    // A one-column table has nothing to scroll beside an identifier.
    allowPin: columnPinning.start.length === 0 && columns.length > 1,
    headerOnly: showSkeleton || queryError !== undefined,
    renderedRows,
  })
  const columnVisibility: ColumnVisibilityState = useMemo(
    () => Object.fromEntries([...foldedColumns].map((id) => [id, false])),
    [foldedColumns],
  )
  const hasFolded = foldedColumns.size > 0
  const foldRows = useRowDisclosure({ data, getRowId })

  // The actions column always sticks to the end edge, behind any end-pinned columns the caller
  // asked for — so it is pinned through TanStack's own state, which also keeps their offsets right.
  //
  // The auto-pin (SPEC § 6.6): once the fold has hit its floor and the table STILL overflows, the
  // first visible data column pins to the start edge (with the checkbox column ahead of it) so the
  // rest scrolls under a fixed identifier. It rides TanStack's own `columnPinning` state, merged
  // with the caller's — which wins outright whenever it pins a start column itself.
  const pinningActive = enablePinning || hasRowActions || autoPinId !== undefined
  const tablePinning = useMemo(() => {
    const start =
      autoPinId === undefined
        ? columnPinning.start
        : [...(enableRowSelection ? [SELECT_COLUMN_ID] : []), autoPinId]
    const end = hasRowActions ? [...columnPinning.end, ACTIONS_COLUMN_ID] : columnPinning.end
    return { start, end }
  }, [columnPinning, hasRowActions, autoPinId, enableRowSelection])
  // The fold toggle column leads the row and sticks beside the pinned start cells, so they sit past it.
  const pinStartOffset = hasFolded && tablePinning.start.length > 0 ? HIT_COARSE : 0
  const autoPinMinWidth =
    autoPinId === undefined
      ? undefined
      : (columns.find((column) => columnDefId(column) === autoPinId)?.minSize ?? PIN_MIN_WIDTH)
  const tableId = useId()

  const table = useTable({
    features: basaltTableFeatures,
    data,
    columns: tableColumns,
    defaultColumn: { cell: DEFAULT_CELL },
    state: {
      sorting: tableState.sorting,
      globalFilter,
      columnFilters: tableState.columnFilters,
      columnPinning: tablePinning,
      columnVisibility,
      ...(enablePagination && { pagination: tableState.pagination }),
      ...(enableRowSelection && { rowSelection: tableState.rowSelection }),
    },
    onSortingChange: tableState.onSortingChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onColumnFiltersChange: tableState.onColumnFiltersChange,
    onColumnPinningChange: tableState.onColumnPinningChange,
    ...(enablePagination && { onPaginationChange: tableState.onPaginationChange }),
    ...(enableRowSelection && {
      enableRowSelection: true,
      onRowSelectionChange: tableState.onRowSelectionChange,
    }),
    ...(getRowId !== undefined && { getRowId }),
    // Every row model is registered on the feature set (v9 has no per-render switch) and BYPASSED by
    // these flags, which is TanStack's own seam — so a degraded table renders `data` in the order
    // and completeness the server sent it. Sorting/filtering are forced only by a BREACH, never by
    // `enableSorting={false}` on its own: that pair still applies an `initialSorting` today (it
    // disables the header control, not the row model) and a table that is not misreporting has no
    // business losing it. Pagination is bypassed whenever it is not enabled, or is server-driven.
    manualSorting: manualSorting || breaches.includes('sorting'),
    manualFiltering: manualFiltering || breaches.includes('filtering'),
    manualPagination: !enablePagination || manualPagination,
    ...(enablePagination && {
      ...(manualPagination && rowCount !== undefined && { rowCount }),
      ...(manualPagination && pageCount !== undefined && { pageCount }),
    }),
    enableSorting: sortingEnabled,
    enableColumnPinning: pinningActive,
  })

  const showSearch = enableGlobalFilter && filteringEnabled
  const showFacets = hasFacets && filteringEnabled
  const showToolbar = showSearch || showFacets || Boolean(actions)
  // The PHONE tier of the toolbar, read off the header row's own width (never the viewport): below
  // the `regular` container class the facets live behind the one `Filters (n)` pill
  // (`FilterSet inline={0}`) — a search, a facet pill, `Filters` and the actions cannot share a
  // ~272px row, and two homes for the same facets is worse than one.
  const { ref: headerRef, narrow: narrowToolbar } = useNarrowerThan(
    CONTAINER_CLASSES.regular,
    showToolbar,
  )

  // Every colSpan and every skeleton row counts the RENDERED columns: one more than `columns` for
  // the prepended checkbox column, one more again for the fold-disclosure toggle once anything has
  // folded — a stale count left the empty state and the error row short of the header.
  const columnCount =
    columns.length +
    (enableRowSelection ? 1 : 0) +
    (hasRowActions ? 1 : 0) +
    (hasFolded ? 1 : 0) -
    foldedColumns.size

  // ARIA column positions (WCAG F102): `aria-colcount` counts the FULL column set — folded and
  // hidden columns included — and every cell's `aria-colindex` is its 1-based slot in that order,
  // so a fold leaves a gap a screen-reader user can hear. The fold toggle column is a real cell
  // leading the row, so while it renders it takes slot 1 and shifts the rest.
  const fullLeafColumns = pinningActive
    ? [
        ...table.getStartLeafColumns(),
        ...table.getCenterLeafColumns(),
        ...table.getEndLeafColumns(),
      ]
    : table.getAllLeafColumns()
  const colIndexOffset = hasFolded ? 1 : 0
  const colIndexById = new Map(
    fullLeafColumns.map((column, index) => [column.id, index + 1 + colIndexOffset]),
  )
  const ariaColCount = fullLeafColumns.length + colIndexOffset
  // What the toggle announces: the folded columns' own headers, in column order.
  const foldedLabel = fullLeafColumns
    .filter((column) => foldedColumns.has(column.id))
    .map((column) => columnLabel(column))
    .join(', ')

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
  const headerGroups = pinningActive ? getOrderedHeaderGroups(table) : table.getHeaderGroups()
  // The rows actually rendered, not `data` — a filter or a page index that matches nothing leaves
  // `data` non-empty while the body has nothing in it, and a blank body reads as a broken table.
  const rows = table.getRowModel().rows
  const stateless = showSkeleton || queryError !== undefined
  useLayoutEffect(() => {
    renderedRows.current = rows.length
  })
  // Derived during render (React's own seam for state that follows a prop), not in an effect.
  if (!stateless && rows.length > 0 && rows.length !== lastLoadedRows) {
    setLastLoadedRows(rows.length)
  }

  // `stickyHeaderOffset` is a WINDOW-scroll concept — the height of whatever fixed chrome the page
  // scrolls under (the AppShell header plus `PageBar` row 2). Inside the scroll container it is
  // always wrong: that box is the sticky header's own scrollport, so the offset parks the `<thead>`
  // that many pixels DOWN INSIDE the body rather than above it. MEASURED on `/data-stress`
  // (`stickyHeader` + `minWidth`, no `maxHeight`): `calc(48px + 46px)` put the header at y=339 with
  // row 1 at y=284 and row 2 at y=327 — the header painted over row 2 at initial scroll, at 1440x900
  // and 390x844 alike. `overflow-x: auto` computes `overflow-y` to `auto` too, so the container is a
  // scrollport even with no `maxHeight` and the header never scrolls back into place. The scroller's
  // own top edge is the only correct anchor here, so the offset is dropped rather than honoured.
  //
  // THE ONE SHAPE WHOSE OVERFLOW IS MEASURED, NOT DECLARED. Every other table renders inside a
  // `Table.ScrollContainer` (see the render branch below), because a bare `<table>` sizes to its
  // own min-content and a 5-column table is ~450px wide — it widened the whole page at 390px, which
  // is the defect `tests/layout/no-horizontal-overflow.layout.test.ts` guards. A page-scrolled
  // sticky header cannot take that container unconditionally, so it takes the wrapper
  // `useMeasuredContainment` drives instead: bare while the table fits, `overflow-x: auto` once it
  // does not. Its docblock carries the full accounting.
  const pageStickyHeader = !scrolls && stickyHeader === true
  const { wrapperRef: containmentRef, contained } = useMeasuredContainment(
    pageStickyHeader && !showCards,
  )
  const resolvedStickyHeaderOffset = scrolls ? undefined : stickyHeaderOffset
  // The declared-`minWidth` shape has no fold hook, so its scroller is measured on its own.
  const { wrapperRef: minWidthScrollerRef, contained: minWidthOverflowing } =
    useMeasuredContainment(!foldEligible && !showCards)
  // A scroll container is a keyboard tab stop ONLY while it actually scrolls (WCAG 2.1.1 — a
  // sighted keyboard user otherwise has no way to reach the clipped columns), and a focusable box
  // needs a role and a name (axe `scrollable-region-focusable`). The ring is `.scroller`'s.
  const scrollerLabel = `${title ?? 'Table'}, scrolls horizontally`
  const scrollerProps = (overflowing: boolean) =>
    overflowing
      ? { tabIndex: 0, role: 'region', 'aria-label': scrollerLabel, className: classes.scroller }
      : undefined

  // The error branch the table did not have (components audit #3) carries the query's OWN `refetch`
  // behind Retry, so the failure is reported where the rows would have been — in a row spanning
  // every rendered column, or in place of the card list.
  const errorNode = queryError !== undefined && (
    <ErrorState
      error={queryError.error}
      title="Could not load"
      tier="section"
      className={classes.errorState}
      retrying={queryError.fetchStatus === 'fetching'}
      onRetry={() => void queryError.refetch()}
    />
  )
  // An empty body never out-sizes the table's own title (SPEC § 6.11): `EmptyState` reads this var
  // for its title, so it takes the title's tier, or `sm` when the table has none.
  const emptyNode = (
    <Box
      style={
        {
          '--basalt-state-title-size': title !== undefined ? VX.text.md : VX.text.sm,
        } as CSSProperties
      }
    >
      {emptyState ?? (
        <Text c="dimmed" ta="center" size="sm" py="sm">
          No data to display.
        </Text>
      )}
    </Box>
  )

  // The cells in render order (start → center → end) with only the visible ones — the skeleton rows
  // mirror the header with it.
  const orderedVisibleColumns = pinningActive
    ? [
        ...table.getStartVisibleLeafColumns(),
        ...table.getCenterVisibleLeafColumns(),
        ...table.getEndVisibleLeafColumns(),
      ]
    : table.getVisibleLeafColumns()
  // One description of every sticky cell, read by the header, skeleton and body sites alike.
  const pinCtx: PinContext<T> = {
    table,
    startOffset: pinStartOffset,
    autoPinId,
    autoPinMinWidth,
  }
  const toggleCell = foldToggleCellProps(pinCtx)
  const { fitIds, spacer } = planColumnSizing(
    orderedVisibleColumns,
    new Set([SELECT_COLUMN_ID, ACTIONS_COLUMN_ID]),
  )
  const fitAttr = (id: string) => (fitIds.has(id) ? { 'data-fit': true } : undefined)
  // colSpan covers the rendered cells, the trailing spacer included.
  const spanCount = columnCount + (spacer ? 1 : 0)
  // A page of rows when paginated, else what the table last showed, else the caller's guess.
  const skeletonCount = enablePagination
    ? table.state.pagination.pageSize
    : lastLoadedRows > 0
      ? lastLoadedRows
      : (skeletonRows ?? 5)

  const tableNode = (
    <Table
      className={cx(
        classes.table,
        pageStickyHeader && !contained && classes.pageSticky,
        classNames?.table,
      )}
      aria-colcount={ariaColCount}
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
            {/* The disclosure toggle column sorts and selects nothing: its header says that columns
                are folded, and which. */}
            {hasFolded && (
              <Table.Th {...toggleCell} aria-colindex={1}>
                <FoldHeaderLabel count={foldedColumns.size} foldedLabel={foldedLabel} />
              </Table.Th>
            )}
            {headerGroup.headers.map((header) => {
              const canSort = sortingEnabled && header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              const toggleSorting = header.column.getToggleSortingHandler()
              const pinned = pinningActive ? pinnedCellProps(pinCtx, header.column) : undefined
              const align = resolveAlign(header.column) ?? kindAlign(resolveKind(header.column))
              const isSelectColumn = header.column.id === SELECT_COLUMN_ID
              const isFoldCandidate = !isSelectColumn && header.column.id !== ACTIONS_COLUMN_ID
              return (
                <Table.Th
                  key={header.id}
                  aria-colindex={colIndexById.get(header.column.id)}
                  className={cx(isSelectColumn && classes.selectCell, pinned?.className)}
                  {...fitAttr(header.column.id)}
                  // The measured fold's own read (`useColumnFold`): a candidate's width plans the
                  // fold, the checkbox / actions column's is fixed overhead against it.
                  {...{
                    [isFoldCandidate ? FOLD_ID_ATTR : FIXED_ID_ATTR]: header.column.id,
                  }}
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
                  aria-sort={canSort ? (sorted ? ARIA_SORT[sorted] : 'none') : undefined}
                  style={{
                    ...(canSort ? { cursor: 'pointer', userSelect: 'none' } : undefined),
                    ...(align !== undefined && { textAlign: align }),
                    ...pinned?.style,
                  }}
                >
                  {header.isPlaceholder ? null : <FlexRender header={header} />}
                  {canSort && <SortIndicator direction={sorted} />}
                </Table.Th>
              )
            })}
            {spacer && <Table.Th className={classes.spacer} aria-hidden />}
          </Table.Tr>
        ))}
      </Table.Thead>
      <Table.Tbody>
        {queryError !== undefined ? (
          <Table.Tr>
            <Table.Td colSpan={spanCount}>{errorNode}</Table.Td>
          </Table.Tr>
        ) : showSkeleton ? (
          // The same visible columns as the header — a folded table loads folded, and the pinned
          // identifier keeps its sticky cell, so nothing shifts when the rows arrive.
          Array.from({ length: skeletonCount }, (_, rowIndex) => (
            <Table.Tr key={`skeleton-${rowIndex}`}>
              {hasFolded && <Table.Td {...toggleCell} aria-colindex={1} />}
              {orderedVisibleColumns.map((column) => {
                const pinned = pinningActive ? pinnedCellProps(pinCtx, column) : undefined
                const kind = resolveKind(column)
                // The loaded grid: a content-sized column keeps the width it last measured, the
                // others the kind's floor, so the rows arrive without the columns moving.
                const measuredWidth = fitIds.has(column.id)
                  ? measuredWidths.get(column.id)
                  : undefined
                return (
                  <Table.Td
                    key={column.id}
                    aria-colindex={colIndexById.get(column.id)}
                    className={pinned?.className}
                    {...fitAttr(column.id)}
                    style={{
                      minWidth:
                        measuredWidth === undefined ? skeletonMinWidth(column) : measuredWidth,
                      ...pinned?.style,
                    }}
                  >
                    {column.id === SELECT_COLUMN_ID || column.id === ACTIONS_COLUMN_ID ? null : (
                      <KindSkeleton
                        kind={kind}
                        right={(resolveAlign(column) ?? kindAlign(kind)) === 'right'}
                      />
                    )}
                  </Table.Td>
                )
              })}
              {spacer && <Table.Td aria-hidden />}
            </Table.Tr>
          ))
        ) : rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={spanCount}>{emptyNode}</Table.Td>
          </Table.Tr>
        ) : (
          rows.map((row) => {
            const cells = pinningActive
              ? [
                  ...row.getStartVisibleCells(),
                  ...row.getCenterVisibleCells(),
                  ...row.getEndVisibleCells(),
                ]
              : row.getVisibleCells()
            const rowExpanded = hasFolded && foldRows.expanded.has(row.id)
            return (
              <Fragment key={row.id}>
                <Table.Tr
                  {...(enableRowSelection && row.getIsSelected() && { 'data-selected': true })}
                  {...activationProps(onRowActivate, row.original)}
                >
                  {hasFolded && (
                    <Table.Td {...toggleCell} aria-colindex={1}>
                      <FoldToggle
                        expanded={rowExpanded}
                        controlsId={`${tableId}-${row.id}-fold`}
                        foldedLabel={foldedLabel}
                        onToggle={() => foldRows.toggle(row.id)}
                      />
                    </Table.Td>
                  )}
                  {cells.map((cell) => {
                    const pinned = pinningActive ? pinnedCellProps(pinCtx, cell.column) : undefined
                    const pinnedValue = cell.column.id === autoPinId ? cell.getValue() : undefined
                    const kind = resolveKind(cell.column)
                    const align = resolveAlign(cell.column) ?? kindAlign(kind)
                    return (
                      <Table.Td
                        key={cell.id}
                        aria-colindex={colIndexById.get(cell.column.id)}
                        className={cx(
                          cell.column.id === SELECT_COLUMN_ID && classes.selectCell,
                          kind !== undefined && kindClass(kind),
                          pinned?.className,
                        )}
                        // The pinned column ellipsizes past its cap — the full text stays reachable.
                        {...((typeof pinnedValue === 'string' ||
                          typeof pinnedValue === 'number') && {
                          title: String(pinnedValue),
                        })}
                        {...(kind !== undefined && { 'data-kind': kind })}
                        {...fitAttr(cell.column.id)}
                        {...(stopsRowActivation(cell) && {
                          // The label's ::after fills the select cell, so a tap on it bubbles to the
                          // row; the actions menu portals out but React bubbles through the portal.
                          onClick: (event: ReactMouseEvent) => event.stopPropagation(),
                        })}
                        style={{
                          ...(kind === undefined &&
                          typeof cell.getValue() === 'number' &&
                          cell.column.columnDef.meta?.numeral !== false
                            ? NUMERIC_CELL_STYLE
                            : undefined),
                          ...(align !== undefined && { textAlign: align }),
                          ...pinned?.style,
                        }}
                      >
                        <CellContent cell={cell} />
                      </Table.Td>
                    )
                  })}
                  {spacer && <Table.Td aria-hidden />}
                </Table.Tr>
                {rowExpanded && (
                  <Table.Tr
                    id={`${tableId}-${row.id}-fold`}
                    className={classes.foldDisclosureRowTr}
                  >
                    <Table.Td
                      colSpan={spanCount}
                      className={classes.foldDisclosureCell}
                      aria-colindex={1}
                    >
                      <RowDisclosure row={row} folded={foldedColumns} />
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            )
          })
        )}
      </Table.Tbody>
    </Table>
  )

  // The `renderCard` body — the same processed rows, states and activation as the table's.
  const renderCardList = () => (
    <Stack gap="xs" className={cx(classNames?.table)}>
      {queryError !== undefined
        ? errorNode
        : showSkeleton
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <Skeleton key={`skeleton-${index}`} height={48} radius="md" />
            ))
          : rows.length === 0
            ? emptyNode
            : rows.map((row) => (
                <Box key={row.id} {...activationProps(onRowActivate, row.original)}>
                  {renderCard?.(row.original)}
                </Box>
              ))}
    </Stack>
  )

  const paginationState = table.state.pagination
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
  // A page past the end (server-driven, the count shrank) keeps its pager so the reader can step
  // back, but states no range: "Showing 91–7 of 7" is a contradiction.
  const rangeInBounds = rangeStart <= rangeEnd || total === 0
  // Only a table that has NO rows drops its footer: a filter or search that matches nothing keeps
  // it (the pager and "Showing 0–0 of 0" belong to a table that has rows to page). Loading and
  // error keep the box too, the rows are about to land.
  const unfilteredCount = manualPagination ? total : table.getPreFilteredRowModel().rows.length
  const showFooter = enablePagination && (stateless || unfilteredCount > 0)

  return (
    <div
      ref={projectionRootRef}
      className={cx(classNames?.root, className)}
      {...(style !== undefined && { style })}
    >
      {/*
       * ONE header row: the `WidgetHeader` (title · count) on the left, the toolbar right-aligned in
       * the SAME row. It was two stacked rows with `mb="xs"` on each, so a titled table with search
       * spent title → 11px → search → 11px → thead before a single datum appeared, and the toolbar
       * read as page furniture rather than as this table's controls.
       *
       * `wrap="wrap"` is the header row's own: a toolbar whose natural width exceeds what is left
       * beside a title drops under it, full width. The TOOLBAR itself never wraps from the `compact`
       * container class up (`.toolbar`) — the search shrinks to its floor and `FilterSet` folds the
       * rest behind `+N`. `align="center"` puts the 28px controls on the title's optical line.
       */}
      {(title !== undefined || showToolbar) && (
        <Group
          ref={headerRef}
          className={classes.tableHeader}
          justify="space-between"
          align="center"
          wrap="wrap"
          gap="xs"
          mb="xs"
        >
          {title !== undefined ? (
            <Box style={TABLE_HEADER_LEAD_STYLE}>
              <WidgetHeader
                tier="widget"
                title={title}
                {...(icon !== undefined && { icon })}
                {...(subtitle !== undefined && { subtitle })}
                // A count is a figure read from rows: none while the rows are loading or failed.
                {...(!stateless && { count: table.getRowCount() })}
              />
            </Box>
          ) : null}
          {showToolbar && (
            <CtlSlot>
              <Group
                className={cx(classes.toolbar, classNames?.toolbar)}
                data-basalt-dense
                gap="xs"
                align="center"
                style={TABLE_TOOLBAR_STYLE}
              >
                {showSearch && (
                  <TextInput
                    size="ctl"
                    classNames={{ wrapper: classes.toolbarWrapper, input: classes.toolbarInput }}
                    wrapperProps={{ 'data-basalt-hit': true }}
                    radius="md"
                    style={TABLE_SEARCH_STYLE}
                    placeholder={globalFilterPlaceholder}
                    leftSection={searchIcon}
                    value={searchDraft}
                    onChange={(event) => {
                      setSearchDraft(event.currentTarget.value)
                      commitSearch(event.currentTarget.value)
                    }}
                  />
                )}
                {showFacets && (
                  <FilterSet inline={narrowToolbar ? 0 : 1}>
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
                {actions !== undefined && (
                  <div className={classes.toolbarActions}>
                    <BarActionSlot actions={actions} />
                  </div>
                )}
              </Group>
            </CtlSlot>
          )}
        </Group>
      )}
      {bulkBarActions !== undefined && (
        <BulkActionBar count={selectedRows.length} actions={bulkBarActions} />
      )}
      {showCards ? (
        maxHeight === undefined ? (
          renderCardList()
        ) : (
          <ScrollArea.Autosize mah={maxHeight} type="hover" scrollbars="y">
            {renderCardList()}
          </ScrollArea.Autosize>
        )
      ) : !foldEligible ? (
        // An explicit `minWidth` is the one genuinely DECLARED horizontal floor — the column fold
        // never engages here (see `foldEligible`, above), so this shape keeps its exact
        // pre-existing DOM: no extra measuring wrapper for a table nothing folds.
        <Table.ScrollContainer
          ref={minWidthScrollerRef}
          type="native"
          minWidth={minWidth ?? 0}
          maxHeight={maxHeight}
          {...scrollerProps(minWidthOverflowing)}
        >
          {tableNode}
        </Table.ScrollContainer>
      ) : (
        // The column fold's own measuring box (`useColumnFold`) — wraps every remaining shape,
        // `maxHeight`-only included: a vertical cap is orthogonal to column width, so a
        // `stickyHeader` + `maxHeight` table (the pairing this package's own docs recommend) still
        // folds instead of silently regressing to horizontal scroll. A plain block box, so it
        // constrains nothing on its own; `foldWrapperRef` only reads it.
        <div ref={foldWrapperRef} className={classes.foldWrapper}>
          {pageStickyHeader ? (
            // Pinning takes this wrapper too — a pinned column's offsets are `position: sticky` on
            // the cells and need no overflow box of their own, so the `overflow-x: auto` Box that
            // used to sit here was the exact inert-sticky defect this shape exists to avoid.
            <div
              ref={containmentRef}
              className={cx(classes.containment, contained && classes.scroller)}
              data-contained={contained ? 'true' : 'false'}
              {...(contained && {
                tabIndex: 0,
                role: 'region',
                'aria-label': scrollerLabel,
              })}
            >
              {tableNode}
            </div>
          ) : (
            // `pageStickyHeader` is false whenever `maxHeight` is set (`scrolls` above), so a vertical
            // cap lands here — its own `ScrollArea` scrollport, just with no `minWidth` floor.
            <Table.ScrollContainer
              type="native"
              minWidth={0}
              maxHeight={maxHeight}
              {...scrollerProps(foldOverflowing)}
            >
              {tableNode}
            </Table.ScrollContainer>
          )}
        </div>
      )}
      {showFooter && (
        <Group
          className={cx(classNames?.footer)}
          justify="space-between"
          mt="xs"
          wrap="wrap"
          gap="xs"
          align="center"
        >
          <Text
            // Hidden, not removed: the footer keeps its height and nothing shifts when rows land.
            style={
              stateless || !rangeInBounds
                ? { ...RANGE_LABEL_STYLE, visibility: 'hidden' }
                : RANGE_LABEL_STYLE
            }
          >
            Showing {rangeStart}–{rangeEnd}
            {totalIsAuthoritative ? ` of ${total}` : ''}
          </Text>
          <Group gap="xs" align="center" data-basalt-dense>
            {/* theme-allow control-outside-home — the table's own page-size setting, not a page
                filter: its state is the table's pagination, owned inside this component. */}
            <Select
              size="ctl"
              classNames={{ wrapper: classes.toolbarWrapper, input: classes.toolbarInput }}
              wrapperProps={{ 'data-basalt-hit': true }}
              radius="md"
              w={PAGE_SIZE_WIDTH}
              data={pageSizeRows}
              value={String(paginationState.pageSize)}
              onChange={(value) => value && table.setPageSize(Number(value))}
              allowDeselect={false}
            />
            <CtlSlot>
              {/* `Pagination` carries no `ctl`-tier entry in `CTL_THEME` (its own controls resolve
                  the 44px coarse hit floor through `PaginationControl`'s theme-level
                  `data-basalt-hit`, not through the `ctl` size), so `CtlSlot` cannot restore this
                  size on its own — an explicit `size="sm"` is the visual this footer always had. */}
              <Pagination
                size="sm"
                // Mantine writes `--pagination-control-size` inline from `size`, which a class cannot
                // outrank — `vars` is the seam. The `ctl` height of the dense group above: 28 at a
                // fine pointer, 32 at a coarse one, the Select's own height either way. The labels
                // read `sm`, the cells' size, whatever the `size` prop maps to.
                vars={() => ({
                  root: {
                    '--pagination-control-size':
                      'calc(var(--vx-space-control-height-ctl) * var(--mantine-scale))',
                    '--pagination-control-fz': 'var(--vx-text-sm)',
                  },
                })}
                radius="md"
                total={Math.max(table.getPageCount(), 1)}
                value={paginationState.pageIndex + 1}
                onChange={(page) => table.setPageIndex(page - 1)}
              />
            </CtlSlot>
          </Group>
        </Group>
      )}
    </div>
  )
}
