/**
 * `TableToolbar` (docs/v3/concepts/data-table.md section 3): quick search, the `+ Filter` popover,
 * the chips, the Display popover and the Views panel, all writing the table's one state. Below
 * 480 px of the TOOLBAR'S OWN container (not the viewport) the `+ Filter` door and the chips'
 * editors fold into one `Filters (n)` sheet; the swap is CSS on the container, so the server HTML
 * is already right and no observer runs before hydration.
 *
 * Law: the toolbar holds no filter state. Every control reads `model.state` and writes it back
 * through `setRequest` / `setDisplay`, so the chips, the header menu and a cell filter stay in
 * step with it. A write that changes the scope returns to page 1 (`core/state`).
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Input } from '../../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '../../ui/sheet'
import type { DataTableInstance } from '../contract'
import { useSearchDraft } from '../core/state'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { ChipList } from './chips'
import { FilterEditor } from './toolbar-editor'
import { activeFilters, filterableSpecs } from './toolbar-filters'
import { ViewsMenu } from './views'
import type { ViewParam } from './views'

function Search<T>({ model }: { model: TableModel<T> }): ReactElement {
  const t = useMessages(table)
  const search = useSearchDraft(model.state.request.q, (q) => model.state.setRequest({ q }))
  // An IME composition is not a phrase yet: the box shows it, nothing is written until it ends.
  const [composed, setComposed] = useState<string | null>(null)
  return (
    <Input
      type="search"
      aria-label={t('table.search')}
      className="min-w-32 flex-1"
      value={composed ?? search.draft}
      onChange={(event) => {
        const value = event.currentTarget.value
        if (composed === null) search.change(value)
        else setComposed(value)
      }}
      onCompositionStart={() => setComposed(search.draft)}
      onCompositionEnd={(event) => {
        setComposed(null)
        search.change(event.currentTarget.value)
      }}
      onBlur={search.commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') search.commit()
      }}
    />
  )
}

/** `+ Filter`: pick a filterable column, then edit its value in that kind's editor. */
function AddFilter<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const t = useMessages(table)
  const specs = filterableSpecs(model.specs)
  const [picked, setPicked] = useState<string | null>(null)
  const spec = specs.find((s) => s.id === picked)
  if (specs.length === 0) return null
  return (
    <Popover onOpenChange={(open) => open && setPicked(null)}>
      <PopoverTrigger render={<Button />}>{t('table.filterAdd')}</PopoverTrigger>
      <PopoverContent aria-label={t('table.filterColumn')} align="start">
        {spec === undefined ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {specs.map((s) => (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setPicked(s.id)}
                >
                  {s.header}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="justify-start" onClick={() => setPicked(null)}>
              {t('table.filterBack')}
            </Button>
            <span className="font-medium">{spec.header}</span>
            <FilterEditor model={model} spec={spec} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** `Display`: which columns the table shows, written to the device lane `display.visibility`. */
function Display<T>({ model }: { model: TableModel<T> }): ReactElement {
  const t = useMessages(table)
  const { visibility } = model.state.display
  return (
    <Popover>
      <PopoverTrigger render={<Button />}>{t('table.display')}</PopoverTrigger>
      <PopoverContent aria-label={t('table.display')} align="end">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {model.specs
            .filter((spec) => spec.kind !== 'actions')
            .map((spec) => (
              <li key={spec.id} className="flex items-center gap-2">
                <Checkbox
                  aria-label={spec.header}
                  checked={visibility[spec.id] !== false}
                  onCheckedChange={(next) =>
                    model.state.setDisplay({ visibility: { ...visibility, [spec.id]: next } })
                  }
                />
                <span className="min-w-0 truncate">{spec.header}</span>
              </li>
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** `Filters (n)`: every filter editor in one sheet, for a toolbar too narrow to fan them out. */
function FiltersSheet<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const t = useMessages(table)
  const specs = filterableSpecs(model.specs)
  const count = activeFilters(model.state.request.filters, new Set(specs.map((s) => s.id))).length
  if (specs.length === 0) return null
  return (
    <span data-slot="table-filters-sheet" className="hidden @max-[479.9px]/toolbar:inline-flex">
      <Sheet>
        <SheetTrigger render={<Button />}>{t('table.filters', count)}</SheetTrigger>
        <SheetContent title={t('table.filtersTitle')}>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            {specs.map((spec) => (
              <div key={spec.id} className="flex flex-col gap-1.5">
                <span className="font-medium">{spec.header}</span>
                <FilterEditor model={model} spec={spec} />
              </div>
            ))}
            {count > 0 && (
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => model.state.setRequest({ filters: [] })}
              >
                {t('table.filtersClear')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </span>
  )
}

/**
 * The toolbar of a table: search, filters, chips, display and saved views.
 *
 * @useWhen a data table needs search, filters or saved views above it
 * @neverWhen the table is small and fixed (omit the toolbar), or the page owns the filters in a `FilterSet`
 *
 * @example
 * <TableToolbar table={t} />
 * <DataTable table={t} />
 */
export function TableToolbar<T>({
  table: instance,
  view,
}: {
  table: DataTableInstance<T>
  /** Binds the applied view's id to the route's own search; the address bar's `?view=` when omitted. */
  view?: ViewParam
}): ReactElement {
  const model = modelOf(instance)
  return (
    <search
      data-slot="table-toolbar"
      aria-label={model.label}
      className="@container/toolbar flex min-w-0 flex-col gap-2 pb-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Search model={model} />
        <span data-slot="table-filter-add" className="inline-flex @max-[479.9px]/toolbar:hidden">
          <AddFilter model={model} />
        </span>
        <FiltersSheet model={model} />
        <Display model={model} />
        <ViewsMenu model={model} {...(view !== undefined && { view })} />
      </div>
      <ChipList model={model} />
    </search>
  )
}
