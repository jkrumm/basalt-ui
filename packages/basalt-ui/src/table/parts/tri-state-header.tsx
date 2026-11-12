/**
 * The header tick (docs/v3/concepts/data-table.md section 3): one checkbox with three states over
 * the rows on screen. None ticked is unchecked, some is indeterminate (v9: `some && !all`), all is
 * checked; activating it ticks the page unless it is already whole, then unticks it. It is a real
 * checkbox, so Space toggles it and Tab reaches it.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Checkbox } from '../../ui/checkbox'
import { TableHead } from '../../ui/table'
import type { TableModel } from '../use-data-table'

/** The state of the header tick for the ids on screen. */
export function triState(ticked: number, total: number): 'none' | 'some' | 'all' {
  if (ticked === 0 || total === 0) return 'none'
  return ticked === total ? 'all' : 'some'
}

/**
 * The tick column's header cell: the tri-state checkbox over the current page.
 *
 * @useWhen a bespoke head draws the tick column itself
 * @neverWhen the table has no `selection` (it renders nothing there) or `DataTableHead` fits
 *
 * @example
 * <TriStateHeader model={modelOf(t)} />
 */
export function TriStateHeader<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const t = useMessages(table)
  const { selection } = model
  if (selection === undefined) return null
  const ids = model.rows.map((row) => row.id)
  const state = triState(ids.filter((id) => selection.isSelected(id)).length, ids.length)
  return (
    <TableHead
      role="columnheader"
      aria-colindex={1}
      data-slot="table-head"
      data-kind="tick"
      className="w-10"
    >
      <Checkbox
        aria-label={t('table.selectAll')}
        checked={state === 'all'}
        indeterminate={state === 'some'}
        disabled={ids.length === 0}
        onCheckedChange={() => selection.togglePage(ids)}
      />
    </TableHead>
  )
}
