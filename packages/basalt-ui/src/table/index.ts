/**
 * ./table — `DataTable`: a data table over @tanstack/react-table v9, drawn with `ui/*` primitives.
 * The kind column factory (`col`), a `useDataTable` hook that owns the request, selection and view
 * state, and the parts `DataTable` composes (toolbar, body, pager, bulk bar). No TanStack hook,
 * feature or row-model symbol leaves this subpath.
 *
 * Peers: @tanstack/react-table ~9.3.1 (tilde) and @base-ui/react (the `col` kinds render `ui/*`
 * primitives).
 */

// The kind column factory (docs/v3/concepts/data-table.md section 5).
export { col } from './core/kinds'
export { DataTable } from './parts/data-table'
export { useDataTable } from './use-data-table'

// The parts `DataTable` composes: a bespoke layout takes the ones it wants (rung 3).
export { TableToolbar } from './parts/toolbar'
export { useTableViews } from './parts/views'
export type { TableViewsOptions, TableViewsResult, ViewParam } from './parts/views'
export { DataTableBody } from './parts/body'
export { TablePager } from './parts/pager'
export { BulkBar } from './parts/bulk-bar'
export type { BulkBarAction, BulkBarProps } from './parts/bulk-bar'

// The URL bridge: `field.composite(tableCodec(c.codec({ ... })))` carries a table as one field.
export { tableCodec } from './core/codec'
export type { TableCodec, TableCodecOptions } from './core/codec'
export type { CodecKind, CodecOptions, TableSchema } from './core/kinds'

// The contract types (docs/v3/concepts/data-table.md section 4).
export type {
  BulkAction,
  DataTableInstance,
  DataTableProps,
  DateRangeLike,
  Facets,
  FilterModel,
  KindColumn,
  Mode,
  PageFilter,
  PageFilters,
  RowAction,
  Scrollport,
  Selection,
  StateHandle,
  TableDisplay,
  TableEscape,
  TableRequest,
  TableState,
  Totals,
  UseDataTable,
  View,
  ViewStore,
} from './contract'
