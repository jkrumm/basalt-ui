/**
 * The layouts of a table view (docs/v3/issues/bench/bench-view-layouts.json): one model drawn as a
 * table, a list, a board or a gallery; the layout saves with the view; filters, selection and the
 * bulk bar carry across; a board drop commits the select column with rollback on failure.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import type { DragData, DragEdge, DragLike } from '../../core/ports'
import type { BuiltinLayout, BulkAction, TableLayoutSpec, TableState, View } from '../contract'
import { col } from '../core/kinds'
import { DataTable } from '../parts/data-table'
import { isViewDirty, storedState, viewDisplay } from '../parts/views-model'
import { modelOf, useDataTable } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { boardLanes, cardFace, laneTotal, totalColumn } from './model'

type Deal = { id: string; name: string; owner: string; stage: string; amount: number }

const DEALS: Deal[] = [
  { id: 'a', name: 'Acme', owner: 'Ada', stage: 'new', amount: 100 },
  { id: 'b', name: 'Bolt', owner: 'Bo', stage: 'won', amount: 250 },
  { id: 'c', name: 'Cove', owner: 'Ada', stage: 'new', amount: 50 },
]
const STAGES = ['new', 'won', 'lost']

/** The model the last render built, read by the tests after it commits. */
const seen: { model?: TableModel<Deal> | undefined } = {}

beforeEach(() => {
  localStorage.clear()
  seen.model = undefined
})
afterEach(cleanup)

const itemOf = (id: string): HTMLElement =>
  document
    .querySelector<HTMLElement>(`[data-card-id="${id}"]`)!
    .closest<HTMLElement>('[data-slot="board-item"]')!

/** A `DragLike` the test drives by hand, as the board's own test does. */
function fakeDrag() {
  type Item = Parameters<DragLike['item']>[0]
  type Target = Parameters<DragLike['target']>[0]
  type Watch = Parameters<DragLike['watch']>[0]
  const items = new Map<HTMLElement, Item>()
  const targets = new Map<HTMLElement, Target>()
  const watchers = new Set<Watch>()
  const engine: DragLike = {
    item: (o) => (items.set(o.element, o), () => void items.delete(o.element)),
    target: (o) => (targets.set(o.element, o), () => void targets.delete(o.element)),
    watch: (o) => (watchers.add(o), () => void watchers.delete(o)),
  }
  return {
    engine,
    move(id: string, column: string): void {
      const source = items.get(itemOf(id))!.data as DragData
      const el = document.querySelector<HTMLElement>(
        `[data-slot="board-column"][data-column="${column}"]`,
      )!
      const target = targets.get(el)?.data ?? null
      act(() => {
        for (const w of watchers) w.onStart?.(source)
        for (const w of watchers) w.onDrop({ source, target, edge: null as DragEdge | null })
      })
    },
  }
}

function Subject({
  layouts = ['table', 'list', 'board', 'gallery'],
  layout,
  commit = () => undefined,
  bulk = [],
  drag,
  data = DEALS,
}: {
  /** `null` passes no `layouts`: the default. */
  layouts?: readonly (BuiltinLayout | TableLayoutSpec<Deal>)[] | null
  layout?: string
  commit?: (row: Deal, value: string) => unknown
  bulk?: BulkAction<Deal>[]
  drag?: DragLike
  data?: readonly Deal[]
}): ReactElement {
  const c = col<Deal>()
  const t = useDataTable<Deal>({
    id: 'deals',
    label: 'Deals',
    columns: [
      c.entity('name', { header: 'Deal', sub: (d) => d.owner }),
      c.select('stage', {
        header: 'Stage',
        label: (d) => `Stage of ${d.name}`,
        options: STAGES,
        commit,
      }),
      c.money('amount', { currency: 'EUR', footer: 'sum' }),
    ],
    data,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    ...(layouts !== null && { layouts }),
    selection: { bulk },
  })
  const built = modelOf(t)
  useEffect(() => {
    seen.model = built
    if (
      layout !== undefined &&
      built.layout !== layout &&
      built.layouts.some((entry) => entry.id === layout)
    )
      built.setLayout(layout)
  })
  return <DataTable table={t} {...(drag !== undefined && { drag })} />
}

const state = (display: TableState['display']): TableState => ({
  v: 1,
  request: { q: '', filters: [], sort: [], page: 1, pageSize: 25 },
  display,
})

describe('a view carries its layout', () => {
  test('storedState keeps a layout and drops the default table', () => {
    expect(storedState(state({ visibility: {}, layout: 'board' })).display.layout).toBe('board')
    expect('layout' in storedState(state({ visibility: {}, layout: 'table' })).display).toBe(false)
  })

  test('a layout change reads modified, and a view applies its layout or returns to the table', () => {
    const view: View = { id: 'v', name: 'V', state: state({ visibility: {}, layout: 'gallery' }) }
    expect(isViewDirty(view, state({ visibility: {}, layout: 'gallery' }))).toBe(false)
    expect(isViewDirty(view, state({ visibility: {}, layout: 'list' }))).toBe(true)
    expect(viewDisplay({ visibility: {}, layout: 'list' }, view.state.display).layout).toBe(
      'gallery',
    )
    expect(
      viewDisplay({ visibility: {}, layout: 'list' }, { visibility: {} }).layout,
    ).toBeUndefined()
  })
})

describe('the layouts a table offers', () => {
  test('one layout by default, so no toggle and the table draws', () => {
    render(<Subject layouts={null} />)
    expect(seen.model?.layouts.map((entry) => entry.id)).toEqual(['table'])
    expect(screen.getByRole('table')).toBeTruthy()
  })

  test('a board needs a select column: without one it is left out', () => {
    function NoAxis(): ReactElement {
      const c = col<Deal>()
      const t = useDataTable<Deal>({
        id: 'plain',
        label: 'Plain',
        columns: [c.entity('name')],
        data: DEALS,
        getRowId: (d) => d.id,
        mode: { kind: 'client' },
        layouts: ['table', 'board'],
      })
      const built = modelOf(t)
      useEffect(() => {
        seen.model = built
      })
      return <DataTable table={t} />
    }
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<NoAxis />)
    warn.mockRestore()
    expect(seen.model?.layouts.map((entry) => entry.id)).toEqual(['table'])
  })
})

describe('the card face', () => {
  test('reads the plan: the title, the subtitle and the value as their cells show them', () => {
    render(<Subject />)
    const face = cardFace(seen.model!, DEALS[0]!)
    expect(face.title).toBe('Acme')
    expect(face.subtitle?.text).toBe('Ada')
    expect(face.value?.text).toContain('100')
    expect(face.meta.map((m) => m.text)).toContain('new')
  })

  test('a board column holds its option rows, a pending move in its new place, and its total', () => {
    render(<Subject />)
    const lanes = boardLanes(seen.model!, 'stage', new Map([['a', { to: 'won', index: 0 }]]))
    expect(lanes.map((lane) => lane.rows.map((r) => r.id))).toEqual([['c'], ['a', 'b'], []])
    const total = laneTotal(seen.model!, totalColumn(seen.model!), lanes[1]!.rows)
    expect(total).toContain('350')
  })
})

describe('switching layouts', () => {
  test('the list keeps the table markup with the list tier', () => {
    render(<Subject layout="list" />)
    const root = document.querySelector('[data-slot="table-root"]')!
    expect(root.getAttribute('data-layout')).toBe('list')
    expect(root.getAttribute('data-phone')).toBe('cards')
    expect(document.querySelector('td[data-place="value"]')).not.toBeNull()
  })

  test('the gallery draws a card per row; a tick there drives the bulk bar', async () => {
    const onClick = mock((_rows: readonly Deal[]) => undefined)
    render(<Subject layout="gallery" bulk={[{ id: 'x', label: 'Archive', onClick }]} />)
    const tick = await screen.findByRole('checkbox', { name: 'Select Bolt' })
    expect(document.querySelectorAll('[data-slot="table-gallery-card"]').length).toBe(3)
    fireEvent.click(tick)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onClick.mock.calls[0]?.[0]).toEqual([DEALS[1]!])
  })

  test('a search narrows every layout alike', async () => {
    render(<Subject layout="gallery" />)
    await screen.findByRole('checkbox', { name: 'Select Bolt' })
    act(() => seen.model!.state.setRequest({ q: 'Ada' }))
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="table-gallery-card"]').length).toBe(2),
    )
  })

  test('the selection made in one layout holds in the next', async () => {
    const { rerender } = render(<Subject layout="gallery" />)
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Cove' }))
    act(() => seen.model!.setLayout('table'))
    rerender(<Subject />)
    expect(seen.model!.selection?.isSelected('c')).toBe(true)
    expect(document.querySelector('[data-slot="table-bulk"]')).not.toBeNull()
  })
})

describe('the board', () => {
  test('a drop between columns commits the option and the card moves at once', async () => {
    const drag = fakeDrag()
    const commit = mock((_row: Deal, _value: string) => new Promise<void>(() => undefined))
    render(<Subject layout="board" commit={commit} drag={drag.engine} />)
    await waitFor(() => expect(document.querySelector('[data-slot="board"]')).not.toBeNull())
    drag.move('a', 'lost')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit.mock.calls[0]?.[0]).toEqual(DEALS[0]!)
    expect(commit.mock.calls[0]?.[1]).toBe('lost')
    const lost = document.querySelector<HTMLElement>(
      '[data-slot="board-column"][data-column="lost"]',
    )!
    expect(within(lost).queryByText('Acme')).not.toBeNull()
  })

  test('a commit that rejects puts the card back and says so', async () => {
    const drag = fakeDrag()
    const commit = mock(() => Promise.reject(new Error('no')))
    render(<Subject layout="board" commit={commit} drag={drag.engine} />)
    await waitFor(() => expect(document.querySelector('[data-slot="board"]')).not.toBeNull())
    drag.move('b', 'lost')
    await waitFor(() =>
      expect(screen.getByText('Bolt could not move. It is back where it was.')).toBeTruthy(),
    )
    const won = document.querySelector<HTMLElement>(
      '[data-slot="board-column"][data-column="won"]',
    )!
    expect(within(won).queryByText('Bolt')).not.toBeNull()
  })

  test('a drop inside its own column commits nothing: the sort owns the order', async () => {
    const drag = fakeDrag()
    const commit = mock(() => undefined)
    render(<Subject layout="board" commit={commit} drag={drag.engine} />)
    await waitFor(() => expect(document.querySelector('[data-slot="board"]')).not.toBeNull())
    drag.move('a', 'new')
    expect(commit).not.toHaveBeenCalled()
  })
  test('an older move settling never undoes a newer move of the same card', async () => {
    const drag = fakeDrag()
    const pending: { resolve: () => void; reject: (e: Error) => void }[] = []
    const commit = mock(
      () => new Promise<void>((resolve, reject) => void pending.push({ resolve, reject })),
    )
    render(<Subject layout="board" commit={commit} drag={drag.engine} />)
    await waitFor(() => expect(document.querySelector('[data-slot="board"]')).not.toBeNull())
    drag.move('a', 'won')
    drag.move('a', 'lost')
    await act(async () => pending[0]!.reject(new Error('late')))
    const lost = document.querySelector<HTMLElement>(
      '[data-slot="board-column"][data-column="lost"]',
    )!
    expect(within(lost).queryByText('Acme')).not.toBeNull()
    expect(screen.queryByText('Acme could not move. It is back where it was.')).toBeNull()
  })

  test('a committed move ends when the data replaces the row without taking it', async () => {
    const drag = fakeDrag()
    const { rerender } = render(<Subject layout="board" drag={drag.engine} />)
    await waitFor(() => expect(document.querySelector('[data-slot="board"]')).not.toBeNull())
    drag.move('a', 'won')
    await act(async () => undefined)
    const won = (): HTMLElement =>
      document.querySelector<HTMLElement>('[data-slot="board-column"][data-column="won"]')!
    expect(within(won()).queryByText('Acme')).not.toBeNull()
    rerender(<Subject layout="board" drag={drag.engine} data={DEALS.map((d) => ({ ...d }))} />)
    expect(within(won()).queryByText('Acme')).toBeNull()
  })
})

/** An app's fifth layout: the rows as a plain ordered list, each a button that opens its row. */
const lanes: TableLayoutSpec<Deal> = {
  id: 'lanes',
  label: 'Lanes',
  hint: 'One line per deal',
  icon: () => null,
  render: (view) => (
    <ol data-testid="lanes">
      {view.rows.map((deal) => (
        <li key={view.rowId(deal)}>
          <button type="button" onClick={() => view.open(deal)}>
            {deal.name}
          </button>
        </li>
      ))}
    </ol>
  ),
}

describe("an app's layout", () => {
  test('is offered beside the built-ins and draws the shown rows through its render', async () => {
    const opened: string[] = []
    function WithLanes(): ReactElement {
      const c = col<Deal>()
      const t = useDataTable<Deal>({
        id: 'lanes-table',
        label: 'Deals',
        columns: [c.entity('name'), c.money('amount', { currency: 'EUR' })],
        data: DEALS,
        getRowId: (d) => d.id,
        mode: { kind: 'client' },
        layouts: ['table', lanes],
        onRowActivate: (deal) => opened.push(deal.id),
      })
      const built = modelOf(t)
      useEffect(() => {
        seen.model = built as unknown as TableModel<Deal>
        if (built.layout !== 'lanes') built.setLayout('lanes')
      })
      return <DataTable table={t} />
    }
    render(<WithLanes />)
    expect(seen.model?.layouts.map((entry) => entry.id)).toEqual(['table', 'lanes'])
    const list = await screen.findByTestId('lanes')
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Acme', 'Bolt', 'Cove'])
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(within(list).getByRole('button', { name: 'Bolt' }))
    expect(opened).toEqual(['b'])
  })

  test('a view saves its id like a built-in', () => {
    expect(storedState(state({ visibility: {}, layout: 'lanes' })).display.layout).toBe('lanes')
  })

  test('a saved id the table does not offer draws the table and warns in dev', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    function Stale(): ReactElement {
      const c = col<Deal>()
      const t = useDataTable<Deal>({
        id: 'stale-layout',
        label: 'Deals',
        columns: [c.entity('name')],
        data: DEALS,
        getRowId: (d) => d.id,
        mode: { kind: 'client' },
        layouts: ['table', 'list'],
      })
      const built = modelOf(t)
      // A view saved while the app still offered a timeline writes the id this table no longer has.
      useEffect(() => {
        seen.model = built as unknown as TableModel<Deal>
        if (built.state.display.layout !== 'timeline') built.setLayout('timeline')
      })
      return <DataTable table={t} />
    }
    render(<Stale />)
    const warned = warn.mock.calls.map((call) => String(call[0]))
    warn.mockRestore()
    expect(seen.model?.layout).toBe('table')
    expect(screen.getByRole('table')).toBeTruthy()
    expect(warned.some((line) => line.includes('"timeline"'))).toBe(true)
  })

  test("an id taken twice, or a built-in's, throws in dev", () => {
    function Clash(): ReactElement {
      const c = col<Deal>()
      const t = useDataTable<Deal>({
        id: 'clash',
        label: 'Deals',
        columns: [c.entity('name')],
        data: DEALS,
        getRowId: (d) => d.id,
        mode: { kind: 'client' },
        layouts: ['table', { ...lanes, id: 'list' }],
      })
      return <DataTable table={t} />
    }
    const error = spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Clash />)).toThrow(/"list" twice/)
    error.mockRestore()
  })
})
