/**
 * Saved views: the pure model (dirty diff, prune, same-name overwrite, the `{v,value}` envelope,
 * the codec round trip) and the `Views` menu (apply, save by name, Reset, `?view=` while clean).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { persisted } from '../../core/persisted'
import { settled } from '../../testing/settled'
import type { TableState, View } from '../contract'
import { tableCodec } from '../core/codec'
import { col } from '../core/kinds'
import { createState } from '../core/state'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { TableViews } from './views'
import { isViewDirty, pruneView, saveView, viewsKey, viewsStore } from './views-model'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
beforeEach(() => localStorage.clear())

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
    expect(raw.v).toBe(1)
    expect(raw.value[0].name).toBe('Open')
    expect(viewsKey('orders')).toBe('table-views:orders')
  })

  test('a version bump discards what an older envelope held', () => {
    localStorage.setItem(
      'basalt:table-views:orders',
      JSON.stringify({ v: 0, value: [{ id: 'x', name: 'X', state: state({}) }] }),
    )
    expect(viewsStore('orders').get()).toEqual([])
    localStorage.setItem(
      'basalt:table-views:orders',
      JSON.stringify({ v: 2, value: [{ id: 'x', name: 'X', state: state({}) }] }),
    )
    expect(viewsStore('orders').get()).toEqual([])
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

// ---- The menu -----------------------------------------------------------------------------

type Row = { id: string; payee: string; state: string }
const c = col<Row>()
let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject(): ReactElement {
  const t = useDataTable<Row>({
    id: 'v',
    label: 'Rows',
    columns: [
      c.entity('payee', { header: 'Payee', filter: 'text' }),
      c.status('state', { header: 'State', options: ['Open', 'Done'], filter: 'multi' }),
    ],
    data: [{ id: 'a', payee: 'Acme', state: 'Open' }],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return <TableViews table={t} />
}

const search = (): URLSearchParams => new URLSearchParams(window.location.search)

async function saveAs(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Views' }))
  await settled()
  fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }))
  await settled()
}

describe('Views menu', () => {
  test('saves the current state by name and lists it', async () => {
    render(<Subject />)
    act(() => model().state.setRequest({ q: 'acme' }))
    await saveAs('Acme')
    expect(
      viewsStore('v')
        .get()
        .map((v) => v.name),
    ).toEqual(['Acme'])
    expect(viewsStore('v').get()[0]?.state.request.q).toBe('acme')
  })

  test('apply writes the view and sets ?view; the first edit drops it', async () => {
    viewsStore('v').set(
      saveView([], 'Open', state({ filters: [{ id: 'state', op: 'anyOf', values: ['Open'] }] }))
        .views,
    )
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Views' }))
    await settled()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await settled()
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['Open'] }])
    expect(search().get('view')).toBe('open')
    act(() => model().state.setRequest({ q: 'x' }))
    await settled()
    expect(search().get('view')).toBeNull()
  })

  test('an unknown ?view id normalises away', async () => {
    window.history.replaceState(null, '', '/?view=missing')
    render(<Subject />)
    await settled()
    expect(search().get('view')).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Views' }))
    await settled()
    fireEvent.click(screen.getByRole('button', { name: 'Old' }))
    await settled()
    expect(model().state.request.q).toBe('q')
    expect(model().state.request.filters).toEqual([])
  })

  test('saving under an existing name overwrites it', async () => {
    render(<Subject />)
    act(() => model().state.setRequest({ q: 'one' }))
    await saveAs('Same')
    act(() => model().state.setRequest({ q: 'two' }))
    await saveAs('Same')
    const views = viewsStore('v').get()
    expect(views).toHaveLength(1)
    expect(views[0]?.state.request.q).toBe('two')
  })

  test('Reset clears search, filters and visibility', async () => {
    render(<Subject />)
    act(() => {
      model().state.setRequest({
        q: 'x',
        filters: [{ id: 'payee', op: 'contains', values: ['A'] }],
      })
      model().state.setDisplay({ visibility: { state: false } })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Views' }))
    await settled()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await settled()
    expect(model().state.request.q).toBe('')
    expect(model().state.request.filters).toEqual([])
    expect(model().state.display.visibility).toEqual({})
  })
})
