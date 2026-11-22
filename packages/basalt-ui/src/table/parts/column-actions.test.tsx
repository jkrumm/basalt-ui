/**
 * The header column menu (docs/v3/issues/g3/v3-table-t3b-selection.json): the header's one button opens
 * the menu, where Sort, Hide and Reset act on the column through the table's state. The identity
 * column cannot be hidden, and the actions column has no menu.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { settled } from '../../testing/settled'
import { DataTable } from './data-table'
import { useDataTable } from '../use-data-table'

// The device lane (hidden columns) persists per table id; each test starts clean.
afterEach(() => {
  cleanup()
  localStorage.clear()
})

type Row = { id: string; payee: string; amount: number }

const ROWS: Row[] = [
  { id: 'a', payee: 'Rent', amount: 900 },
  { id: 'b', payee: 'Bakery', amount: 12 },
  { id: 'c', payee: 'Gym', amount: 40 },
]

function Subject(): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'c',
    label: 'Bookings',
    columns: [
      c.entity('payee', { header: 'Payee' }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.actions([{ id: 'x', label: 'Open', onClick: () => undefined }]),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const payees = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('td[data-col="payee"]')].map((td) => td.textContent ?? '')
// A header's one button, named by its label and, while it holds one, its sort or filter state.
const menuOf = (header: string): HTMLElement => {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return screen.getByRole('button', { name: new RegExp(`^${escaped}(, |$)`) })
}

async function open(header: string): Promise<void> {
  fireEvent.click(menuOf(header))
  await settled()
}
async function pick(name: string): Promise<void> {
  const sort = name.startsWith('Sort ') || name === 'No sorting'
  const item = await screen.findByRole(sort ? 'menuitemradio' : 'menuitem', { name })
  fireEvent.click(item)
  await settled()
  // a sort radio item keeps the menu open (Base UI closes a radio item only when asked): Escape closes it
  if (sort) {
    fireEvent.keyDown(item, { key: 'Escape' })
    await settled()
  }
}

describe('column actions menu', () => {
  test('sort descending, then no sorting, act on the column', async () => {
    const { container } = render(<Subject />)
    await open('Amount (EUR)')
    await pick('Sort descending')
    expect(payees(container)).toEqual(['Rent', 'Gym', 'Bakery'])
    expect(container.querySelector('th[aria-sort="descending"]')?.textContent).toContain(
      'Amount (EUR)',
    )

    await open('Amount (EUR)')
    await pick('No sorting')
    expect(payees(container)).toEqual(['Rent', 'Bakery', 'Gym'])
  })

  test('hide removes the column', async () => {
    const { container } = render(<Subject />)
    expect(container.querySelector('th[data-kind="money"]')).not.toBeNull()
    await open('Amount (EUR)')
    await pick('Hide column')
    expect(container.querySelector('th[data-kind="money"]')).toBeNull()
  })

  test('reset drops the sort of its column', async () => {
    const { container } = render(<Subject />)
    await open('Amount (EUR)')
    await pick('Sort ascending')
    expect(payees(container)).toEqual(['Bakery', 'Gym', 'Rent'])
    await open('Amount (EUR)')
    await pick('Reset column')
    expect(payees(container)).toEqual(['Rent', 'Bakery', 'Gym'])
  })

  test('the identity column cannot be hidden', async () => {
    render(<Subject />)
    await open('Payee')
    expect(screen.queryByRole('menuitem', { name: 'Hide column' })).toBeNull()
    expect(screen.getByRole('menuitemradio', { name: 'Sort ascending' })).toBeTruthy()
  })

  test('the actions column has no menu: only the two data headers carry a header button', () => {
    const { container } = render(<Subject />)
    expect(container.querySelectorAll('th button')).toHaveLength(2)
    expect(container.querySelectorAll('th button[aria-label$="column actions"]')).toHaveLength(0)
  })
})
