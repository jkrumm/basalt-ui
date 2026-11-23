/**
 * `BulkBar` (docs/v3/concepts/data-table.md section 3, I22): the bar of bulk actions over the
 * ticked rows. It exists only while a row is ticked, so an idle table carries no empty bar. Over a
 * table it reads the selection the table owns: the count, the declared `selection.bulk` actions and,
 * when `selectAll` is on, the offer to widen a fully ticked page to every matching row. Over any
 * other list (a mailbox, a grid of cards) it takes the count and the actions as data.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { IconComponent } from '../../core/ports'
import { Button } from '../../ui/button'
import type { DataTableInstance } from '../contract'
import { modelOf } from '../use-data-table'

/** One action of a list's bulk bar: typed data, like a page action. */
export type BulkBarAction = {
  id: string
  label: string
  icon?: IconComponent | undefined
  /** `danger` for an action that deletes or cannot be undone. */
  tone?: 'danger' | undefined
  onClick: () => void
}

/** A bulk bar over a list that is not a table: the list owns its selection and hands over its size. */
export type ListBulkBarProps = {
  /** How many items are selected; the bar renders nothing at 0. */
  count: number
  /** What the selection can do, in the bar's order. */
  actions: readonly BulkBarAction[]
  /** Empties the selection. */
  onClear: () => void
}

export type BulkBarProps<T> = { table: DataTableInstance<T> } | ListBulkBarProps

const isTable = <T,>(props: BulkBarProps<T>): props is { table: DataTableInstance<T> } =>
  'table' in props

/**
 * The bulk bar of a table, or of any list that keeps its own selection. Renders nothing while
 * nothing is selected. `DataTable` composes the table form above the scroller. The list form is a
 * floating bar for the list to place at its foot: it wraps its actions rather than clip them, so
 * it fits the narrowest list it sits in.
 *
 * @useWhen a bespoke layout places a table's bulk bar itself, or a list that is not a table (a mailbox, a card grid) acts on a selection
 * @neverWhen the full `DataTable` fits (it already renders the bar)
 *
 * @example
 * <BulkBar table={t} />
 * <BulkBar count={ids.length} onClear={clear} actions={[{ id: 'archive', label: 'Archive', icon: Archive, onClick: archive }]} />
 */
export function BulkBar<T>(props: BulkBarProps<T>): ReactElement | null {
  if (isTable(props)) return <TableBulkBar table={props.table} />
  return <ListBulkBar {...props} />
}

function ListBulkBar({ count, actions, onClear }: ListBulkBarProps): ReactElement | null {
  const t = useMessages(table)
  if (count === 0) return null
  return (
    <div
      data-slot="table-bulk"
      data-floating=""
      role="toolbar"
      aria-label={t('table.bulk')}
      className="flex max-w-full min-w-0 flex-wrap items-center gap-1 rounded-card border border-border bg-popover p-1.5 text-popover-foreground shadow-overlay"
    >
      <output className="px-2 text-sm font-medium tabular-nums">
        {t('table.selectedCount', count)}
      </output>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.id}
            size="sm"
            variant={action.tone === 'danger' ? 'danger' : 'ghost'}
            onClick={action.onClick}
          >
            {Icon !== undefined && <Icon aria-hidden="true" size={16} />}
            {action.label}
          </Button>
        )
      })}
      <Button size="sm" variant="ghost" onClick={onClear}>
        {t('table.bulkClear')}
      </Button>
    </div>
  )
}

function TableBulkBar<T>({
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
            key={action.id}
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
