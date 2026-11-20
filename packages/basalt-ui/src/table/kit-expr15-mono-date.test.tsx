/**
 * The contract row of expression cycle 15 (`v3-expr-15-contract`, field 1): a date or relative-time
 * column that sets `mono` draws its value in the mono face with tabular numerals, in the cell and so
 * on the phone card's labelled line, where the label stays in the body face. The phone card is the
 * same cell under the card stylesheet (`data-label` names its line), so the face rides on the value.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Row = { id: string; name: string; received: string; due: string; seen: string }
const ROWS: Row[] = [
  {
    id: 'a',
    name: 'Invoice 41',
    received: '2026-11-08',
    due: '2026-11-15',
    seen: '2026-11-01T09:00:00Z',
  },
]

const c = col<Row>()

function Subject(): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr15-mono',
    label: 'Invoices',
    columns: [
      c.entity('name', { header: 'Invoice' }),
      c.date('received', { header: 'Received', mono: true, card: 'meta' }),
      c.date('due', { header: 'Due', card: 'meta' }),
      c.relativeTime('seen', { header: 'Seen', mono: true, card: 'meta' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

const cellOf = (container: HTMLElement, label: string): Element | null =>
  container.querySelector(`tbody tr:first-child [data-slot="table-cell"][data-label="${label}"]`)

describe('a mono date column', () => {
  test('draws its value in the mono face with tabular numerals, on the labelled card line', () => {
    const { container } = render(<Subject />)
    const time = cellOf(container, 'Received')?.querySelector('time')
    expect(time?.hasAttribute('data-monospace')).toBe(true)
    expect(time?.className).toContain('font-mono')
    expect(time?.className).toContain('tabular-nums')
    expect(time?.getAttribute('dateTime')).toBe('2026-11-08')
  })

  test('keeps a date column without mono in the body face', () => {
    const { container } = render(<Subject />)
    const time = cellOf(container, 'Due')?.querySelector('time')
    expect(time).not.toBeNull()
    expect(time?.hasAttribute('data-monospace')).toBe(false)
    expect(time?.className ?? '').not.toContain('font-mono')
  })

  test('draws a mono relative time in the mono face and keeps its full date for the reader', () => {
    const { container } = render(<Subject />)
    const time = cellOf(container, 'Seen')?.querySelector('time')
    expect(time?.hasAttribute('data-monospace')).toBe(true)
    expect(time?.className).toContain('font-mono')
    expect(time?.getAttribute('aria-label')).not.toBeNull()
  })
})
