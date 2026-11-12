/**
 * The value editor of one filterable column (docs/v3/concepts/data-table.md section 3): the one
 * editor the `+ Filter` popover, the `Filters (n)` sheet and the header menu's `Filter...` all
 * open, so a filter is written the same way from every door. A `contains` kind (`text`, `entity`)
 * is a text box on the search draft (250 ms, flushed on blur); an `anyOf` kind (`status`) is a
 * `ui/combobox` over the kind's closed option list.
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Combobox, ComboboxChips, ComboboxContent, ComboboxItem } from '../../ui/combobox'
import { Input } from '../../ui/input'
import type { KindSpec } from '../core/kinds-spec'
import { useSearchDraft } from '../core/state'
import type { TableModel } from '../use-data-table'
import { filterValues, withFilter } from './toolbar-filters'
import type { FilterableSpec } from './toolbar-filters'

export type FilterEditorProps<T> = {
  model: TableModel<T>
  spec: KindSpec<T> & FilterableSpec
}

function ContainsEditor<T>({ model, spec }: FilterEditorProps<T>): ReactElement {
  const t = useMessages(table)
  const { filters } = model.state.request
  const current = filterValues(filters, spec.id)[0] ?? ''
  const search = useSearchDraft(current, (value) =>
    model.state.setRequest({ filters: withFilter(filters, spec, value === '' ? [] : [value]) }),
  )
  return (
    <Input
      type="text"
      aria-label={t('table.filterValue')}
      value={search.draft}
      onChange={(event) => search.change(event.currentTarget.value)}
      onBlur={search.commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') search.commit()
      }}
    />
  )
}

function AnyOfEditor<T>({ model, spec }: FilterEditorProps<T>): ReactElement {
  const t = useMessages(table)
  const { filters } = model.state.request
  // The popup renders inside the editor, so a click on an option is not an outside press of the
  // popover or sheet that holds the editor.
  const [container, setContainer] = useState<HTMLElement | null>(null)
  return (
    <div ref={setContainer} data-slot="table-filter-options" className="min-w-0">
      <Combobox
        multiple
        items={spec.options ?? []}
        value={[...filterValues(filters, spec.id)]}
        onValueChange={(next: string[]) =>
          model.state.setRequest({ filters: withFilter(filters, spec, next) })
        }
      >
        <ComboboxChips aria-label={t('table.filterOptions')} />
        <ComboboxContent
          empty={t('table.filterNoOptions')}
          {...(container !== null && { container })}
        >
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

/**
 * The editor of a column's filter value, by the kind's operator. Reads and writes the same
 * `request.filters` entry whichever surface it sits in.
 */
export function FilterEditor<T>(props: FilterEditorProps<T>): ReactElement {
  return props.spec.filter === 'anyOf' ? <AnyOfEditor {...props} /> : <ContainsEditor {...props} />
}
