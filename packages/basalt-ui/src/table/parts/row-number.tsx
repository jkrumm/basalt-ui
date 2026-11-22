/**
 * The row-number column (`rowNumbers`, docs/v3/concepts/data-table.md section 3): a narrow column
 * after the tick that prints each row's place in the request, in tabular figures, running on across
 * groups and pages. It is a lead column like the tick: sticky in the grid look, off a phone card, and
 * empty in the head's label, a group row, the footer and a skeleton row.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { TableCell, TableHead } from '../../ui/table'
import type { CellProps } from '../core/keyboard'
import type { TableModel } from '../use-data-table'

/** The `aria-colindex` of the row-number column: after the tick when there is one. */
export function rowNumberIndex<T>(model: TableModel<T>): number {
  return model.lead.tick ? 2 : 1
}

/**
 * The row-number column's header cell; nothing when the table has no row numbers.
 *
 * @useWhen a bespoke head draws the lead columns itself
 * @neverWhen `DataTableHead` fits (it draws this cell)
 *
 * @example
 * <RowNumberHead model={model} />
 */
export function RowNumberHead<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const t = useMessages(table)
  if (!model.lead.numbers) return null
  return (
    <TableHead
      role="columnheader"
      aria-colindex={rowNumberIndex(model)}
      data-kind="row-number"
      data-card="hidden"
      numeric
    >
      <span className="sr-only">{t('table.rowNumber')}</span>
    </TableHead>
  )
}

/**
 * One row's number cell, or the empty cell of a group row, the footer or a skeleton row
 * (`id` absent).
 *
 * @useWhen a bespoke row draws the lead columns itself
 * @neverWhen `DataRow` fits (it draws this cell)
 *
 * @example
 * <RowNumberCell model={model} id={row.id} />
 */
export function RowNumberCell<T>({
  model,
  id,
  cellProps,
}: {
  model: TableModel<T>
  id?: string
  /** The grid look's cell wiring (`keyboard.cellProps`): the cell is then a grid cell. */
  cellProps?: CellProps
}): ReactElement | null {
  if (!model.lead.numbers) return null
  const number = id === undefined ? undefined : model.numberOf(id)
  return (
    <TableCell
      role={cellProps === undefined ? 'cell' : 'gridcell'}
      aria-colindex={rowNumberIndex(model)}
      data-kind="row-number"
      data-card="hidden"
      numeric
      className="text-muted-foreground tabular-nums"
      {...cellProps}
    >
      {number === undefined ? null : model.format.number(number)}
    </TableCell>
  )
}
