/**
 * The view lane of a table (docs/v3/issues/bench/bench-table-view.json): column widths, row height,
 * a reader's group-by and footer reduces live in `display` (the device store and saved views, never
 * the URL), each with a setter on the model, and the grid look's row numbers and pinned edge.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import type { TableState, UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { planInputs, RESIZE_MAX_PX, minWidthPx, rowNumberPx } from '../core/plan'
import type { PlanInput } from '../core/plan'
import { arrangeColumns } from '../core/arrange'
import { modelOf, useDataTable } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { VirtualList } from '../../ui/virtual-list'
import { DataTable } from './data-table'
import { aggregateOf, aggregatesOf, nextAggregate } from './footer-model'
import { isViewDirty, saveView, viewDisplay } from './views-model'

type Row = { id: string; name: string; status: string; team: string; amount: number }

const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', status: 'open', team: 'Eng', amount: 10 },
  { id: 'b', name: 'Bravo', status: 'done', team: 'Ops', amount: 20 },
  { id: 'c', name: 'Charlie', status: 'open', team: 'Eng', amount: 30 },
  { id: 'd', name: 'Delta', status: 'open', team: 'Ops', amount: 40 },
]

let model: TableModel<Row> | undefined
const latest = (): TableModel<Row> => {
  if (model === undefined) throw new Error('no table rendered')
  return model
}

function Subject({
  id = 'view',
  options = {},
  maxRows,
  windowed = false,
}: {
  id?: string
  options?: Partial<UseDataTable<Row>>
  maxRows?: number
  windowed?: boolean
}): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id,
    label: 'Tickets',
    columns: [
      c.entity('name'),
      c.status('status', { options: ['open', 'done'] }),
      c.text('team'),
      c.money('amount', { currency: 'EUR' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
    ...options,
  } as UseDataTable<Row>)
  const current = modelOf(t)
  useEffect(() => {
    model = current
  })
  if (windowed) return <DataTable table={t} height="fill" virtual={VirtualList} />
  return maxRows === undefined ? (
    <DataTable table={t} />
  ) : (
    <DataTable table={t} height={{ maxRows }} />
  )
}

const stored = (id: string): TableState['display'] =>
  (
    JSON.parse(localStorage.getItem(`basalt:table:${id}`) ?? 'null') as {
      value: TableState['display']
    }
  ).value

const colWidth = (container: HTMLElement, index: number): string =>
  container.querySelectorAll<HTMLElement>('colgroup col')[index]?.style.width ?? ''

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  model = undefined
})

describe('column widths', () => {
  test('the plan takes a reader width, held to the kind minimum and the maximum, and fixes a flexible column', () => {
    const inputs: PlanInput[] = [
      {
        id: 'name',
        kind: 'entity',
        card: ['title'],
        priority: 1,
        width: { ch: 18, flex: true },
        pin: null,
      },
      {
        id: 'amount',
        kind: 'money',
        card: ['value'],
        priority: 1,
        width: { ch: 12, flex: false },
        pin: null,
      },
      { id: 'act', kind: 'actions', card: ['kebab'], priority: null, width: 'icon', pin: null },
    ]
    const plan = planInputs(inputs, { widths: { name: 300, amount: 2, act: 500 } })
    expect(plan.columns[0]).toMatchObject({ widthPx: 300, flex: false })
    expect(plan.columns[1]?.widthPx).toBe(minWidthPx('money'))
    expect(plan.columns[2]?.widthPx).toBe(44)
    expect(planInputs(inputs, { widths: { name: 5000 } }).columns[0]?.widthPx).toBe(RESIZE_MAX_PX)
  })

  test('pinned offsets follow resized widths, and the last pinned column carries the edge', () => {
    const inputs: PlanInput[] = [
      {
        id: 'name',
        kind: 'entity',
        card: ['title'],
        priority: 1,
        width: { ch: 18, flex: true },
        pin: null,
      },
      {
        id: 'team',
        kind: 'text',
        card: ['meta'],
        priority: 2,
        width: { ch: 16, flex: true },
        pin: null,
      },
      {
        id: 'amount',
        kind: 'number',
        card: ['value'],
        priority: 2,
        width: { ch: 10, flex: false },
        pin: null,
      },
    ]
    const plan = planInputs(inputs, { widths: { name: 250 } })
    const arranged = arrangeColumns(
      inputs.map((input) => ({ id: input.id, kind: input.kind })),
      plan,
      { pinned: ['team'] },
      84,
    )
    expect(arranged.plan.columns.map((c) => [c.id, c.pinAt, c.pinEdge])).toEqual([
      ['name', 84, undefined],
      ['team', 334, true],
      ['amount', undefined, undefined],
    ])
  })

  test('dragging a header edge previews the width, writes it on release and it survives a remount', () => {
    const { container, getByRole, unmount } = render(<Subject id="drag" />)
    const handle = getByRole('separator', { name: /^Resize Amount/ })
    const start = Number(handle.getAttribute('aria-valuenow'))
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 160, pointerId: 1 })
    // The drag shows at once; the device store is written once, on release.
    expect(colWidth(container, 3)).toBe(`${start + 60}px`)
    expect(localStorage.getItem('basalt:table:drag')).toBeNull()
    fireEvent.pointerUp(handle, { clientX: 160, pointerId: 1 })
    expect(stored('drag').widths).toEqual({ amount: start + 60 })
    unmount()
    const again = render(<Subject id="drag" />)
    expect(colWidth(again.container, 3)).toBe(`${start + 60}px`)
  })

  test('a windowed reading table hands the rest of the row to its trailing filler, resized columns or not', () => {
    const { container } = render(<Subject id="windowed" windowed />)
    const root = container.querySelector<HTMLElement>('[data-slot="table-root"]')!
    expect(root.hasAttribute('data-virtual')).toBe(true)
    expect(root.hasAttribute('data-fill')).toBe(true)
    expect(container.querySelector('col[data-fill]')).not.toBeNull()
    act(() => latest().setWidth('name', 300))
    act(() => latest().setWidth('team', 160))
    expect(root.hasAttribute('data-fill')).toBe(true)
    expect(container.querySelector('col[data-fill]')?.hasAttribute('style')).toBe(false)
  })

  test('a cancelled drag and a menu reset give the handle the width drawn on screen', () => {
    const { getByRole } = render(<Subject id="cancel" />)
    const handle = getByRole('separator', { name: /^Resize Amount/ })
    // jsdom lays nothing out: the header cell reports the width a browser would draw.
    let onScreen = 211
    const cell = handle.closest('th')!
    cell.getBoundingClientRect = () => ({ width: onScreen }) as DOMRect
    act(() => latest().setWidth('amount', 300))
    act(() => latest().setWidth('amount', undefined))
    expect(handle.getAttribute('aria-valuenow')).toBe('211')
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 })
    onScreen = 271
    fireEvent.pointerMove(handle, { clientX: 160, pointerId: 1 })
    expect(handle.getAttribute('aria-valuenow')).toBe('271')
    onScreen = 211
    fireEvent.pointerCancel(handle, { clientX: 160, pointerId: 1 })
    expect(handle.getAttribute('aria-valuenow')).toBe('211')
    expect(latest().state.display.widths?.['amount']).toBeUndefined()
  })

  test('the keyboard moves the edge, Home and End go to the bounds, Enter and a double-click reset it', () => {
    const { getByRole } = render(<Subject id="keys" />)
    const handle = getByRole('separator', { name: /^Resize Amount/ })
    const start = Number(handle.getAttribute('aria-valuenow'))
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(start + 8))
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(start - 32))
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(minWidthPx('money')))
    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(RESIZE_MAX_PX))
    fireEvent.keyDown(handle, { key: 'Enter' })
    expect(handle.getAttribute('aria-valuenow')).toBe(String(start))
    expect(stored('keys').widths).toEqual({})
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    fireEvent.doubleClick(handle)
    expect(handle.getAttribute('aria-valuenow')).toBe(String(start))
  })

  test('the actions column has no handle', () => {
    const c = col<Row>()
    const { queryByRole } = render(
      <Subject
        options={{
          columns: [
            c.entity('name'),
            c.actions([{ id: 'x', label: 'X', onClick: () => undefined }]),
          ],
        }}
      />,
    )
    expect(queryByRole('separator', { name: /Resize/ })).not.toBeNull()
    expect(document.querySelectorAll('[data-slot="table-resize"]')).toHaveLength(1)
  })
})

describe('row height', () => {
  test('a step rebinds the density on the scroller and the body; the head keeps its height', () => {
    const { container } = render(<Subject id="rows" />)
    const body = container.querySelector('[data-slot="table-scroller"]')
    expect(body?.hasAttribute('data-density')).toBe(false)
    for (const height of ['dense', 'normal', 'comfortable'] as const) {
      act(() => latest().setRowHeight(height))
      expect(body?.getAttribute('data-density')).toBe(height)
      // The body carries it too, so a bespoke layout's `DataTableBody` takes the step without the scroller.
      expect(
        container.querySelector('[data-slot="table-body"]')?.getAttribute('data-density'),
      ).toBe(height)
      expect(
        container.querySelector('[data-slot="table-header"]')?.hasAttribute('data-density'),
      ).toBe(false)
      expect(stored('rows').rowHeight).toBe(height)
    }
    act(() => latest().setRowHeight(undefined))
    expect(body?.hasAttribute('data-density')).toBe(false)
    expect(stored('rows').rowHeight).toBeUndefined()
  })

  test('a maxRows height counts the head at the app row and the body rows at the step', () => {
    const { container } = render(
      <Subject id="cap" maxRows={3} options={{ rowHeight: 'comfortable' }} />,
    )
    const scroller = container.querySelector<HTMLElement>('[data-slot="table-scroller"]')
    expect(scroller?.getAttribute('data-density')).toBe('comfortable')
    // The scroller's own `--basalt-row-h` is the step's; the head row is the root's, which no step moves.
    expect(scroller?.style.maxHeight).toBe(
      'calc(var(--table-app-row-h, var(--basalt-row-h)) + 3 * var(--table-row-h, var(--basalt-row-h)))',
    )
  })

  test('the declared rowHeight holds until the view picks one', () => {
    const { container } = render(<Subject id="declared" options={{ rowHeight: 'comfortable' }} />)
    const body = container.querySelector('[data-slot="table-scroller"]')
    expect(body?.getAttribute('data-density')).toBe('comfortable')
    act(() => latest().setRowHeight('dense'))
    expect(body?.getAttribute('data-density')).toBe('dense')
  })
})

const groups = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-group] [data-slot="table-group"]')].map(
    (g) => g.textContent ?? '',
  )

describe('group-by', () => {
  test('a status column groups from its column menu, with a count and the footer reduce', () => {
    const { container, getByRole } = render(<Subject id="by-status" />)
    fireEvent.click(getByRole('button', { name: 'Status' }))
    fireEvent.click(getByRole('menuitem', { name: 'Group by Status' }))
    expect(groups(container)).toEqual(['open3 rows', 'done1 row'])
    expect(stored('by-status').groupBy).toBe('status')
    act(() => latest().setAggregate('amount', 'sum'))
    const open = container.querySelector('[data-group]')
    expect(within(open as HTMLElement).getByText('80.00')).not.toBeNull()
  })

  test('a text column groups too; collapsing hides its rows; a new grouping opens every group', () => {
    const { container } = render(<Subject id="by-team" />)
    act(() => latest().setGroupBy('team'))
    expect(groups(container)).toEqual(['Eng2 rows', 'Ops2 rows'])
    act(() => latest().toggleGroup('Eng'))
    expect(container.querySelectorAll('tbody tr[role="row"]:not([data-group])')).toHaveLength(2)
    act(() => latest().setGroupBy('status'))
    expect(stored('by-team').collapsed).toEqual([])
    expect(container.querySelectorAll('tbody tr[role="row"]:not([data-group])')).toHaveLength(4)
  })

  test('none drops a declared grouping, undefined returns to it; a server table never groups', () => {
    const { container } = render(
      <Subject id="declared-group" options={{ group: { by: 'team' } }} />,
    )
    expect(groups(container)).toHaveLength(2)
    act(() => latest().setGroupBy(null))
    expect(groups(container)).toHaveLength(0)
    expect(latest().groupBy).toBeNull()
    act(() => latest().setGroupBy(undefined))
    expect(latest().groupBy).toBe('team')
    expect(latest().groupable('amount')).toBe(false)
    cleanup()
    render(<Subject id="server" options={{ mode: { kind: 'server', rowCount: 4 } }} />)
    expect(latest().groupable('status')).toBe(false)
  })
})

describe('footer aggregates', () => {
  test('a kind allows what it can reduce, and a pick wins over the declared footer', () => {
    const c = col<Row>()
    const [name, status, , amount] = [
      c.entity('name'),
      c.status('status', { options: ['open'] }),
      c.text('team'),
      c.money('amount', { currency: 'EUR', footer: 'sum' }),
    ].map(
      (column) =>
        (column as unknown as { [k: symbol]: Parameters<typeof aggregatesOf>[0] & { id: string } })[
          Symbol.for('basalt-ui.table.kind-spec')
        ]!,
    )
    expect(aggregatesOf(amount!)).toEqual(['sum', 'mean', 'min', 'max', 'count'])
    expect(aggregatesOf(status!)).toEqual(['count'])
    expect(aggregatesOf(name!)).toEqual(['count'])
    expect(aggregateOf(amount!, undefined, false)).toBe('sum')
    expect(aggregateOf(amount!, { amount: 'max' }, false)).toBe('max')
    expect(aggregateOf(amount!, { amount: 'none' }, false)).toBeUndefined()
    expect(aggregateOf(amount!, { amount: 'max' }, true)).toBe('sum')
    expect(aggregateOf(status!, { status: 'sum' }, false)).toBeUndefined()
    expect(nextAggregate(['sum', 'count'], 'sum')).toBe('count')
    expect(nextAggregate(['sum', 'count'], 'count')).toBe('none')
    expect(nextAggregate(['sum', 'count'], undefined)).toBe('sum')
  })

  test('a footer cell steps through the reduces, and the pick persists on the device', () => {
    const c = col<Row>()
    const columns = [c.entity('name'), c.money('amount', { currency: 'EUR', footer: 'sum' })]
    const { container, getByRole, unmount } = render(<Subject id="pick" options={{ columns }} />)
    const foot = (): HTMLElement =>
      container.querySelector('[data-slot="table-footer"]') as HTMLElement
    expect(within(foot()).getByText('100.00')).not.toBeNull()
    fireEvent.click(getByRole('button', { name: /^Amount \(EUR\), Sum/ }))
    expect(within(foot()).getByText('25.00')).not.toBeNull()
    expect(stored('pick').aggregates).toEqual({ amount: 'mean' })
    unmount()
    const again = render(<Subject id="pick" options={{ columns }} />)
    expect(
      within(again.container.querySelector('[data-slot="table-footer"]') as HTMLElement).getByText(
        '25.00',
      ),
    ).not.toBeNull()
  })

  test('a count on a text column draws the footer row where no footer was declared', () => {
    const { container } = render(<Subject id="count" />)
    expect(container.querySelector('[data-slot="table-footer"]')).toBeNull()
    act(() => latest().setAggregate('team', 'count'))
    const foot = container.querySelector('[data-slot="table-footer"]') as HTMLElement
    expect(foot.querySelector('[data-col="team"] dd')?.textContent).toBe('4')
  })
})

describe('the view carries them', () => {
  const base: TableState = {
    v: 1,
    request: { q: '', filters: [], sort: [], page: 1, pageSize: 25 },
    display: { visibility: {} },
  }
  const withView: TableState = {
    ...base,
    display: {
      visibility: {},
      widths: { amount: 200 },
      rowHeight: 'dense',
      groupBy: 'status',
      aggregates: { amount: 'max' },
    },
  }

  test('a saved view stores widths, row height, grouping and reduces, and a change makes it dirty', () => {
    const { views } = saveView([], 'Mine', withView)
    const view = views[0]!
    expect(view.state.display).toMatchObject(withView.display)
    expect(isViewDirty(view, withView)).toBe(false)
    for (const display of [
      { ...withView.display, widths: { amount: 210 } },
      { ...withView.display, rowHeight: 'normal' as const },
      { ...withView.display, groupBy: null },
      { ...withView.display, aggregates: {} },
    ]) {
      expect(isViewDirty(view, { ...withView, display })).toBe(true)
    }
  })

  test('applying a view restores its properties, and the declared ones where it carries none', () => {
    const applied = viewDisplay({ ...withView.display, collapsed: ['open'] }, { visibility: {} })
    expect(applied.widths).toEqual({})
    expect(applied.aggregates).toEqual({})
    expect(applied.rowHeight).toBeUndefined()
    expect('groupBy' in applied).toBe(false)
    expect(applied.collapsed).toEqual([])
    expect(viewDisplay(base.display, withView.display)).toMatchObject(withView.display)
  })
})

describe('the grid look', () => {
  test('the row-number column fits the largest number as it prints, separator included', () => {
    expect(rowNumberPx('9')).toBe(44)
    expect(rowNumberPx('3,334')).toBe(56)
    expect(rowNumberPx('10,000')).toBe(64)
    const many = Array.from({ length: 1200 }, (_, i) => ({ ...ROWS[0]!, id: `m${i}` }))
    const { container } = render(
      <Subject id="numbers" options={{ data: many, rowNumbers: true }} />,
    )
    const col = container.querySelector<HTMLElement>('colgroup col[data-kind="row-number"]')
    expect(col?.style.width).toBe(`${rowNumberPx('1,200')}px`)
  })

  test('row numbers run on across groups, and the identity column carries the pinned edge', () => {
    const { container } = render(
      <Subject id="grid" options={{ look: 'grid', rowNumbers: true, group: { by: 'status' } }} />,
    )
    const numbers = [...container.querySelectorAll('tbody [data-kind="row-number"]')]
      .map((cell) => cell.textContent)
      .filter((text) => text !== '')
    expect(numbers).toEqual(['1', '2', '3', '4'])
    expect(container.querySelector('thead [data-col="name"]')?.hasAttribute('data-pin-edge')).toBe(
      true,
    )
    expect(container.querySelector('thead [data-col="name"]')?.getAttribute('aria-colindex')).toBe(
      '2',
    )
  })

  test('a sideways scroll marks the root, and scrolling back clears it', () => {
    const { container } = render(<Subject id="scroll" options={{ look: 'grid' }} />)
    const root = container.querySelector('[data-slot="table-root"]') as HTMLElement
    const scroller = container.querySelector('[data-slot="table-scroller"]') as HTMLElement
    scroller.scrollLeft = 40
    fireEvent.scroll(scroller)
    expect(root.hasAttribute('data-scrolled')).toBe(true)
    scroller.scrollLeft = 0
    fireEvent.scroll(scroller)
    expect(root.hasAttribute('data-scrolled')).toBe(false)
  })
})
