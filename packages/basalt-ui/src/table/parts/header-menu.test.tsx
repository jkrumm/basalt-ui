/**
 * The header's one menu (docs/v3/issues/bench/bench-table-rest.json): every action the old three header
 * controls offered (the sort button, the filter button and the caret menu) is reachable from the header
 * button's menu, by pointer, keyboard and tap, and the open menu passes axe.
 */
import axe from 'axe-core'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { settled } from '../../testing/settled'
import { col } from '../core/kinds'
import { modelOf, useDataTable } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { DataTable } from './data-table'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

type Row = { id: string; payee: string; note: string; amount: number }
const ROWS: Row[] = [
  { id: 'a', payee: 'Rent', note: 'May', amount: 900 },
  { id: 'b', payee: 'Bakery', note: 'Bread', amount: 12 },
  { id: 'c', payee: 'Gym', note: 'Monthly', amount: 40 },
]

let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject(): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'header-menu',
    label: 'Ledger',
    columns: [
      c.entity('payee', { header: 'Payee' }),
      c.money('amount', { currency: 'EUR', header: 'Amount', filter: 'range' }),
      c.text('note', { header: 'Note' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return <DataTable table={t} />
}

// A header's one button: the header cell's only button, named by the header text and its state.
const headerButton = (header: string): HTMLElement =>
  within(screen.getByRole('columnheader', { name: header })).getByRole('button')

const SORT_ITEMS = ['Sort ascending', 'Sort descending', 'No sorting']
const item = (name: string): HTMLElement =>
  screen.getByRole(SORT_ITEMS.includes(name) ? 'menuitemradio' : 'menuitem', { name })

// Opens a header's menu and picks one item by pointer. A sort radio keeps the menu open, so Escape closes it.
function pick(header: string, name: string): void {
  fireEvent.click(headerButton(header))
  const target = item(name)
  fireEvent.click(target)
  if (SORT_ITEMS.includes(name)) fireEvent.keyDown(target, { key: 'Escape' })
}

const order = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll('th[data-col]')].map((th) => th.getAttribute('data-col'))

describe('the one header menu holds every action the three controls offered', () => {
  test('sort ascending, descending and none are radio items, and aria-sort follows each', () => {
    render(<Subject />)
    const amountHeader = (): HTMLElement =>
      screen.getByRole('columnheader', { name: 'Amount (EUR)' })
    expect(amountHeader().getAttribute('aria-sort')).toBe('none')
    pick('Amount (EUR)', 'Sort ascending')
    expect(amountHeader().getAttribute('aria-sort')).toBe('ascending')
    pick('Amount (EUR)', 'Sort descending')
    expect(amountHeader().getAttribute('aria-sort')).toBe('descending')
    pick('Amount (EUR)', 'No sorting')
    expect(amountHeader().getAttribute('aria-sort')).toBe('none')
  })

  test('the sort radio items carry aria-checked on the current direction', () => {
    render(<Subject />)
    fireEvent.click(headerButton('Amount (EUR)'))
    const checked = (): (string | null)[] =>
      SORT_ITEMS.map((name) => item(name).getAttribute('aria-checked'))
    expect(checked()).toEqual(['false', 'false', 'true'])
    fireEvent.click(item('Sort descending'))
    expect(checked()).toEqual(['false', 'true', 'false'])
    fireEvent.click(item('Sort ascending'))
    expect(checked()).toEqual(['true', 'false', 'false'])
  })

  test('Filter column... opens the filter dialog under the header, and Escape returns focus to the header button', async () => {
    render(<Subject />)
    fireEvent.click(headerButton('Amount (EUR)'))
    fireEvent.click(item('Filter column...'))
    await settled()
    const dialog = screen.getByRole('dialog', { name: 'Filter Amount (EUR)' })
    expect(within(dialog).getAllByRole('textbox').length).toBe(2)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settled()
    expect(screen.queryByRole('dialog', { name: 'Filter Amount (EUR)' })).toBeNull()
    expect(document.activeElement).toBe(headerButton('Amount (EUR)'))
  })

  test('Hide column removes the column', () => {
    const { container } = render(<Subject />)
    expect(order(container)).toContain('amount')
    pick('Amount (EUR)', 'Hide column')
    expect(order(container)).toEqual(['payee', 'note'])
  })

  test('Move right and Move left step past a neighbour; the ends jump; the ends are disabled', () => {
    const { container } = render(<Subject />)
    expect(order(container)).toEqual(['payee', 'amount', 'note'])
    fireEvent.click(headerButton('Amount (EUR)'))
    expect(item('Move left').getAttribute('aria-disabled')).toBe('true')
    expect(item('Move to left end').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item('Move right'))
    expect(order(container)).toEqual(['payee', 'note', 'amount'])

    fireEvent.click(headerButton('Amount (EUR)'))
    expect(item('Move right').getAttribute('aria-disabled')).toBe('true')
    expect(item('Move to right end').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item('Move to left end'))
    expect(order(container)).toEqual(['payee', 'amount', 'note'])

    fireEvent.click(headerButton('Amount (EUR)'))
    fireEvent.click(item('Move to right end'))
    expect(order(container)).toEqual(['payee', 'note', 'amount'])
  })

  test('Reset width appears after a resize and drops the stored width', () => {
    render(<Subject />)
    act(() => model().setWidth('amount', 300))
    expect(model().state.display.widths?.['amount']).toBe(300)
    pick('Amount (EUR)', 'Reset width')
    expect(model().state.display.widths?.['amount']).toBeUndefined()
  })

  test('Reset column drops the sort of its column', () => {
    render(<Subject />)
    act(() => model().state.setRequest({ sort: [{ id: 'amount', desc: true }] }))
    expect(
      screen.getByRole('columnheader', { name: 'Amount (EUR)' }).getAttribute('aria-sort'),
    ).toBe('descending')
    pick('Amount (EUR)', 'Reset column')
    expect(model().state.request.sort).toEqual([])
    expect(
      screen.getByRole('columnheader', { name: 'Amount (EUR)' }).getAttribute('aria-sort'),
    ).toBe('none')
  })
})

describe('the menu opens by pointer, keyboard and tap', () => {
  test('a click on the header button opens its menu', () => {
    render(<Subject />)
    fireEvent.click(headerButton('Amount (EUR)'))
    expect(item('Sort ascending')).toBeTruthy()
  })

  test('ArrowDown on the focused header button opens its menu', async () => {
    render(<Subject />)
    const button = headerButton('Amount (EUR)')
    act(() => button.focus())
    fireEvent.keyDown(button, { key: 'ArrowDown' })
    await settled()
    expect(item('Sort ascending')).toBeTruthy()
  })

  test('Enter on the focused header button opens its menu', async () => {
    render(<Subject />)
    const button = headerButton('Amount (EUR)')
    act(() => button.focus())
    // happy-dom sends no click for Enter on a button; a browser sends the click that opens the menu here.
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)
    await settled()
    expect(item('Sort ascending')).toBeTruthy()
  })

  test('a tap on the header button opens its menu', async () => {
    render(<Subject />)
    const button = headerButton('Amount (EUR)')
    // A tap: the pointer events, then the compatibility mouse events and the click a browser fires after them.
    fireEvent.pointerDown(button, { pointerType: 'touch', pointerId: 1, button: 0 })
    fireEvent.pointerUp(button, { pointerType: 'touch', pointerId: 1, button: 0 })
    fireEvent.mouseDown(button, { button: 0 })
    fireEvent.mouseUp(button, { button: 0 })
    fireEvent.click(button)
    await settled()
    expect(item('Sort ascending')).toBeTruthy()
  })

  test('the open menu has no serious or critical axe violation', async () => {
    render(<Subject />)
    fireEvent.click(headerButton('Amount (EUR)'))
    await settled()
    expect(item('Sort ascending')).toBeTruthy()
    const result = await axe.run(document.body, {
      // jsdom-class DOMs have no layout or paint, so these rules cannot answer there.
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    })
    const bad = result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({
        id: v.id,
        // Base UI's focus guards are aria-hidden tab stops that keep focus in the open popup; no other node is waived.
        nodes: v.nodes.filter((n) => !n.html.includes('data-base-ui-focus-guard')),
      }))
      .filter((v) => v.nodes.length > 0)
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
      [],
    )
  })
})
