/**
 * Saved views: the pure model (dirty diff, prune, same-name overwrite, the `{v,value}` envelope,
 * the codec round trip) and the `Views` menu (apply, save by name, Reset, `?view=` while clean).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { persisted } from '../../core/persisted'
import { settled } from '../../testing/settled'
import type { TableState, View, ViewStore } from '../contract'
import { tableCodec } from '../core/codec'
import { col } from '../core/kinds'
import { createState } from '../core/state'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { sheetContentVariants } from '../../ui/sheet'
import { DataTable } from './data-table'
import { TableToolbar } from './toolbar'
import { openViewPanel } from './view-door'
import {
  duplicateView,
  isViewDirty,
  migrateViews,
  moveView,
  pruneView,
  renameView,
  saveView,
  setDefaultView,
  viewsKey,
  viewsStore,
} from './views-model'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
// The panel is a lazy chunk; load it once so the first open does not race the assertions.
beforeAll(async () => {
  await import('./view-panel')
})
beforeEach(() => {
  localStorage.clear()
  ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://localhost/',
  )
})

const state = (patch: Partial<TableState['request']>, visibility = {}): TableState => ({
  ...createState(),
  request: { ...createState().request, ...patch },
  display: { visibility },
})

describe('views model', () => {
  const view: View = {
    id: 'open',
    name: 'Open',
    state: state({ filters: [{ id: 'state', op: 'anyOf', values: ['Open'] }], pageSize: 50 }),
  }

  test('dirty diff: equal scope is clean, any slice a view carries makes it dirty, page never does', () => {
    expect(isViewDirty(view, view.state)).toBe(false)
    expect(isViewDirty(view, { ...view.state, request: { ...view.state.request, page: 4 } })).toBe(
      false,
    )
    expect(isViewDirty(view, state({ ...view.state.request, filters: [] }))).toBe(true)
    expect(isViewDirty(view, state({ ...view.state.request, q: 'x' }))).toBe(true)
    expect(
      isViewDirty(view, state({ ...view.state.request, sort: [{ id: 'a', desc: true }] })),
    ).toBe(true)
    expect(isViewDirty(view, state({ ...view.state.request, pageSize: 10 }))).toBe(true)
    expect(isViewDirty(view, { ...view.state, display: { visibility: { amount: false } } })).toBe(
      true,
    )
  })

  test('prune drops unknown columns from filters, sort and visibility and names them', () => {
    const dirty: View = {
      id: 'v',
      name: 'V',
      state: state(
        {
          filters: [
            { id: 'state', op: 'anyOf', values: ['Open'] },
            { id: 'gone', op: 'contains', values: ['x'] },
          ],
          sort: [{ id: 'removed', desc: false }],
        },
        { amount: false, old: false },
      ),
    }
    const { view: clean, dropped } = pruneView(dirty, new Set(['state', 'amount']))
    expect(clean.state.request.filters.map((f) => f.id)).toEqual(['state'])
    expect(clean.state.request.sort).toEqual([])
    expect(clean.state.display.visibility).toEqual({ amount: false })
    expect(dropped.toSorted()).toEqual(['gone', 'old', 'removed'])
  })

  test('the same name overwrites in place and keeps the id; another name appends', () => {
    const one = saveView([], 'Open', state({ q: 'a' }))
    const two = saveView(one.views, 'Open', state({ q: 'b' }))
    expect(two.views).toHaveLength(1)
    expect(two.id).toBe(one.id)
    expect(two.views[0]?.state.request.q).toBe('b')
    const three = saveView(two.views, 'Done', state({ q: 'c' }))
    expect(three.views.map((v) => v.name)).toEqual(['Open', 'Done'])
    expect(new Set(three.views.map((v) => v.id)).size).toBe(2)
  })

  test('a saved view never keeps the page', () => {
    const { views } = saveView([], 'P', state({ page: 7 }))
    expect(views[0]?.state.request.page).toBe(1)
  })

  test('the store is basalt:table-views:<id> in a {v,value} envelope', () => {
    const store = viewsStore('orders')
    store.set(saveView([], 'Open', state({ q: 'a' })).views)
    const raw = JSON.parse(localStorage.getItem('basalt:table-views:orders') ?? 'null')
    expect(Object.keys(raw).toSorted()).toEqual(['v', 'value'])
    expect(raw.v).toBe(2)
    expect(raw.value[0].name).toBe('Open')
    expect(viewsKey('orders')).toBe('table-views:orders')
  })

  test('a version 1 list migrates as it is; any other version is discarded', () => {
    const v1 = [{ id: 'x', name: 'X', state: state({ q: 'x' }) }]
    localStorage.setItem('basalt:table-views:orders', JSON.stringify({ v: 1, value: v1 }))
    expect(viewsStore('orders').get()).toEqual(v1)
    localStorage.setItem('basalt:table-views:orders', JSON.stringify({ v: 0, value: v1 }))
    expect(viewsStore('orders').get()).toEqual([])
    localStorage.setItem('basalt:table-views:orders', JSON.stringify({ v: 3, value: v1 }))
    expect(viewsStore('orders').get()).toEqual([])
    expect(migrateViews([{ id: 'y' }, ...v1], 1)).toEqual(v1)
  })

  test('the list transforms: rename refuses a taken name, duplicate sits after its source, one default', () => {
    const one = saveView([], 'Open', state({ q: 'a' })).views
    const two = saveView(one, 'Done', state({ q: 'b' })).views
    expect(renameView(two, 'open', 'Done')).toBeUndefined()
    expect(renameView(two, 'open', ' ')).toBeUndefined()
    expect(renameView(two, 'open', 'Mine')?.map((v) => v.name)).toEqual(['Mine', 'Done'])
    const copied = duplicateView(two, 'open', 'Open copy')
    expect(copied?.views.map((v) => v.name)).toEqual(['Open', 'Open copy', 'Done'])
    expect(moveView(two, 'open', 1).map((v) => v.id)).toEqual(['done', 'open'])
    const marked = setDefaultView(setDefaultView(two, 'open'), 'done')
    expect(marked.filter((v) => v.default === true).map((v) => v.id)).toEqual(['done'])
    expect(saveView([], 'All', state({})).id).toBe('all-2')
  })

  test('a view round-trips through the T1 codec: a comma value and a numeric-looking string', () => {
    const schema = col<{ id: string }>().codec(
      { payee: 'text', state: 'status' },
      { defaults: { pageSize: 25 } },
    )
    const codec = tableCodec(schema)
    const saved = saveView(
      [],
      'Tricky',
      state({
        q: '007',
        filters: [
          { id: 'payee', op: 'contains', values: ['Smith, John'] },
          { id: 'state', op: 'anyOf', values: ['123', 'a\\b'] },
        ],
      }),
    ).views[0] as View
    const stored = JSON.parse(JSON.stringify(saved)) as View
    const decoded = codec.decode('', codec.encode('', stored.state)) as TableState
    expect(decoded.request.q).toBe('007')
    expect(decoded.request.filters).toEqual(stored.state.request.filters)
    expect(typeof decoded.request.filters[1]?.values[0]).toBe('string')
    expect(isViewDirty(stored, decoded)).toBe(false)
    // and the store itself keeps them verbatim
    const store = persisted<View[]>('table-views:rt', { version: 1, initial: [] })
    store.set([stored])
    expect(store.get()[0]?.state.request.filters).toEqual(stored.state.request.filters)
  })
})

// ---- The strip and the panel ------------------------------------------------------------

type Row = { id: string; payee: string; state: string; amount: number }
const c = col<Row>()
let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject({ store, onExport }: { store?: ViewStore; onExport?: () => void }): ReactElement {
  const t = useDataTable<Row>({
    id: 'v',
    label: 'Rows',
    columns: [
      c.entity('payee', { header: 'Payee', filter: 'text' }),
      c.status('state', { header: 'State', options: ['Open', 'Done'], filter: 'multi' }),
      c.number('amount', { header: 'Amount' }),
    ],
    data: [
      { id: 'a', payee: 'Acme', state: 'Open', amount: 3 },
      { id: 'b', payee: 'Bolt', state: 'Done', amount: 5 },
    ],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(store !== undefined && { views: { store } }),
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return (
    <>
      <TableToolbar table={t} {...(onExport !== undefined && { onExport })} />
      <DataTable table={t} />
    </>
  )
}

const search = (): URLSearchParams => new URLSearchParams(window.location.search)
const OPEN = { id: 'state', op: 'anyOf', values: ['Open'] } as const
const tabs = (): string[] =>
  within(screen.getByRole('tablist', { name: 'Views' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent ?? '')
const tab = (name: string | RegExp): HTMLElement => screen.getByRole('tab', { name })
const panel = (): HTMLElement =>
  screen.getByRole('complementary', {
    name: /^Edit view|^Name|^Row height|^Column width|^Columns|^Filter|^Sort|^Group|^Sharing|^Delete view/,
  })

async function click(el: HTMLElement): Promise<void> {
  fireEvent.click(el)
  await settled()
}

/** Opens the active tab's menu and picks an item. */
async function menu(active: string, item: string): Promise<void> {
  await click(tab(new RegExp(`^${active}`)))
  await click(screen.getByRole('menuitem', { name: item }))
}

/** + View, then names the new view in the panel's name page. */
async function addView(name: string): Promise<void> {
  await click(screen.getByRole('button', { name: 'Add view' }))
  const box = within(panel()).getByRole('textbox', { name: 'Name' })
  fireEvent.change(box, { target: { value: name } })
  await click(within(panel()).getByRole('button', { name: 'Rename' }))
}

describe('views as tabs', () => {
  test('+ View saves what is shown as a tab, applies it and survives a remount', async () => {
    const { unmount } = render(<Subject />)
    act(() => model().state.setRequest({ filters: [OPEN] }))
    await addView('Open ones')
    expect(tabs()).toEqual(['All rows', 'Open ones'])
    expect(tab(/^Open ones/).getAttribute('aria-selected')).toBe('true')
    expect(search().get('view')).toBe('new-view')
    expect(viewsStore('v').get()[0]?.state.request.filters).toEqual([OPEN])
    unmount()
    render(<Subject />)
    await settled()
    expect(tabs()).toEqual(['All rows', 'Open ones'])
  })

  test('a tab applies its view; All rows returns to the declared table', async () => {
    viewsStore('v').set(saveView([], 'Open', state({ filters: [OPEN] })).views)
    render(<Subject />)
    await click(tab(/^Open/))
    expect(model().state.request.filters).toEqual([OPEN])
    expect(search().get('view')).toBe('open')
    await click(tab('All rows'))
    expect(model().state.request.filters).toEqual([])
    expect(search().get('view')).toBeNull()
  })

  test('rename, duplicate, reorder and delete from the tab menu, each kept on the device', async () => {
    viewsStore('v').set(
      saveView(saveView([], 'Open', state({ filters: [OPEN] })).views, 'Done', state({})).views,
    )
    const { unmount } = render(<Subject />)
    await click(tab(/^Open/))
    await menu('Open', 'Rename')
    fireEvent.change(within(panel()).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Mine' },
    })
    await click(within(panel()).getByRole('button', { name: 'Rename' }))
    expect(tabs()).toEqual(['All rows', 'Mine', 'Done'])
    await menu('Mine', 'Duplicate')
    expect(tabs()).toEqual(['All rows', 'Mine', 'Mine copy', 'Done'])
    expect(search().get('view')).toBe('mine-copy')
    await menu('Mine copy', 'Move right')
    expect(tabs()).toEqual(['All rows', 'Mine', 'Done', 'Mine copy'])
    await menu('Mine copy', 'Move left')
    expect(tabs()).toEqual(['All rows', 'Mine', 'Mine copy', 'Done'])
    await menu('Mine copy', 'Delete')
    await click(within(panel()).getByRole('button', { name: 'Delete view' }))
    expect(tabs()).toEqual(['All rows', 'Mine', 'Done'])
    expect(search().get('view')).toBeNull()
    unmount()
    window.history.replaceState(null, '', '/')
    render(<Subject />)
    await settled()
    expect(tabs()).toEqual(['All rows', 'Mine', 'Done'])
  })

  test('a default view opens a bare address; All rows is then ?view=all and stays put', async () => {
    viewsStore('v').set(saveView([], 'Open', state({ filters: [OPEN] })).views)
    const first = render(<Subject />)
    await click(tab(/^Open/))
    await menu('Open', 'Set as default')
    expect(viewsStore('v').get()[0]?.default).toBe(true)
    first.unmount()
    window.history.replaceState(null, '', '/')
    const second = render(<Subject />)
    await settled()
    expect(search().get('view')).toBe('open')
    expect(model().state.request.filters).toEqual([OPEN])
    await click(tab('All rows'))
    expect(search().get('view')).toBe('all')
    second.unmount()
    render(<Subject />)
    await settled()
    expect(tab('All rows').getAttribute('aria-selected')).toBe('true')
  })

  test('an edit keeps ?view and reads modified; Discard restores the view, Save stores the edit', async () => {
    viewsStore('v').set(saveView([], 'Open', state({ filters: [OPEN] })).views)
    render(<Subject />)
    await click(tab(/^Open/))
    act(() => model().state.setRequest({ q: 'acme' }))
    await settled()
    expect(search().get('view')).toBe('open')
    expect(tab(/^Open/).textContent).toContain('modified')
    await click(screen.getAllByRole('button', { name: 'Discard' })[0]!)
    expect(model().state.request.q).toBe('')
    expect(tab(/^Open/).textContent).not.toContain('modified')
    act(() => model().state.setRequest({ q: 'acme' }))
    await settled()
    await click(screen.getAllByRole('button', { name: 'Save' })[0]!)
    expect(viewsStore('v').get()[0]?.state.request.q).toBe('acme')
    expect(tab(/^Open/).textContent).not.toContain('modified')
  })

  test('a view keeps its category rank, and a view without one drops the rank the table has', async () => {
    viewsStore('v').set(
      saveView(
        saveView([], 'Ranked', {
          ...state({ sort: [{ id: 'state', desc: false }] }),
          request: {
            ...state({}).request,
            ranks: { state: ['Done', 'Open'] },
            sort: [{ id: 'state', desc: false }],
          },
        }).views,
        'Plain',
        state({ q: 'p' }),
      ).views,
    )
    render(<Subject />)
    await click(tab(/^Ranked/))
    expect(model().state.request.ranks).toEqual({ state: ['Done', 'Open'] })
    await click(tab(/^Plain/))
    expect(model().state.request.ranks).toEqual({})
  })

  test('an unknown ?view id normalises away; a known one applies over a pristine address', async () => {
    window.history.replaceState(null, '', '/?view=missing')
    const first = render(<Subject />)
    await settled()
    expect(search().get('view')).toBeNull()
    first.unmount()
    viewsStore('v').set(saveView([], 'Open', state({ filters: [OPEN] })).views)
    window.history.replaceState(null, '', '/?view=open')
    render(<Subject />)
    await settled()
    expect(model().state.request.filters).toEqual([OPEN])
  })

  test('applying a view prunes columns the table no longer has', async () => {
    viewsStore('v').set([
      {
        id: 'old',
        name: 'Old',
        state: state({ filters: [{ id: 'gone', op: 'contains', values: ['x'] }], q: 'q' }),
      },
    ])
    render(<Subject />)
    await click(tab(/^Old/))
    expect(model().state.request.filters).toEqual([])
    expect(model().state.request.q).toBe('q')
  })
})

describe('the manage-view panel', () => {
  test('every property changes the table at once and is saved with the view', async () => {
    viewsStore('v').set(saveView([], 'Open', state({})).views)
    render(<Subject />)
    await click(tab(/^Open/))
    await click(screen.getByRole('button', { name: 'Edit view' }))
    const go = async (row: string): Promise<void> => {
      await click(within(panel()).getByRole('button', { name: new RegExp(`^${row}`) }))
    }
    const back = async (): Promise<void> =>
      click(within(panel()).getByRole('button', { name: 'Back' }))

    await go('Row height')
    await click(within(panel()).getByRole('radio', { name: /Comfortable/ }))
    expect(model().rowHeight).toBe('comfortable')
    await back()
    await go('Column width')
    await click(within(panel()).getByRole('radio', { name: /Wide/ }))
    expect(Object.keys(model().state.display.widths ?? {}).length).toBeGreaterThan(0)
    await back()
    await go('Columns')
    await click(within(panel()).getByRole('checkbox', { name: 'Amount' }))
    expect(model().state.display.visibility['amount']).toBe(false)
    await back()
    await go('Sort')
    await click(within(panel()).getByRole('radio', { name: 'Amount' }))
    await click(within(panel()).getByRole('radio', { name: 'Descending' }))
    expect(model().state.request.sort).toEqual([{ id: 'amount', desc: true }])
    await back()
    await go('Group')
    await click(within(panel()).getByRole('radio', { name: 'State' }))
    expect(model().groupBy).toBe('state')
    await back()
    await go('Filter')
    await go('State')
    await click(
      within(panel())
        .getByRole('checkbox', { name: /^Open\b/ })
        .closest('label') as HTMLElement,
    )
    expect(model().state.request.filters).toEqual([OPEN])
    await back()
    await back()

    expect(within(panel()).getByText('Unsaved changes')).toBeTruthy()
    await click(within(panel()).getByRole('button', { name: 'Save' }))
    const saved = viewsStore('v').get()[0]?.state
    expect(saved?.display.rowHeight).toBe('comfortable')
    expect(saved?.display.visibility['amount']).toBe(false)
    expect(saved?.display.groupBy).toBe('state')
    expect(Object.keys(saved?.display.widths ?? {}).length).toBeGreaterThan(0)
    expect(saved?.request.sort).toEqual([{ id: 'amount', desc: true }])
    expect(saved?.request.filters).toEqual([OPEN])
    expect(within(panel()).queryByText('Unsaved changes')).toBeNull()
  })

  test('the header menu Filter... opens the panel on that column', async () => {
    render(<Subject />)
    await click(screen.getByRole('button', { name: 'State column actions' }))
    await click(screen.getByRole('menuitem', { name: 'Filter...' }))
    expect(panel().getAttribute('aria-label')).toBe('Filter: State')
    expect(within(panel()).getByRole('checkbox', { name: /^Open\b/ })).toBeTruthy()
  })

  test('on a phone the panel is a bottom sheet', async () => {
    const real = window.matchMedia
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
    try {
      render(<Subject />)
      await click(screen.getByRole('button', { name: 'Edit view' }))
      const sheet = screen.getByRole('dialog', { name: 'Edit view' })
      expect(sheet.getAttribute('data-slot')).toBe('sheet-content')
      expect(sheet.className).toBe(sheetContentVariants({ placement: 'bottom' }))
      expect(screen.queryByRole('complementary', { name: 'Edit view' })).toBeNull()
    } finally {
      window.matchMedia = real
    }
  })

  test('without a mounted panel the door reports false', () => {
    expect(openViewPanel('nobody', 'filter')).toBe(false)
  })

  test('Export shows only when the app passes an exporter', async () => {
    viewsStore('v').set(saveView([], 'Open', state({})).views)
    const first = render(<Subject />)
    await click(tab(/^Open/))
    await click(screen.getByRole('button', { name: 'Edit view' }))
    expect(within(panel()).queryByRole('button', { name: 'Export table' })).toBeNull()
    first.unmount()
    let exported = 0
    render(<Subject onExport={() => (exported += 1)} />)
    await click(screen.getByRole('button', { name: 'Edit view' }))
    await click(within(panel()).getByRole('button', { name: 'Export table' }))
    expect(exported).toBe(1)
  })
})

/** An in-memory store that records each call. */
function memoryStore(
  initial: View[],
  capabilities: Partial<Pick<ViewStore, 'share' | 'reorder' | 'count'>> = {},
  refuse = false,
): ViewStore & { calls: string[]; views: View[] } {
  const self = {
    views: [...initial],
    calls: [] as string[],
    list: () => Promise.resolve([...self.views]),
    save: (_t: string, v: View) => {
      self.calls.push(`save:${v.id}`)
      if (refuse) return Promise.reject(new Error('no'))
      self.views = self.views.some((x) => x.id === v.id)
        ? self.views.map((x) => (x.id === v.id ? v : x))
        : [...self.views, v]
      return Promise.resolve()
    },
    remove: (_t: string, id: string) => {
      self.calls.push(`remove:${id}`)
      self.views = self.views.filter((x) => x.id !== id)
      return Promise.resolve()
    },
    ...capabilities,
  }
  return self
}

describe("a caller's ViewStore", () => {
  test('lists, saves and removes through the store, never the device; no Move without reorder', async () => {
    const store = memoryStore(saveView([], 'Open', state({ filters: [OPEN] })).views)
    render(<Subject store={store} />)
    await settled()
    await click(tab(/^Open/))
    await click(tab(/^Open/))
    expect(screen.queryByRole('menuitem', { name: 'Move right' })).toBeNull()
    await click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(store.calls).toEqual(['save:open-copy'])
    await menu('Open copy', 'Delete')
    await click(within(panel()).getByRole('button', { name: 'Delete view' }))
    expect(store.calls).toEqual(['save:open-copy', 'remove:open-copy'])
    expect(localStorage.getItem('basalt:table-views:v')).toBeNull()
  })

  test('a store that reorders gets the whole order', async () => {
    const order: string[][] = []
    const store = memoryStore(
      saveView(saveView([], 'First', state({})).views, 'Second', state({})).views,
      {
        reorder: (_t, ids) => {
          order.push([...ids])
          return Promise.resolve()
        },
      },
    )
    render(<Subject store={store} />)
    await settled()
    await click(tab(/^First/))
    await menu('First', 'Move right')
    expect(order).toEqual([['second', 'first']])
    expect(tabs()).toEqual(['All rows', 'Second', 'First'])
  })

  test('the sharing row needs a store that shares, and then lists private and shared', async () => {
    const plain = memoryStore(saveView([], 'Open', state({})).views)
    const first = render(<Subject store={plain} />)
    await settled()
    await click(tab(/^Open/))
    await click(screen.getByRole('button', { name: 'Edit view' }))
    expect(within(panel()).queryByRole('button', { name: /^Sharing/ })).toBeNull()
    first.unmount()
    const sharing = memoryStore(saveView([], 'Open', state({})).views, { share: true })
    render(<Subject store={sharing} />)
    await settled()
    await click(screen.getByRole('button', { name: 'Edit view' }))
    await click(within(panel()).getByRole('button', { name: /^Sharing/ }))
    expect(within(panel()).getByRole('radio', { name: /Private/ })).toBeTruthy()
    await click(within(panel()).getByRole('radio', { name: /Shared/ }))
    expect(sharing.views[0]?.sharing).toBe('shared')
  })

  test('a tab shows the count the store gives', async () => {
    const store = memoryStore(saveView([], 'Open', state({})).views, {
      count: () => Promise.resolve(17),
    })
    render(<Subject store={store} />)
    await settled()
    await settled()
    expect(tab(/^Open/).textContent).toContain('17')
  })

  test('a refused write keeps the list as it was and says so', async () => {
    const store = memoryStore(saveView([], 'Open', state({})).views, {}, true)
    render(<Subject store={store} />)
    await settled()
    await click(tab(/^Open/))
    await menu('Open', 'Duplicate')
    expect(tabs()).toEqual(['All rows', 'Open'])
    expect(screen.getByRole('alert').textContent).toBe('The views could not be updated')
  })
})
