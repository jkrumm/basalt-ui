/**
 * The engine column of a kind: accessor, sort and filter wiring on the module-scope feature set,
 * no cell (the parts render `spec.render`). `useDataTable` maps each kind column through it, keyed
 * on id and kind; per-render closures stay on the spec, read through a latest-ref by the parts.
 */
import { createColumnHelper, sortFn_basic } from '@tanstack/react-table'
import type { ColumnDef, RowData } from '@tanstack/react-table'
import type { TableEngineFeatures } from './features'
import { isAbsent } from './kinds-cells'
import type { KindSpec } from './kinds-spec'

export type EngineColumn<T extends RowData> = ColumnDef<TableEngineFeatures, T, unknown>

/** Absent is `undefined` for the engine, so `sortUndefined: 'last'` applies to `null` too. */
const normalise = (value: unknown): unknown => (isAbsent(value) ? undefined : value)

type SortRow<T> = { original: T; getValue(id: string): unknown }

export function engineColumn<T extends RowData>(spec: KindSpec<T>): EngineColumn<T> {
  const helper = createColumnHelper<TableEngineFeatures, T>()
  const sort = spec.sort
  const text = spec.filterText
  // A column with `filterText` holds its search text in the accessor, the one value its filter reads,
  // so its sort reads the value off the row instead.
  const sortedOn = (row: SortRow<T>, id: string): unknown =>
    text === undefined ? row.getValue(id) : normalise(spec.value(row.original))
  const valueRow = (row: SortRow<T>) => ({ getValue: () => sortedOn(row, spec.id) })
  const sortFn =
    sort === null
      ? {}
      : 'compare' in sort
        ? {
            sortFn: (a: SortRow<T>, b: SortRow<T>, id: string) =>
              sort.compare(sortedOn(a, id), sortedOn(b, id)),
          }
        : text === undefined
          ? { sortFn: sort.fn }
          : {
              // `custom` is the only kind with `filterText`, and it declares `basic`
              sortFn: (a: SortRow<T>, b: SortRow<T>, id: string) =>
                sortFn_basic(valueRow(a) as never, valueRow(b) as never, id),
            }
  return helper.accessor((row) => normalise(text === undefined ? spec.value(row) : text(row)), {
    id: spec.id,
    header: spec.header,
    enableSorting: sort !== null,
    sortUndefined: 'last',
    ...sortFn,
    enableColumnFilter: spec.filter !== null,
    ...(spec.filter === 'contains' ? { filterFn: 'includesString' as const } : {}),
    // Search reads every column with a search text (all but `spark` and `actions`), through the
    // table's `globalFilterFn`, which matches what the cell shows as well as the stored value.
    enableGlobalFilter: spec.search !== undefined,
    enableHiding: spec.pin === null,
    meta: { kind: spec.kind },
  }) as EngineColumn<T>
}
