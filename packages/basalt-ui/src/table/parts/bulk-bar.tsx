/**
 * `BulkBar` (docs/v3/concepts/data-table.md section 3, I22): the bar of bulk actions over the
 * ticked rows. It exists only while a row is ticked, so an idle table carries no empty bar, and it
 * reads the selection the table owns: the count, the declared `selection.bulk` actions and, when
 * `selectAll` is on, the offer to widen a fully ticked page to every matching row.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import type { DataTableInstance } from '../contract'
import { modelOf } from '../use-data-table'

/**
 * The bulk bar of a table. Renders nothing while no row is ticked or the table has no `selection`.
 * `DataTable` composes it above the scroller.
 *
 * @useWhen a bespoke layout places the bulk bar itself, above or beside the table
 * @neverWhen the full `DataTable` fits (it already renders the bar)
 *
 * @example
 * <BulkBar table={t} />
 */
export function BulkBar<T>({
  table: instance,
}: {
  table: DataTableInstance<T>
}): ReactElement | null {
  const model = modelOf(instance)
  const t = useMessages(table)
  const { selection, bulk } = model
  if (selection === undefined || bulk === undefined || selection.count === 0) return null

  const allMatching = selection.selection.kind === 'all-matching'
  const pageIds = model.rows.map((row) => row.id)
  const pageTicked = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id))
  const total = model.count
  // Offer the widening only from a fully ticked page of a table that holds more rows than that.
  const canWiden =
    bulk.selectAll && !allMatching && pageTicked && total !== undefined && total > selection.count

  return (
    <div
      data-slot="table-bulk"
      role="toolbar"
      aria-label={t('table.bulk')}
      className="flex min-w-0 flex-wrap items-center gap-2 pb-2"
    >
      <output className="text-sm font-medium">
        {allMatching
          ? t('table.allMatching', selection.count)
          : t('table.selectedCount', selection.count)}
      </output>
      {canWiden && (
        <Button variant="ghost" onClick={() => selection.selectAllMatching(total)}>
          {t('table.selectAllMatching', total)}
        </Button>
      )}
      {bulk.actions.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.key}
            onClick={() => action.onClick(selection.rows(bulk.data), selection.selection)}
          >
            {Icon !== undefined && <Icon aria-hidden="true" size={16} />}
            {action.label}
          </Button>
        )
      })}
      <Button variant="ghost" onClick={selection.clear}>
        {t('table.bulkClear')}
      </Button>
    </div>
  )
}
