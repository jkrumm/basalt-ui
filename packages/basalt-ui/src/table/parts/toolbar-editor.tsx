/**
 * The value editor of one filterable column (docs/v3/concepts/data-table.md section 3): the one
 * editor the `+ Filter` popover, the `Filters (n)` sheet and the header's `Filter...` all open,
 * so a filter is written the same way from every door. By operator:
 *
 * | Kind | Operator | Editor |
 * |-|-|-|
 * | `text`, `entity` | contains | a text box on the search draft (250 ms, flushed on blur) |
 * | `status`, `select` | anyOf | a checklist with each value's row count; a search box once the list scrolls |
 * | `boolean` | anyOf | Any, Yes or No |
 * | numeric kinds | range | a min and a max field, and a two-thumb slider when the column declares `bounds` |
 * | `date`, `relativeTime` | range | quick ranges and the column's day picker |
 *
 * The counts are the rows each value would show given the search and every other filter (the
 * engine's facets on a client table, `mode.facets` on a server one, none when the server sends none).
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useFormat } from '../../core/format'
import { useMessages } from '../../core/messages/use-messages'
import { commitsDraft } from '../../core/commit-key'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Checkbox, CheckboxGroup } from '../../ui/checkbox'
import { Input } from '../../ui/input'
import { ScrollArea } from '../../ui/scroll-area'
import { Segmented } from '../../ui/segmented'
import { Status } from '../../ui/status'
import { isUsable } from '../core/filters'
import type { KindSpec } from '../core/kinds-spec'
import { useSearchDraft } from '../core/state'
import type { TableModel } from '../use-data-table'
import { DateRangeEditor, NumberRangeEditor } from './range-editor'
import { filterValues, withFilter } from './toolbar-filters'
import type { FilterableSpec } from './toolbar-filters'

export type FilterEditorProps<T> = {
  model: TableModel<T>
  spec: KindSpec<T> & FilterableSpec
}

/**
 * Rows the checklist shows before it scrolls: its box is `max-h-64` (16rem) over rows of
 * `min-h-7` (1.75rem), so a ninth row scrolls, and from there a search box leads the list.
 */
const LIST_ROWS = 8

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
      placeholder={t('table.filterValue')}
      value={search.draft}
      onChange={(event) => search.change(event.currentTarget.value)}
      onBlur={search.commit}
      onKeyDown={(event) => {
        if (commitsDraft(event)) search.commit()
      }}
    />
  )
}

/** The checklist of an enum column: every option, its tone dot, its row count. */
function OptionsEditor<T>({ model, spec }: FilterEditorProps<T>): ReactElement {
  const t = useMessages(table)
  const format = useFormat()
  const [query, setQuery] = useState('')
  const { filters } = model.state.request
  const selected = filterValues(filters, spec.id)
  const options = spec.kind === 'status' ? model.rankOf(spec.id) : (spec.options ?? [])
  const counts = model.facetsOf(spec.id)
  const labelOf = (value: string): string => spec.labels?.[value] ?? value
  const needle = query.trim().toLowerCase()
  const shown =
    needle === '' ? options : options.filter((v) => labelOf(v).toLowerCase().includes(needle))
  return (
    <div data-slot="table-filter-options" className="flex min-w-0 flex-col gap-2">
      {options.length > LIST_ROWS && (
        <Input
          type="search"
          aria-label={t('table.optionSearch')}
          placeholder={t('table.optionSearch')}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      )}
      <ScrollArea className="max-h-64">
        <CheckboxGroup
          aria-label={t('table.optionsOf', spec.header)}
          className="gap-0 pointer-coarse:gap-0"
          value={[...selected]}
          onValueChange={(next: string[]) =>
            model.state.setRequest({
              filters: withFilter(
                filters,
                spec,
                options.filter((v) => next.includes(v)),
              ),
            })
          }
        >
          {shown.map((value) => {
            const count = counts?.get(value) ?? 0
            return (
              <label
                key={value}
                data-slot="table-filter-option"
                className="flex min-h-7 cursor-pointer items-center gap-2 rounded-ctrl px-1.5 hover:bg-accent pointer-coarse:min-h-11"
              >
                <Checkbox value={value} />
                {spec.tone === undefined ? (
                  <span className="min-w-0 flex-1 truncate">{labelOf(value)}</span>
                ) : (
                  <Status tone={spec.tone(value)} className="min-w-0 flex-1">
                    {labelOf(value)}
                  </Status>
                )}
                {counts !== undefined && ' '}
                {counts !== undefined && (
                  <span
                    className={
                      count === 0
                        ? 'text-xs text-muted-foreground tabular-nums opacity-60'
                        : 'text-xs text-muted-foreground tabular-nums'
                    }
                  >
                    {format.number(count)}
                  </span>
                )}
              </label>
            )
          })}
          {shown.length === 0 && (
            <span className="px-1.5 py-1 text-muted-foreground">{t('table.filterNoOptions')}</span>
          )}
        </CheckboxGroup>
      </ScrollArea>
    </div>
  )
}

/** Any, Yes or No: a boolean column's filter as one switch of three. */
function BooleanEditor<T>({ model, spec }: FilterEditorProps<T>): ReactElement {
  const t = useMessages(table)
  const { filters } = model.state.request
  const selected = filterValues(filters, spec.id)
  const value = selected.length === 1 ? (selected[0] as string) : 'any'
  return (
    <Segmented
      aria-label={t('table.optionsOf', spec.header)}
      className="w-full"
      value={value}
      onValueChange={(next) =>
        model.state.setRequest({ filters: withFilter(filters, spec, next === 'any' ? [] : [next]) })
      }
      options={[
        { value: 'any', label: t('table.boolAny') },
        { value: 'true', label: spec.labels?.['true'] ?? 'true' },
        { value: 'false', label: spec.labels?.['false'] ?? 'false' },
      ]}
    />
  )
}

/**
 * The editor of a column's filter value, by the kind's operator, with a Clear once it filters.
 * Reads and writes the same `request.filters` entry whichever surface it sits in.
 */
export function FilterEditor<T>(props: FilterEditorProps<T>): ReactElement {
  const { model, spec } = props
  const t = useMessages(table)
  const { filters } = model.state.request
  const active = filters.some((f) => f.id === spec.id && isUsable(f.op, f.values))
  const day = spec.kind === 'date' || spec.kind === 'relativeTime'
  const boolean = spec.kind === 'boolean'
  const editor =
    spec.filter === 'contains' ? (
      <ContainsEditor {...props} />
    ) : spec.filter === 'range' ? (
      day ? (
        <DateRangeEditor {...props} />
      ) : (
        <NumberRangeEditor {...props} />
      )
    ) : boolean ? (
      <BooleanEditor {...props} />
    ) : (
      <OptionsEditor {...props} />
    )
  return (
    <div data-slot="table-filter-editor" className="flex min-w-0 flex-col gap-2">
      {editor}
      {active && !boolean && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() =>
            model.state.setRequest({ filters: filters.filter((f) => f.id !== spec.id) })
          }
        >
          {t('table.filterClear')}
        </Button>
      )}
    </div>
  )
}
