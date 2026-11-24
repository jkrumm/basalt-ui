/**
 * The phone list row (`phone: 'cards'`, the default): the title, up to two muted meta values under it
 * and the answering value at the right edge, every other column behind the tap; `phone: 'fields'` keeps
 * the label-and-value grid. The geometry is the layout suite's (`table-phone-list.layout.test.ts`); this
 * file holds the markup the tier sheet reads and the tap that reaches every column.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from './contract'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Row = { id: string; name: string; a: number; b: number; c: number; load: number }
const ROWS: Row[] = [
  { id: 'r1', name: 'Kitchen', a: 11, b: 22, c: 33, load: 40 },
  { id: 'r2', name: 'Hall', a: 12, b: 23, c: 34, load: 80 },
]

function Subject({ phone }: { phone?: 'cards' | 'fields' }): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: `phone-list-${phone ?? 'default'}`,
    label: 'Rooms',
    columns: [
      c.entity('name', { header: 'Room' }),
      c.number('a', { header: 'Alpha' }),
      c.number('b', { header: 'Beta' }),
      c.number('c', { header: 'Gamma' }),
      c.meter('load', { header: 'Load', max: 100, card: 'value' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(phone !== undefined && { phone }),
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const rowCells = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('tbody tr:first-child [data-slot="table-cell"]'),
]

describe('phone: cards, the list row', () => {
  test('is the default, and the root says so for the tier sheet', () => {
    render(<Subject />)
    expect(document.querySelector('[data-slot="table-root"]')?.getAttribute('data-phone')).toBe(
      'cards',
    )
  })

  test('marks the title, two muted values and the answering meter; the third number is left to the tap', () => {
    render(<Subject />)
    const by = Object.fromEntries(
      rowCells().map((cell) => [
        cell.getAttribute('data-col'),
        [
          cell.getAttribute('data-place'),
          cell.getAttribute('data-phone-meta'),
          cell.hasAttribute('data-phone-value'),
        ],
      ]),
    )
    expect(by).toEqual({
      name: ['title', null, false],
      a: ['meta', '1', false],
      b: ['meta', '2', false],
      c: ['meta', null, false],
      load: ['value', null, true],
    })
  })

  test('a tap on the row opens the record with every column, headers included', () => {
    render(<Subject />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(document.querySelector('tbody tr') as HTMLElement)
    const dialog = screen.getByRole('dialog')
    for (const header of ['Alpha', 'Beta', 'Gamma', 'Load'])
      expect(dialog.textContent).toContain(header)
  })
})

describe('phone: fields, the label-and-value grid', () => {
  test('is a tier of its own', () => {
    render(<Subject phone="fields" />)
    expect(document.querySelector('[data-slot="table-root"]')?.getAttribute('data-phone')).toBe(
      'fields',
    )
  })
})
