/**
 * Filter chips (docs/v3/concepts/data-table.md section 3): one chip per active filter, `subject
 * operator value` and a remove control. Chips hold no state; they read `request.filters` and
 * remove by writing it, so the toolbar and the `Filters (n)` sheet can both render them.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import type { DataTableInstance } from '../contract'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { activeFilters } from './toolbar-filters'

function CloseGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="m4 4 8 8M12 4l-8 8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** The chips of a model; shared by the public `FilterChips` and the toolbar. */
export function ChipList<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const t = useMessages(table)
  const known = new Set(model.specs.map((spec) => spec.id))
  const chips = activeFilters(model.state.request.filters, known)
  if (chips.length === 0) return null
  return (
    <ul
      data-slot="table-chips"
      aria-label={t('table.chips')}
      className="m-0 flex min-w-0 list-none flex-wrap items-center gap-2 p-0"
    >
      {chips.map((filter) => {
        const subject = model.specs.find((spec) => spec.id === filter.id)?.header ?? filter.id
        return (
          <li
            key={filter.id}
            data-slot="table-chip"
            className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-chip bg-accent py-0.5 ps-2 pe-0.5 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{subject}</span>{' '}
              <span className="text-muted-foreground">
                {filter.op === 'anyOf' ? t('table.opAnyOf') : t('table.opContains')}
              </span>{' '}
              <span className="font-medium">{filter.values.join(', ')}</span>
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('table.chipRemove', subject)}
              onClick={() =>
                model.state.setRequest({
                  filters: model.state.request.filters.filter((f) => f.id !== filter.id),
                })
              }
            >
              <CloseGlyph />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The active filters of a table as removable chips: `Name contains Ac`, `State is Open, Done`.
 * Renders nothing while no filter is active.
 *
 * @useWhen a bespoke toolbar shows the active filters of the table itself
 * @neverWhen `TableToolbar` fits (it already renders the chips)
 *
 * @example
 * <FilterChips table={t} />
 */
export function FilterChips<T>({
  table: instance,
}: {
  table: DataTableInstance<T>
}): ReactElement | null {
  return <ChipList model={modelOf(instance)} />
}
