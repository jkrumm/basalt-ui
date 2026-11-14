/**
 * The sheet a table derives when it was given no `detail` (docs/v3/concepts/data-table.md section
 * 6): a label and a value for every column of the row, so data a tier hides is reachable. The
 * value is the kind's own read-only cell, never an editor; the actions column has no data.
 */
import type { ReactElement } from 'react'
import type { Box } from '../../core/ports'
import type { CellEnv } from '../core/kinds-spec'
import type { TableModel } from '../use-data-table'

/** The title of a row's sheet: its identity column's value, else the table's label. */
export function detailTitle<T>(model: TableModel<T>, row: T): string {
  const index = model.plan.columns.findIndex((column) => column.identity)
  const spec = model.specs[index]
  const value = spec?.value(row)
  return value === undefined || value === null || value === '' ? model.label : String(value)
}

/** Every data column of the row as `label: value`, in declaration order. */
export function AutoDetail<T>({
  model,
  row,
  box,
}: {
  model: TableModel<T>
  row: T
  box: Box
}): ReactElement {
  const env: CellEnv = { format: model.format, now: model.now, box }
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {model.specs.map((spec) =>
        spec.kind === 'actions' || spec.header === '' ? null : (
          <div key={spec.id} className="col-span-2 grid grid-cols-subgrid items-baseline">
            <dt className="text-muted-foreground">{spec.header}</dt>
            <dd className="m-0 min-w-0 wrap-anywhere">{spec.render?.(row, env) ?? null}</dd>
          </div>
        ),
      )}
    </dl>
  )
}
