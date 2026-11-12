/**
 * Filter by cell value (docs/v3/concepts/data-table.md section 3): on `text`, `entity` and `status`
 * columns the value is a control that writes the same `f.<col>` field the toolbar writes, so there
 * is no new state and no URL change. A click is the control's own: it stops there and never
 * activates the row. In the card tier the value is plain text (the card is one activation target,
 * and a control inside it would shrink it); the swap is CSS on the table root, so the server HTML is
 * already right.
 */
import type { ReactElement, ReactNode } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Pressable } from '../../ui/button'
import type { DataTableInstance } from '../contract'
import type { KindName } from '../core/kinds-spec'
import { modelOf } from '../use-data-table'
import { filterValues, filterableSpecs, withFilter } from './toolbar-filters'

/** The kinds that have an `f.<col>` field in URL grammar v1, so the ones a cell can filter by. */
export type FilterableKind = 'text' | 'entity' | 'status'

/**
 * The `filterOnCell` option of a kind: `true` on a filterable kind, a type error on any other.
 * The kind constructors take it as `{ ...options, ...CellFilterOption<kind> }`.
 */
export type CellFilterOption<K extends KindName> = K extends FilterableKind
  ? { filterOnCell?: true }
  : { filterOnCell?: never }

/**
 * A cell value as a filter control: click to filter the column by it, click again to remove it. A
 * column with no filter renders the value as plain text.
 *
 * @useWhen a text, entity or status cell should filter its column by its own value
 * @neverWhen the cell sits in a card (it is plain text there by itself) or the kind has no filter
 *
 * @example
 * <CellFilter table={t} column="payee" value="Acme" />
 */
export function CellFilter<T>({
  table: instance,
  column,
  value,
  children,
}: {
  table: DataTableInstance<T>
  /** The column id. */
  column: string
  /** The value written to `f.<column>`. */
  value: string
  /** What the cell draws; the value itself by default. */
  children?: ReactNode
}): ReactElement {
  const model = modelOf(instance)
  const t = useMessages(table)
  const spec = filterableSpecs(model.specs).find((s) => s.id === column)
  const content = children ?? value
  if (spec === undefined) return <>{content}</>

  const { filters } = model.state.request
  const current = filterValues(filters, spec.id)
  const on = current.includes(value)
  const toggle = (): void => {
    const next =
      spec.filter === 'anyOf'
        ? on
          ? current.filter((v) => v !== value)
          : [...current, value]
        : on
          ? []
          : [value]
    model.state.setRequest({ filters: withFilter(filters, spec, next) })
  }

  return (
    <>
      <Pressable
        data-cell-filter=""
        aria-label={t('table.cellFilter', spec.header, value)}
        aria-pressed={on}
        className="max-w-full min-w-0 truncate rounded-chip text-start hover:underline aria-pressed:font-medium [[data-slot='table-root'][data-below='480'][data-phone='cards']_&]:@max-[479.9px]/table:hidden [[data-slot='table-root'][data-below='800'][data-phone='cards']_&]:@max-[799.9px]/table:hidden [[data-slot='table-root'][data-below='always'][data-phone='cards']_&]:hidden"
        onClick={(event) => {
          event.stopPropagation()
          toggle()
        }}
      >
        {content}
      </Pressable>
      <span
        data-slot="table-cell-plain"
        className="hidden [[data-slot='table-root'][data-below='480'][data-phone='cards']_&]:@max-[479.9px]/table:inline [[data-slot='table-root'][data-below='800'][data-phone='cards']_&]:@max-[799.9px]/table:inline [[data-slot='table-root'][data-below='always'][data-phone='cards']_&]:inline"
      >
        {content}
      </span>
    </>
  )
}
