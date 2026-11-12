/**
 * The header column menu (docs/v3/issues/g3/v3-table-t3b-selection.json): Sort, Hide and Reset act
 * on the column through the table's state, the identity column cannot be hidden, and the actions
 * column has no menu.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
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
      c.actions([{ key: 'x', label: 'Open', onClick: () => undefined }]),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const payees = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('tbody td:first-child')].map((td) => td.textContent ?? '')
const menuOf = (header: string): HTMLElement =>
  screen.getByRole('button', { name: `${header} column actions` })

async function open(header: string): Promise<void> {
  await act(async () => {
    fireEvent.click(menuOf(header))
  })
}
async function pick(name: string): Promise<void> {
  const item = await screen.findByRole('menuitem', { name })
  await act(async () => {
    fireEvent.click(item)
  })
}

describe('column actions menu', () => {
  test('sort descending, then clear sort, act on the column', async () => {
    const { container } = render(<Subject />)
    await open('Amount (EUR)')
    await pick('Sort descending')
    expect(payees(container)).toEqual(['Rent', 'Gym', 'Bakery'])
    expect(container.querySelector('th[aria-sort="descending"]')?.textContent).toContain(
      'Amount (EUR)',
    )

    await open('Amount (EUR)')
    await pick('Clear sort')
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
    expect(screen.getByRole('menuitem', { name: 'Sort ascending' })).toBeTruthy()
  })

  test('the actions column has no menu', () => {
    const { container } = render(<Subject />)
    expect(container.querySelectorAll('th button[aria-label$="column actions"]')).toHaveLength(2)
  })
})
