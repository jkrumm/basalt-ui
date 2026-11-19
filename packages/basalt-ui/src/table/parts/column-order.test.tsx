/**
 * Movable columns, user pins and the grid look (owner review 2, docs/v3/verdicts/table-grid-research.md):
 * the pure arrangement, a column moved by drag and by keyboard in the Display list and from its
 * menu, the order surviving a reload through the device lane and riding in a saved view, a pin in
 * the grid look, and the grid's cell keyboard.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { settled } from '../../testing/settled'
import type { UseDataTable, View } from '../contract'
import { arrangeColumns, moveColumn } from '../core/arrange'
import { col } from '../core/kinds'
import { planInputs } from '../core/plan'
import type { PlanInput } from '../core/plan'
import { modelOf, useDataTable } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { DataTable } from './data-table'
import { TableToolbar } from './toolbar'
import { isViewDirty, pruneView, saveView } from './views-model'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

type Row = { id: string; payee: string; amount: number; state: string; note: string }

const ROWS: Row[] = [
  { id: 'a', payee: 'Rent', amount: 900, state: 'Open', note: 'monthly' },
  { id: 'b', payee: 'Bakery', amount: 12, state: 'Paid', note: 'bread' },
  { id: 'c', payee: 'Gym', amount: 40, state: 'Open', note: 'fees' },
]

let current: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (current === undefined) throw new Error('not rendered')
  return current
}

function Subject({
  look,
  onOpen,
}: {
  look?: 'reading' | 'grid'
  onOpen?: (row: Row) => void
}): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'moves',
    label: 'Bookings',
    columns: [
      c.entity('payee', { header: 'Payee' }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.text('state', { header: 'State' }),
      c.text('note', { header: 'Note' }),
      c.actions([{ id: 'x', label: 'Open', onClick: () => undefined }]),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(look !== undefined && { look }),
    ...(onOpen !== undefined && { onRowActivate: onOpen }),
  } as UseDataTable<Row>)
  const built = modelOf(t)
  useEffect(() => {
    current = built
  })
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} />
    </>
  )
}

const headers = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('thead th')]
    .map((th) => th.textContent?.trim() ?? '')
    .filter((text) => text !== '' && text !== 'Actions')

async function openDisplay(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: /^Display/ }))
  await settled()
  return screen.getByRole('dialog', { name: 'Display' })
}

describe('arrangeColumns', () => {
  const inputs: PlanInput[] = [
    { id: 'a', kind: 'text', card: [], priority: 2, width: { ch: 10, flex: false }, pin: null },
    { id: 'name', kind: 'entity', card: [], priority: 1, width: { ch: 20, flex: true }, pin: null },
    { id: 'b', kind: 'text', card: [], priority: 2, width: { ch: 10, flex: false }, pin: null },
    { id: 'c', kind: 'text', card: [], priority: 2, width: { ch: 10, flex: false }, pin: null },
    { id: 'act', kind: 'actions', card: [], priority: null, width: 'icon', pin: 'end' },
  ] as unknown as PlanInput[]
  const plan = planInputs(inputs, { warn: () => undefined })
  const specs = inputs.map((input) => ({ id: input.id, kind: input.kind }))
  const ids = (display: Parameters<typeof arrangeColumns>[2], tick = 0) =>
    arrangeColumns(specs, plan, display, tick)

  test('the identity column leads and actions closes, whatever the stored order says', () => {
    expect(ids({}).specs.map((s) => s.id)).toEqual(['name', 'a', 'b', 'c', 'act'])
    expect(ids({ order: ['act', 'c', 'name', 'b', 'a'] }).specs.map((s) => s.id)).toEqual([
      'name',
      'c',
      'b',
      'a',
      'act',
    ])
  })

  test('an unknown id is ignored and a column the order does not name keeps its place after it', () => {
    expect(ids({ order: ['gone', 'c'] }).movable).toEqual(['c', 'a', 'b'])
  })

  test('a pinned column follows the identity column and stacks its offset after the tick', () => {
    const arranged = ids({ order: ['b', 'c', 'a'], pinned: ['a'] }, 40)
    expect(arranged.movable).toEqual(['a', 'b', 'c'])
    const [name, a, b] = arranged.plan.columns
    expect(name?.pinAt).toBe(40)
    expect(a?.pin).toBe('start')
    expect(a?.pinAt).toBe(40 + (name?.widthPx ?? 0))
    expect(b?.pinAt).toBeUndefined()
  })

  test('moveColumn clamps and leaves an unmoved list equal', () => {
    expect(moveColumn(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
    expect(moveColumn(['a', 'b', 'c'], 'c', 9)).toEqual(['a', 'b', 'c'])
    expect(moveColumn(['a', 'b', 'c'], 'b', -3)).toEqual(['b', 'a', 'c'])
  })
})

describe('moving a column', () => {
  test('by keyboard: Alt with Down on a grip in Display moves it, and the live region says where', async () => {
    const { container } = render(<Subject />)
    const panel = await openDisplay()
    const grip = within(panel).getByRole('button', { name: 'Move Amount (EUR), position 1 of 3' })
    act(() => grip.focus())
    fireEvent.keyDown(grip, { key: 'ArrowDown', altKey: true })
    await settled()
    expect(headers(container)).toEqual(['Payee', 'State', 'Amount (EUR)', 'Note'])
    expect(panel.querySelector('output')?.textContent).toBe('Amount (EUR) moved to position 2 of 3')
    expect(model().state.display.order).toEqual(['state', 'amount', 'note'])
  })

  test('by drag: a mouse dragging a row in Display past its neighbour moves the column', async () => {
    const { container } = render(<Subject />)
    const panel = await openDisplay()
    const rows = panel.querySelectorAll('[data-slot="table-order-row"]')
    const first = rows[0] as HTMLElement
    fireEvent.pointerDown(first, { button: 0, pointerId: 1, pointerType: 'mouse', clientY: 0 })
    // jsdom has no layout: one row's pitch is 1 px, so 2 px passes two neighbours.
    fireEvent.pointerMove(first, { pointerId: 1, pointerType: 'mouse', clientY: 2 })
    fireEvent.pointerUp(first, { pointerId: 1, pointerType: 'mouse', clientY: 2 })
    await settled()
    expect(headers(container)).toEqual(['Payee', 'State', 'Note', 'Amount (EUR)'])
  })

  test('from the column menu: Move right and Move left, disabled at the ends', async () => {
    const { container } = render(<Subject />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Amount (EUR) column actions' }))
    })
    expect(
      (await screen.findByRole('menuitem', { name: 'Move left' })).getAttribute('aria-disabled'),
    ).toBe('true')
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Move right' }))
    })
    expect(headers(container)).toEqual(['Payee', 'State', 'Amount (EUR)', 'Note'])
  })

  test('a menu move steps over a hidden column, so every click changes what the reader sees', async () => {
    const { container } = render(<Subject />)
    act(() => model().state.setDisplay({ visibility: { state: false } }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Amount (EUR) column actions' }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Move right' }))
    })
    expect(headers(container)).toEqual(['Payee', 'Note', 'Amount (EUR)'])
    expect(model().state.display.order).toEqual(['state', 'note', 'amount'])
  })

  test('the identity column is listed first, shown and fixed; the trigger names the hidden count', async () => {
    render(<Subject />)
    const panel = await openDisplay()
    const payee = within(panel).getByRole('checkbox', { name: 'Payee' })
    expect(payee.getAttribute('aria-checked')).toBe('true')
    expect(
      payee.hasAttribute('data-disabled') || payee.getAttribute('aria-disabled') === 'true',
    ).toBe(true)
    expect(within(panel).queryByRole('button', { name: /^Move Payee/ })).toBeNull()
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Note' }))
    await settled()
    expect(screen.getByRole('button', { name: 'Display, 1 hidden' })).toBeTruthy()
  })

  test('the order survives a reload: the device lane holds it', async () => {
    const first = render(<Subject />)
    act(() => model().moveColumn('note', 0))
    expect(headers(first.container)).toEqual(['Payee', 'Note', 'Amount (EUR)', 'State'])
    first.unmount()
    const again = render(<Subject />)
    await settled()
    expect(headers(again.container)).toEqual(['Payee', 'Note', 'Amount (EUR)', 'State'])
  })

  test('the declared order back stores no order at all', () => {
    render(<Subject />)
    act(() => model().moveColumn('note', 0))
    act(() => model().moveColumn('note', 2))
    expect(model().state.display.order).toEqual([])
  })
})

describe('order and pins in a saved view', () => {
  test('a view saves the order and the pins, differs while they do, and restores them', async () => {
    const { container } = render(<Subject look="grid" />)
    act(() => model().moveColumn('note', 0))
    act(() => model().setPinned('state', true))
    const { views } = saveView([], 'Mine', model().state.state)
    const view = views[0] as View
    expect(view.state.display.order).toEqual(['note', 'amount', 'state'])
    expect(view.state.display.pinned).toEqual(['state'])
    expect(isViewDirty(view, model().state.state)).toBe(false)
    act(() => model().moveColumn('note', 2))
    expect(isViewDirty(view, model().state.state)).toBe(true)
    expect(pruneView(view, new Set(['payee', 'amount', 'state'])).dropped).toEqual(['note'])
    act(() => model().state.setDisplay(view.state.display))
    await settled()
    expect(headers(container)).toEqual(['Payee', 'State', 'Note', 'Amount (EUR)'])
  })
})

describe('the grid look', () => {
  test('is a grid of grid cells, every visible column kept', () => {
    const { container } = render(<Subject look="grid" />)
    expect(container.querySelector('[data-slot="table"]')?.getAttribute('role')).toBe('grid')
    expect(container.querySelector('[data-slot="table-root"]')?.getAttribute('data-look')).toBe(
      'grid',
    )
    expect(container.querySelector('[data-slot="table-root"]')?.hasAttribute('data-full-at')).toBe(
      false,
    )
    expect(container.querySelectorAll('tbody tr:first-child [role="gridcell"]').length).toBe(5)
  })

  test('a pin from the menu draws the column pinned, after the name, at its offset', async () => {
    const { container } = render(<Subject look="grid" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Note column actions' }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin column' }))
    })
    expect(headers(container)).toEqual(['Payee', 'Note', 'Amount (EUR)', 'State'])
    const note = container.querySelector<HTMLElement>('tbody tr:first-child td:nth-child(2)')
    expect(note?.getAttribute('data-pin')).toBe('start')
    expect(note?.style.getPropertyValue('--table-pin-at')).toMatch(/^\d+px$/)
    expect(model().pinnedOf('note')).toBe(true)
  })

  test('the reading look offers no pin', async () => {
    render(<Subject />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Note column actions' }))
    })
    expect(await screen.findByRole('menuitem', { name: 'Move left' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Pin column' })).toBeNull()
  })

  test('arrow keys move one cell; Home, End and Ctrl+End jump; one cell is the tab stop', () => {
    const { container } = render(<Subject look="grid" />)
    const cell = (row: number, col: number): HTMLElement =>
      container.querySelectorAll<HTMLElement>('tbody tr')[row]!.querySelectorAll<HTMLElement>('td')[
        col
      ]!
    expect(container.querySelectorAll('tbody td[tabindex="0"]').length).toBe(1)
    expect(container.querySelector('tbody tr[tabindex]')).toBeNull()
    act(() => cell(0, 0).focus())
    fireEvent.keyDown(cell(0, 0), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(0, 1))
    fireEvent.keyDown(cell(0, 1), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cell(1, 1))
    fireEvent.keyDown(cell(1, 1), { key: 'End' })
    expect(document.activeElement).toBe(cell(1, 4))
    fireEvent.keyDown(cell(1, 4), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(1, 4))
    fireEvent.keyDown(cell(1, 4), { key: 'Home' })
    expect(document.activeElement).toBe(cell(1, 0))
    fireEvent.keyDown(cell(1, 0), { key: 'End', ctrlKey: true })
    expect(document.activeElement).toBe(cell(2, 4))
    expect(cell(2, 4).getAttribute('tabindex')).toBe('0')
  })

  test('Enter on a working cell activates its row; Enter on the menu cell goes in, Escape comes back', () => {
    const opened: string[] = []
    const { container } = render(<Subject look="grid" onOpen={(row) => opened.push(row.id)} />)
    const cells = container.querySelectorAll<HTMLElement>('tbody tr:first-child td')
    const name = cells[0]!
    const menu = cells[4]!
    act(() => name.focus())
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(opened).toEqual(['a'])
    act(() => menu.focus())
    fireEvent.keyDown(menu, { key: 'Enter' })
    const trigger = within(menu).getByRole('button', { name: 'Row actions' })
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('tabindex')).toBe('-1')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(document.activeElement).toBe(menu)
    expect(opened).toEqual(['a'])
  })

  test('a click on a working cell focuses it without opening the row; a click on the name opens it', () => {
    const opened: string[] = []
    const { container } = render(<Subject look="grid" onOpen={(row) => opened.push(row.id)} />)
    const cells = container.querySelectorAll<HTMLElement>('tbody tr:nth-child(2) td')
    fireEvent.click(cells[1]!)
    expect(opened).toEqual([])
    fireEvent.click(cells[0]!)
    expect(opened).toEqual(['b'])
  })
})
