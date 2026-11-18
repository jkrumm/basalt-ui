/**
 * The header's filter door (owner review 1, Issue 2282): every filterable kind opens its editor from
 * the column header, by pointer and by keyboard; the new operators filter rows; a status column's
 * categories are ranked from the header; and the header, the chips and the sheet read one state.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { settled } from '../../testing/settled'
import type { DateRangeLike, TableState } from '../contract'
import { tableCodec } from '../core/codec'
import { col } from '../core/kinds'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { DataTable } from './data-table'
import { TableToolbar } from './toolbar'
import { pruneView, saveView } from './views-model'

afterEach(cleanup)

type Row = {
  id: string
  name: string
  note: string
  state: string
  kind: string
  amount: number
  paid: boolean
  at: string
}
const ROWS: Row[] = [
  {
    id: 'a',
    name: 'Acme',
    note: 'rent',
    state: 'Open',
    kind: 'A',
    amount: 10,
    paid: true,
    at: '2026-10-02T09:00:00Z',
  },
  {
    id: 'b',
    name: 'Beta',
    note: 'food',
    state: 'Done',
    kind: 'B',
    amount: 200,
    paid: false,
    at: '2026-10-20T23:30:00Z',
  },
  {
    id: 'c',
    name: 'Acorn',
    note: 'tax',
    state: 'Blocked',
    kind: 'A',
    amount: 55,
    paid: true,
    at: '2026-11-03T08:00:00Z',
  },
  {
    id: 'd',
    name: 'Delta',
    note: 'rent',
    state: 'Done',
    kind: 'B',
    amount: 120,
    paid: true,
    at: '2026-11-15T12:00:00Z',
  },
]

/** A day picker that picks a fixed range on click, standing in for `DateRangePicker`. */
const FakePicker: DateRangeLike = (props) => (
  <button
    type="button"
    aria-label={props['aria-label']}
    onClick={() => props.onChange({ from: '2026-10-01', to: '2026-10-31' })}
  >
    {props.value?.from ?? 'none'}
  </button>
)

const c = col<Row>()
const COLUMNS = [
  c.entity('name', { header: 'Name' }),
  c.text('note', { header: 'Note', filter: 'text' }),
  c.status('state', {
    header: 'State',
    options: ['Open', 'Blocked', 'Done'],
    tone: (v) => (v === 'Done' ? 'good' : 'neutral'),
    filter: 'multi',
  }),
  c.select('kind', {
    header: 'Kind',
    label: (r) => `Kind of ${r.name}`,
    options: ['A', 'B'],
    commit: () => undefined,
    filter: 'multi',
  }),
  c.money('amount', { header: 'Amount', currency: 'EUR', filter: 'range', bounds: [0, 500] }),
  c.boolean('paid', { header: 'Paid', filter: 'multi' }),
  c.date('at', { header: 'Booked', filter: 'range', picker: FakePicker }),
]

let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}
const ids = (): string[] => model().rows.map((r) => r.id)

function Subject(): ReactElement {
  const t = useDataTable<Row>({
    id: 'door',
    label: 'Rows',
    columns: COLUMNS,
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    now: Date.UTC(2026, 10, 18, 12),
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} />
    </>
  )
}

/** Opens a column's ▾ menu and picks an item, by pointer. */
async function openByPointer(header: string, item: string): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: `${header} column actions` }))
  await settled()
  fireEvent.click(screen.getByRole('menuitem', { name: item }))
  await settled()
  return screen.getByRole('dialog', {
    name: item === 'Filter...' ? `Filter ${header}` : `Order of ${header}`,
  })
}

const set = (filters: TableState['request']['filters']) =>
  act(() => model().state.setRequest({ filters }))

describe('the header door opens every filterable kind', () => {
  test.each([
    ['Note', (d: HTMLElement) => within(d).getByRole('textbox', { name: 'Contains' })],
    ['State', (d: HTMLElement) => within(d).getByRole('checkbox', { name: /^Blocked\b/ })],
    ['Kind', (d: HTMLElement) => within(d).getByRole('checkbox', { name: /^B\b/ })],
    ['Amount (EUR)', (d: HTMLElement) => within(d).getAllByRole('slider')[0]],
    ['Paid', (d: HTMLElement) => within(d).getByRole('button', { name: 'Yes' })],
    ['Booked', (d: HTMLElement) => within(d).getByRole('button', { name: 'Booked range' })],
  ])('%s opens its editor from the header by pointer', async (header, control) => {
    render(<Subject />)
    const dialog = await openByPointer(header, 'Filter...')
    expect(control(dialog)).toBeTruthy()
  })

  test('a column with no filter offers no Filter item', async () => {
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Name column actions' }))
    await settled()
    expect(screen.queryByRole('menuitem', { name: 'Filter...' })).toBeNull()
  })

  test('the keyboard opens the editor: Enter on the menu button, Enter on Filter..., Escape returns focus', async () => {
    render(<Subject />)
    const trigger = screen.getByRole('button', { name: 'Amount (EUR) column actions' })
    act(() => trigger.focus())
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger)
    await settled()
    const item = screen.getByRole('menuitem', { name: 'Filter...' })
    act(() => item.focus())
    fireEvent.keyDown(item, { key: 'Enter' })
    fireEvent.click(item)
    await settled()
    const dialog = screen.getByRole('dialog', { name: 'Filter Amount (EUR)' })
    expect(within(dialog).getAllByRole('textbox').length).toBe(2)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settled()
    expect(screen.queryByRole('dialog', { name: 'Filter Amount (EUR)' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})

describe('the new operators filter rows', () => {
  test('a money range keeps the amounts inside it, ends inclusive, either end open', () => {
    render(<Subject />)
    set([{ id: 'amount', op: 'range', values: ['55', '120'] }])
    expect(ids()).toEqual(['c', 'd'])
    set([{ id: 'amount', op: 'range', values: ['100', ''] }])
    expect(ids()).toEqual(['b', 'd'])
    set([{ id: 'amount', op: 'range', values: ['', '10'] }])
    expect(ids()).toEqual(['a'])
  })

  test('a date range compares the day each instant falls on in the table zone (UTC)', () => {
    render(<Subject />)
    set([{ id: 'at', op: 'range', values: ['2026-10-01', '2026-10-31'] }])
    expect(ids()).toEqual(['a', 'b'])
    set([{ id: 'at', op: 'range', values: ['2026-11-03', ''] }])
    expect(ids()).toEqual(['c', 'd'])
  })

  test('anyOf on a status and a boolean column keeps exact values', () => {
    render(<Subject />)
    set([{ id: 'state', op: 'anyOf', values: ['Done', 'Blocked'] }])
    expect(ids()).toEqual(['b', 'c', 'd'])
    set([{ id: 'paid', op: 'anyOf', values: ['false'] }])
    expect(ids()).toEqual(['b'])
  })

  test('the editors write the models: a preset, the picker, a checkbox, Yes', async () => {
    render(<Subject />)
    let dialog = await openByPointer('Booked', 'Filter...')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Last 7 days' }))
    expect(model().state.request.filters).toEqual([
      { id: 'at', op: 'range', values: ['2026-11-12', '2026-11-18'] },
    ])
    expect(ids()).toEqual(['d'])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Booked range' }))
    expect(model().state.request.filters[0]?.values).toEqual(['2026-10-01', '2026-10-31'])
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settled()
    dialog = await openByPointer('Paid', 'Filter...')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }))
    expect(model().state.request.filters.find((f) => f.id === 'paid')).toEqual({
      id: 'paid',
      op: 'anyOf',
      values: ['true'],
    })
    expect(ids()).toEqual(['a'])
  })

  test('the checklist counts each value under the other filters', async () => {
    render(<Subject />)
    set([{ id: 'paid', op: 'anyOf', values: ['true'] }])
    const dialog = await openByPointer('State', 'Filter...')
    const count = (name: string) =>
      within(dialog)
        .getByRole('checkbox', { name: new RegExp(`^${name}\\b`) })
        .closest('label')?.textContent
    expect(count('Open')).toBe('Open 1')
    expect(count('Done')).toBe('Done 1')
    expect(count('Blocked')).toBe('Blocked 1')
  })
})

describe('URL and saved views carry the new operators', () => {
  const codec = tableCodec(
    c.codec({
      name: 'entity',
      note: 'text',
      state: 'status',
      kind: 'select',
      amount: 'money',
      paid: 'boolean',
      at: 'date',
    }),
    { warn: () => undefined },
  )

  test('range, date range, anyOf, boolean and a rank round-trip through the URL', () => {
    const state: TableState = {
      ...codec.fallback,
      request: {
        ...codec.fallback.request,
        filters: [
          { id: 'state', op: 'anyOf', values: ['Done'] },
          { id: 'kind', op: 'anyOf', values: ['B'] },
          { id: 'amount', op: 'range', values: ['10', ''] },
          { id: 'paid', op: 'anyOf', values: ['true'] },
          { id: 'at', op: 'range', values: ['2026-10-01', '2026-10-31'] },
        ],
        sort: [{ id: 'state', desc: false }],
        ranks: { state: ['Done', 'Open', 'Blocked'] },
      },
    }
    const raw = codec.encode('table', state)
    expect(raw).toMatchObject({
      'f.state': 'Done',
      'f.kind': 'B',
      'f.amount': '10..',
      'f.paid': 'true',
      'f.at': '2026-10-01..2026-10-31',
      'rank.state': 'Done,Open,Blocked',
      sort: 'state.asc',
    })
    const back = codec.decode('table', raw)
    expect(back?.request).toEqual(state.request)
  })

  test('a saved view keeps the filters and the rank and restores the same rows', () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({
        filters: [
          { id: 'amount', op: 'range', values: ['50', ''] },
          { id: 'at', op: 'range', values: ['', '2026-11-30'] },
        ],
      }),
    )
    act(() => model().setRank('state', ['Done', 'Blocked', 'Open']))
    const rows = ids()
    expect(rows).toEqual(['b', 'd', 'c'])
    const { views, id } = saveView([], 'Mine', model().state.state)
    const saved = views.find((v) => v.id === id)!
    act(() => model().state.setRequest({ filters: [], sort: [], ranks: {} }))
    expect(ids()).not.toEqual(rows)
    const { view } = pruneView(saved, new Set(COLUMNS.map((col) => col.id)))
    act(() => model().state.setRequest(view.state.request))
    expect(ids()).toEqual(rows)
    expect(model().state.request.ranks).toEqual({ state: ['Done', 'Blocked', 'Open'] })
  })
})

describe('category order', () => {
  test('Alt+ArrowDown in the order popup moves a category, re-sorts the rows and is announced', async () => {
    render(<Subject />)
    const dialog = await openByPointer('State', 'Order categories...')
    const grip = within(dialog).getByRole('button', { name: /^Move Open, position 1 of 3/ })
    fireEvent.keyDown(grip, { key: 'ArrowDown', altKey: true })
    await settled()
    expect(model().state.request.ranks).toEqual({ state: ['Blocked', 'Open', 'Done'] })
    expect(model().state.request.sort).toEqual([{ id: 'state', desc: false }])
    expect(model().rows.map((r) => r.original.state)).toEqual(['Blocked', 'Open', 'Done', 'Done'])
    expect(within(dialog).getByRole('status').textContent).toBe('Open moved to position 2 of 3')
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: /^Move Open, position 2 of 3/ }),
    )
  })

  test('dragging a row by its grip moves it past the rows it crosses and writes once, on release', async () => {
    render(<Subject />)
    const dialog = await openByPointer('State', 'Order categories...')
    const row = within(dialog)
      .getByRole('button', { name: /^Move Open/ })
      .closest('li') as HTMLElement
    Object.defineProperty(row, 'offsetHeight', { value: 32 })
    const grip = within(row).getByRole('button')
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, pointerType: 'touch', clientY: 100 })
    fireEvent.pointerMove(row, { pointerId: 1, clientY: 150 })
    expect(model().state.request.ranks).toBeUndefined()
    fireEvent.pointerMove(row, { pointerId: 1, clientY: 166 })
    fireEvent.pointerUp(row, { pointerId: 1, clientY: 166 })
    await settled()
    expect(model().state.request.ranks).toEqual({ state: ['Blocked', 'Done', 'Open'] })
  })

  test('touch on the row outside the grip never drags (the sheet still scrolls)', async () => {
    render(<Subject />)
    const dialog = await openByPointer('State', 'Order categories...')
    const row = within(dialog)
      .getByRole('button', { name: /^Move Open/ })
      .closest('li') as HTMLElement
    Object.defineProperty(row, 'offsetHeight', { value: 32 })
    const label = within(row).getByText('Open')
    fireEvent.pointerDown(label, { button: 0, pointerId: 2, pointerType: 'touch', clientY: 100 })
    fireEvent.pointerMove(row, { pointerId: 2, clientY: 180 })
    fireEvent.pointerUp(row, { pointerId: 2, clientY: 180 })
    expect(model().state.request.ranks).toBeUndefined()
  })

  test('arrows without Alt move focus, Reset to default drops the rank', async () => {
    render(<Subject />)
    act(() => model().setRank('state', ['Done', 'Open', 'Blocked']))
    const dialog = await openByPointer('State', 'Order categories...')
    const first = within(dialog).getByRole('button', { name: /^Move Done, position 1/ })
    act(() => first.focus())
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: /^Move Open/ }))
    expect(model().state.request.ranks).toEqual({ state: ['Done', 'Open', 'Blocked'] })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset to default' }))
    expect(model().state.request.ranks).toEqual({})
    expect(model().rankOf('state')).toEqual(['Open', 'Blocked', 'Done'])
  })

  test('the checklist lists a ranked column in its rank', async () => {
    render(<Subject />)
    act(() => model().setRank('state', ['Done', 'Open', 'Blocked']))
    const dialog = await openByPointer('State', 'Filter...')
    const names = within(dialog)
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent?.split(' ')[0])
    expect(names).toEqual(['Done', 'Open', 'Blocked'])
  })
})

describe('one state behind the header, the chips and the sheet', () => {
  test('a filter set in the header shows as a chip, a header mark and a checked box in the sheet', async () => {
    render(<Subject />)
    const dialog = await openByPointer('State', 'Filter...')
    fireEvent.click(
      within(dialog)
        .getByRole('checkbox', { name: /^Done\b/ })
        .closest('label') as HTMLElement,
    )
    await settled()
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['Done'] }])
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settled()
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(chips.textContent).toContain('State is Done')
    const mark = screen.getByRole('button', { name: 'State filtered: Done. Edit filter' })
    fireEvent.click(screen.getByRole('button', { name: 'Filters (1)' }))
    await settled()
    const sheet = screen.getByRole('dialog', { name: 'Filters' })
    const box = within(sheet).getByRole('checkbox', { name: /^Done\b/ })
    expect(box.getAttribute('aria-checked')).toBe('true')
    // Removing the chip clears all three.
    fireEvent.click(
      within(chips).getByRole('button', { name: 'Remove filter State', hidden: true }),
    )
    await settled()
    expect(model().state.request.filters).toEqual([])
    expect(mark.isConnected).toBe(false)
    expect(
      within(sheet)
        .getByRole('checkbox', { name: /^Done\b/ })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  test('the header mark opens the editor in one click and names the filter', async () => {
    render(<Subject />)
    set([{ id: 'amount', op: 'range', values: ['10', '200'] }])
    fireEvent.click(
      screen.getByRole('button', { name: 'Amount (EUR) filtered: €10.00 – €200.00. Edit filter' }),
    )
    await settled()
    expect(screen.getByRole('dialog', { name: 'Filter Amount (EUR)' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Active filters' }).textContent).toContain(
      'Amount (EUR) €10.00 – €200.00',
    )
  })
})
