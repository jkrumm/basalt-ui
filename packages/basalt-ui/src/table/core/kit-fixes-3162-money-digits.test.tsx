/**
 * Issue 3162: `c.money` takes `digits`, in the cell and the footer; a date cell keeps the body face.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { createFormat } from '../../core/format'
import { DataTable } from '../parts/data-table'
import { useDataTable } from '../use-data-table'
import { col } from './kinds'
import { formatMoney } from './kinds-cells'

afterEach(cleanup)

type Row = { id: string; name: string; amount: number; due: string }
const c = col<Row>()

function Subject({ digits }: { digits?: number }): ReactElement {
  const t = useDataTable<Row>({
    id: 'k3162-money',
    label: 'Ledger',
    columns: [
      c.entity('name'),
      c.money('amount', {
        header: 'Amount',
        currency: 'EUR',
        ...(digits !== undefined && { digits }),
        footer: 'sum',
      }),
      c.date('due', { header: 'Due' }),
    ],
    data: [{ id: 'a', name: 'Invoice', amount: 1234.5, due: '2026-11-08' }],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

describe('formatMoney digits', () => {
  const format = createFormat({ locale: 'en' })
  test('defaults to the currency digits and takes an override', () => {
    expect(formatMoney(format, 1234.5, 'EUR')).toBe('1,234.50')
    expect(formatMoney(format, 1234.5, 'EUR', 0)).toBe('1,235')
    expect(formatMoney(format, 1234.5, 'JPY', 2)).toBe('1,234.50')
  })
})

describe('c.money digits', () => {
  test('the cell and the footer write the figure in the digits asked', () => {
    const { container } = render(<Subject digits={0} />)
    const body = container.querySelector('tbody tr:first-child')?.textContent ?? ''
    expect(body).toContain('1,235')
    expect(body).not.toContain('1,234.50')
    expect(container.querySelector('tfoot')?.textContent ?? '').toContain('1,235')
  })

  test('without it the currency digits stay', () => {
    const { container } = render(<Subject />)
    expect(container.querySelector('tbody tr:first-child')?.textContent ?? '').toContain('1,234.50')
  })
})

describe('a date cell', () => {
  test('keeps the body face with tabular figures unless the column asks for mono', () => {
    const { container } = render(<Subject />)
    const cell = container.querySelector('tbody tr:first-child [data-kind="date"]')
    const time = cell?.querySelector('time')
    expect(time).not.toBeNull()
    expect(time?.hasAttribute('data-monospace')).toBe(false)
    expect(time?.className ?? '').not.toContain('font-mono')
    expect(cell?.getAttribute('data-numerals')).toBe('tabular')
  })
})
