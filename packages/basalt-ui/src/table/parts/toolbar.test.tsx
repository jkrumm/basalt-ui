/**
 * `TableToolbar`: quick search (250 ms draft, IME-safe), the `+ Filter` popover with the kind's
 * editor, the Display popover, the `Filters (n)` sheet and the pure filter helpers. Tiers are CSS on
 * the toolbar's own container, so jsdom holds the markup and the layout test holds the geometry.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { settled } from '../../testing/settled'
import { col } from '../core/kinds'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { DataTable } from './data-table'
import { TableToolbar } from './toolbar'
import { filterValues, filterableSpecs, withFilter } from './toolbar-filters'

afterEach(cleanup)

type Row = { id: string; name: string; state: string; amount: number }
const ROWS: Row[] = [
  { id: 'a', name: 'Acme', state: 'Open', amount: 10 },
  { id: 'b', name: 'Beta', state: 'Done', amount: 20 },
  { id: 'c', name: 'Acorn', state: 'Done', amount: 30 },
]
const c = col<Row>()

let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject({ phone }: { phone?: 'cards' | 'scroll' }): ReactElement {
  const t = useDataTable<Row>({
    id: 'toolbar',
    label: 'Rows',
    columns: [
      c.entity('name', { header: 'Name', filter: 'text' }),
      c.status('state', { header: 'State', options: ['Open', 'Done'], filter: 'multi' }),
      c.money('amount', { header: 'Amount', currency: 'EUR' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(phone !== undefined && { phone }),
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

const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))))

describe('filter helpers', () => {
  const specs = [
    { id: 'name', filter: 'contains' },
    { id: 'amount', filter: null },
    { id: 'state', filter: 'anyOf' },
  ] as never[]

  test('only kinds with a filter are filterable', () => {
    expect(filterableSpecs(specs).map((s: { id: string }) => s.id)).toEqual(['name', 'state'])
  })

  test('withFilter replaces, appends and removes on an empty value list', () => {
    const base = [{ id: 'state', op: 'anyOf', values: ['Open'] }] as const
    const name = { id: 'name', filter: 'contains' } as never
    expect(withFilter(base, name, ['x'])).toEqual([
      { id: 'state', op: 'anyOf', values: ['Open'] },
      { id: 'name', op: 'contains', values: ['x'] },
    ])
    expect(withFilter(withFilter(base, name, ['x']), name, ['y'])[1]?.values).toEqual(['y'])
    expect(withFilter(withFilter(base, name, ['x']), name, [])).toEqual([...base])
    expect(filterValues(base, 'state')).toEqual(['Open'])
    expect(filterValues(base, 'name')).toEqual([])
  })
})

describe('quick search', () => {
  test('writes q 250 ms after the last keystroke, not before', async () => {
    render(<Subject />)
    const box = screen.getByRole('searchbox', { name: 'Search rows' })
    fireEvent.change(box, { target: { value: 'ac' } })
    expect((box as HTMLInputElement).value).toBe('ac')
    expect(model().state.request.q).toBe('')
    await wait(320)
    expect(model().state.request.q).toBe('ac')
  })

  test('an IME composition writes nothing until it ends', async () => {
    render(<Subject />)
    const box = screen.getByRole('searchbox', { name: 'Search rows' })
    fireEvent.compositionStart(box)
    fireEvent.change(box, { target: { value: 'ni' } })
    await wait(320)
    expect(model().state.request.q).toBe('')
    fireEvent.compositionEnd(box, { data: '你' })
    fireEvent.change(box, { target: { value: '你' } })
    await wait(320)
    expect(model().state.request.q).toBe('你')
  })

  test('the search box is a landmark of its own, named', () => {
    const html = renderToString(<Subject />)
    expect(html).toContain('<search')
    expect(html).toContain('data-slot="table-toolbar"')
  })
})

describe('+ Filter', () => {
  test('lists only filterable columns, then edits a text filter', async () => {
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: '+ Filter' }))
    await settled()
    const panel = screen.getByRole('dialog', { name: 'Filter by column' })
    expect(
      within(panel)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Name', 'State'])
    fireEvent.click(within(panel).getByRole('button', { name: 'Name' }))
    await settled()
    expect(
      within(screen.getByRole('dialog', { name: 'Filter by column' })).getByRole('button', {
        name: 'Back',
      }),
    ).toBeTruthy()
    const input = screen.getByRole('textbox', { name: 'Contains' })
    fireEvent.change(input, { target: { value: 'Ac' } })
    await wait(320)
    expect(model().state.request.filters).toEqual([{ id: 'name', op: 'contains', values: ['Ac'] }])
    expect(model().rows.map((r) => r.id)).toEqual(['a', 'c'])
  })

  test('a filter write returns to page 1', async () => {
    render(<Subject />)
    act(() => model().state.setRequest({ page: 3 }))
    fireEvent.click(screen.getByRole('button', { name: '+ Filter' }))
    await settled()
    const panel = screen.getByRole('dialog', { name: 'Filter by column' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Name' }))
    await settled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Contains' }), { target: { value: 'A' } })
    await wait(320)
    expect(model().state.request.page).toBe(1)
  })
})

describe('Display', () => {
  test('a column checkbox writes display.visibility', async () => {
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    await settled()
    const box = screen.getByRole('checkbox', { name: 'Amount (EUR)' })
    expect(box.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(box)
    await settled()
    expect(model().state.display.visibility['amount']).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amount (EUR)' }))
    await settled()
    expect(model().state.display.visibility['amount']).toBe(true)
  })
})

describe('Filters sheet', () => {
  test('the trigger carries the active count and opens a sheet with every editor', async () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({ filters: [{ id: 'name', op: 'contains', values: ['A'] }] }),
    )
    const trigger = screen.getByRole('button', { name: 'Filters (1)' })
    fireEvent.click(trigger)
    await settled()
    const sheet = screen.getByRole('dialog', { name: 'Filters' })
    expect(within(sheet).getByRole('textbox', { name: 'Contains' })).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear all filters' }))
    await settled()
    expect(model().state.request.filters).toEqual([])
  })

  test('a status filter picks values from the closed option list', async () => {
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await settled()
    const sheet = screen.getByRole('dialog', { name: 'Filters' })
    const input = within(sheet).getByRole('combobox', { name: 'Is any of' })
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await settled()
    fireEvent.click(await screen.findByRole('option', { name: 'Done' }, { timeout: 1500 }))
    await settled()
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['Done'] }])
    expect(model().rows.map((r) => r.id)).toEqual(['b', 'c'])
  })

  test('the sheet trigger is hidden by the toolbar container, not the viewport', () => {
    const html = renderToString(<Subject />)
    expect(html).toContain('@container/toolbar')
    expect(html).toMatch(
      /data-slot="table-filters-sheet"[^>]*class="[^"]*@max-\[479\.9px\]\/toolbar/,
    )
  })
})
