/**
 * The engine column of a kind: accessor, sort and filter wiring on the module-scope feature set,
 * no cell (the parts render `spec.render`). `useDataTable` maps each kind column through it, keyed
 * on id and kind; per-render closures stay on the spec, read through a latest-ref by the parts.
 */
import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnDef, RowData } from '@tanstack/react-table'
import type { TableEngineFeatures } from './features'
import { isAbsent } from './kinds-cells'
import type { KindSpec } from './kinds-spec'

export type EngineColumn<T extends RowData> = ColumnDef<TableEngineFeatures, T, unknown>

/** Absent is `undefined` for the engine, so `sortUndefined: 'last'` applies to `null` too. */
const normalise = (value: unknown): unknown => (isAbsent(value) ? undefined : value)

export function engineColumn<T extends RowData>(spec: KindSpec<T>): EngineColumn<T> {
  const helper = createColumnHelper<TableEngineFeatures, T>()
  const sort = spec.sort
  const sortFn =
    sort === null
      ? {}
      : 'compare' in sort
        ? {
            sortFn: (
              a: { getValue(id: string): unknown },
              b: { getValue(id: string): unknown },
              id: string,
            ) => sort.compare(a.getValue(id), b.getValue(id)),
          }
        : { sortFn: sort.fn }
  return helper.accessor((row) => normalise(spec.value(row)), {
    id: spec.id,
    header: spec.header,
    enableSorting: sort !== null,
    sortUndefined: 'last',
    ...sortFn,
    enableColumnFilter: spec.filter !== null,
    ...(spec.filter === 'contains' ? { filterFn: 'includesString' as const } : {}),
    enableGlobalFilter: spec.filter === 'contains',
    enableHiding: spec.pin === null,
    meta: { kind: spec.kind },
  }) as EngineColumn<T>
}
