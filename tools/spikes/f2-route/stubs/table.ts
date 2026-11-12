/**
 * Stub of `basalt-ui/table`: the v3 symbols of ARCHITECTURE section 3 (`DataTable`, `useDataTable`,
 * `col`), re-exported from their own files. `src/table/index.ts` also exports the 2.x
 * `BasaltDataTable`, which drags `@mantine/core` and `src/controls/actions` into the program; the
 * index is not a v3 barrel yet.
 */
export { col } from '../../../../packages/basalt-ui/src/table/core/kinds'
export { DataTable } from '../../../../packages/basalt-ui/src/table/parts/data-table'
export { useDataTable } from '../../../../packages/basalt-ui/src/table/use-data-table'
export type {
  DataTableProps,
  UseDataTable,
} from '../../../../packages/basalt-ui/src/table/contract'
