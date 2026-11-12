/**
 * The tick column's body cells (docs/v3/concepts/data-table.md section 3): the per-row checkbox
 * and its skeleton. The cell carries `data-kind="tick"`, not `select`: `select` is the `c.select`
 * editor kind, and the card tier places the two differently. A tick never activates its row (I2).
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Checkbox } from '../../ui/checkbox'
import { Skeleton } from '../../ui/skeleton'
import { TableCell } from '../../ui/table'
import type { SelectionApi } from '../core/selection'

/**
 * One row's tick cell.
 *
 * @useWhen a bespoke row draws the tick column itself
 * @neverWhen `DataRow` fits (it already draws the tick)
 *
 * @example
 * <TickCell selection={model.selection} id={row.id} ticked={ticked} />
 */
export function TickCell<T>({
  selection,
  id,
  ticked,
}: {
  selection: SelectionApi<T>
  id: string
  ticked: boolean
}): ReactElement {
  const t = useMessages(table)
  return (
    <TableCell role="cell" aria-colindex={1} data-kind="tick">
      <span data-slot="table-select">
        <Checkbox
          aria-label={t('table.selectRow')}
          checked={ticked}
          onCheckedChange={() => selection.toggle(id)}
        />
      </span>
    </TableCell>
  )
}

/** The tick cell of a skeleton row. */
export function TickSkeleton(): ReactElement {
  return (
    <TableCell role="cell" aria-colindex={1} data-kind="tick">
      <Skeleton className="size-4" />
    </TableCell>
  )
}
