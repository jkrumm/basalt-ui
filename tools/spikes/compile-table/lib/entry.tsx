/**
 * The compiled unit: the v3 `./table` composite plus the one piece the shipped `DataTable` does not
 * have yet, a windowed body (`virtual` is typed in `contract.ts` but not consumed until T4). The
 * body composes the same exports a bespoke layout would (`DataTableHead`, `modelOf`,
 * `visibleColumns`, `VirtualList` with a `tr` spacer), and is built in the same pass as the rest,
 * so the compiler arm covers it. Sources are read, never changed.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles, as the table's own body does */
import type { ReactElement } from 'react'
import type { CellEnv } from '../../../../packages/basalt-ui/src/table/core/kinds-spec'
import type { DataTableInstance } from '../../../../packages/basalt-ui/src/table/contract'
import { cellAttributes } from '../../../../packages/basalt-ui/src/table/core/kinds-cells'
import { DataTableHead, visibleColumns } from '../../../../packages/basalt-ui/src/table/parts/head'
import { modelOf } from '../../../../packages/basalt-ui/src/table/use-data-table'
import { TableCell, TableRow } from '../../../../packages/basalt-ui/src/ui/table'
import { VirtualList } from '../../../../packages/basalt-ui/src/ui/virtual-list'

export { col } from '../../../../packages/basalt-ui/src/table/core/kinds'
export { DataTable } from '../../../../packages/basalt-ui/src/table/parts/data-table'
export { useDataTable } from '../../../../packages/basalt-ui/src/table/use-data-table'

const ROW_PX = 32

/** The virtual path: only the window is in the DOM; sort re-orders the 10k model rows. */
export function VirtualDataTable<T>({ table }: { table: DataTableInstance<T> }): ReactElement {
  const model = modelOf(table)
  const columns = visibleColumns(model.specs, model.plan.columns)
  const env: CellEnv = {
    format: model.format,
    now: model.now,
    box: { height: 24, phase: 'ready' },
  }
  return (
    <VirtualList
      className="scroller"
      spacer="tr"
      columns={columns.length}
      count={model.rows.length}
      estimateSize={() => ROW_PX}
      getItemKey={(index) => model.rows[index]?.id ?? index}
      head={<DataTableHead table={table} />}
    >
      {([item]) => {
        const row = model.rows[item?.index ?? 0]
        if (row === undefined) return null
        return (
          <TableRow key={row.id} role="row">
            {columns.map(({ spec }) => (
              <TableCell key={spec.id} role="cell" {...cellAttributes(spec)}>
                {spec.render?.(row.original, env) ?? null}
              </TableCell>
            ))}
          </TableRow>
        )
      }}
    </VirtualList>
  )
}
