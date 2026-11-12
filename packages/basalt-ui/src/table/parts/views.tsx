/**
 * The Views panel (docs/v3/concepts/data-table.md sections 3 and 6): apply a saved view, save the
 * current state under a name (the same name overwrites), reset search, filters and column
 * visibility. Views are personal and live on the device (`views-model.ts`).
 *
 * `?view=<id>` names the applied view only while the table state equals it: applying writes the
 * id, any edit drops it and leaves the explicit slices, so no tombstone is ever needed. The id is
 * read and written on the address bar (`replace`, never a push) unless the caller binds it to its
 * own route search through `view`.
 */
import { useEffect, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import type { DataTableInstance, TableState, View } from '../contract'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { isViewDirty, pruneView, saveView, viewsStore } from './views-model'

/** The applied view's id, and the write that changes it. */
export type ViewParam = { id: string | undefined; set(id: string | undefined): void }

const PARAM = 'view'

function readParam(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).get(PARAM) ?? undefined
}

/** `?view=` on the address bar, replaced in place so the back button is not spent on it. */
function useAddressParam(): ViewParam {
  const [id, setId] = useState<string | undefined>(readParam)
  return {
    id,
    set(next) {
      const url = new URL(window.location.href)
      if (next === undefined) url.searchParams.delete(PARAM)
      else url.searchParams.set(PARAM, next)
      window.history.replaceState(window.history.state, '', url)
      setId(next)
    },
  }
}

function warnPruned(table: string, view: string, dropped: readonly string[]): void {
  if (dropped.length === 0 || process.env.NODE_ENV === 'production') return
  // oxlint-disable-next-line no-console -- a development warning for a stale saved view
  console.warn(
    `basalt-ui/table: view "${view}" of "${table}" names columns the table no longer has (${dropped.join(', ')}); they were dropped`,
  )
}

function applyView<T>(model: TableModel<T>, view: View): void {
  const known = new Set(model.specs.map((spec) => spec.id))
  const { view: pruned, dropped } = pruneView(view, known)
  warnPruned(model.id, view.name, dropped)
  const { request, display } = pruned.state
  model.state.setRequest({
    q: request.q,
    filters: request.filters,
    sort: request.sort,
    pageSize: request.pageSize,
  })
  model.state.setDisplay({ visibility: display.visibility })
}

function ViewsPanel<T>({
  model,
  views,
  close,
  param,
}: {
  model: TableModel<T>
  views: readonly View[]
  close: () => void
  param: ViewParam
}): ReactElement {
  const t = useMessages(table)
  const [name, setName] = useState('')
  const store = viewsStore(model.id)

  const save = (event: FormEvent): void => {
    event.preventDefault()
    if (name.trim() === '') return
    const saved = saveView(views, name, model.state.state)
    store.set(saved.views)
    param.set(saved.id)
    setName('')
    close()
  }

  return (
    <div className="flex flex-col gap-3">
      {views.length === 0 ? (
        <p className="m-0 text-muted-foreground">{t('table.viewEmpty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {views.map((view) => (
            <li key={view.id} className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="min-w-0 flex-1 justify-start"
                aria-current={param.id === view.id ? 'true' : undefined}
                onClick={() => {
                  applyView(model, view)
                  param.set(view.id)
                  close()
                }}
              >
                <span className="truncate">{view.name}</span>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('table.viewRemove', view.name)}
                onClick={() => {
                  store.set(views.filter((v) => v.id !== view.id))
                  if (param.id === view.id) param.set(undefined)
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path d="m4 4 8 8M12 4l-8 8" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex items-center gap-2" onSubmit={save}>
        <Input
          type="text"
          aria-label={t('table.viewName')}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Button type="submit" variant="secondary" disabled={name.trim() === ''}>
          {t('table.viewSave')}
        </Button>
      </form>
      <Button
        variant="ghost"
        className="justify-start"
        onClick={() => {
          model.state.setRequest({ q: '', filters: [] })
          model.state.setDisplay({ visibility: {} })
          close()
        }}
      >
        {t('table.viewReset')}
      </Button>
    </div>
  )
}

/** The panel and the `?view=` bookkeeping for one model; shared by `TableViews` and the toolbar. */
export function ViewsMenu<T>({
  model,
  view,
}: {
  model: TableModel<T>
  view?: ViewParam
}): ReactElement {
  const t = useMessages(table)
  const own = useAddressParam()
  const param = view ?? own
  const [open, setOpen] = useState(false)
  const [views] = viewsStore(model.id).use()
  const state: TableState = model.state.state

  // The id only stays while the state equals the view: an unknown id or any edit drops it.
  useEffect(() => {
    if (param.id === undefined) return
    const known = new Set(model.specs.map((spec) => spec.id))
    const applied = views.find((v) => v.id === param.id)
    if (applied === undefined || isViewDirty(pruneView(applied, known).view, state)) {
      param.set(undefined)
    }
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button />}>{t('table.views')}</PopoverTrigger>
      <PopoverContent aria-label={t('table.views')} align="end">
        <ViewsPanel model={model} views={views} close={() => setOpen(false)} param={param} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The saved-views panel of a table: apply, save by name, reset. A same-name save overwrites; a
 * view that names a column the table lost is pruned on apply. `view` binds the applied id to the
 * route's own search; omitted, it is `?view=` on the address bar.
 *
 * @useWhen a bespoke toolbar offers personal saved views of the table itself
 * @neverWhen `TableToolbar` fits (it already renders the views panel)
 *
 * @example
 * <TableViews table={t} />
 */
export function TableViews<T>({
  table: instance,
  view,
}: {
  table: DataTableInstance<T>
  view?: ViewParam
}): ReactElement {
  return <ViewsMenu model={modelOf(instance)} {...(view !== undefined && { view })} />
}
