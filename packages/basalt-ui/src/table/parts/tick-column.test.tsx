/**
 * The tick column and its tri-state header (docs/v3/issues/g3/v3-table-t3b-selection.json): the
 * header is unchecked, indeterminate or checked by how many of the rows on screen are ticked, it
 * is a keyboard-reachable checkbox, and a tick cell carries `data-kind="tick"` so a `c.select`
 * editor cell and the tick never share a card-tier rule.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { DataTable } from './data-table'
import { triState } from './tri-state-header'
import { useDataTable } from '../use-data-table'

afterEach(cleanup)

type Row = { id: string; payee: string; category: string }

const ROWS: Row[] = [
  { id: 'a', payee: 'Rent', category: 'Housing' },
  { id: 'b', payee: 'Bakery', category: 'Food' },
  { id: 'c', payee: 'Gym', category: 'Food' },
]

function Subject(): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 't',
    label: 'Bookings',
    columns: [
      c.entity('payee'),
      c.select('category', {
        label: (r) => `Category of ${r.payee}`,
        options: ['Housing', 'Food'],
        commit: () => undefined,
      }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    selection: { bulk: [] },
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const header = (): HTMLElement =>
  screen.getByRole('checkbox', { name: 'Select all rows on this page' })
const rowTick = (index: number): HTMLElement =>
  screen.getAllByRole('checkbox', { name: 'Select row' })[index] as HTMLElement
const state = (el: HTMLElement): string =>
  el.getAttribute('aria-checked') === 'mixed'
    ? 'some'
    : el.getAttribute('aria-checked') === 'true'
      ? 'all'
      : 'none'

describe('triState', () => {
  test('none, some and all by the ticked count', () => {
    expect(triState(0, 3)).toBe('none')
    expect(triState(1, 3)).toBe('some')
    expect(triState(3, 3)).toBe('all')
    expect(triState(0, 0)).toBe('none')
  })
})

describe('tri-state header', () => {
  test('none, some and all follow the ticks, and the header ticks and unticks the page', () => {
    render(<Subject />)
    expect(state(header())).toBe('none')

    fireEvent.click(rowTick(0))
    expect(state(header())).toBe('some')

    fireEvent.click(header())
    expect(state(header())).toBe('all')
    expect(state(rowTick(2))).toBe('all')

    fireEvent.click(header())
    expect(state(header())).toBe('none')
  })

  test('is a tab stop that Space toggles', () => {
    render(<Subject />)
    const box = header()
    box.focus()
    expect(document.activeElement).toBe(box)
    fireEvent.keyDown(box, { key: ' ' })
    fireEvent.keyUp(box, { key: ' ' })
    expect(state(header())).toBe('all')
  })
})

describe('tick column', () => {
  test('the tick cells are `tick`, so a c.select editor cell stays `select`', () => {
    const { container } = render(<Subject />)
    expect(container.querySelectorAll('tbody td[data-kind="tick"]')).toHaveLength(3)
    expect(container.querySelectorAll('th[data-kind="tick"]')).toHaveLength(1)
    expect(container.querySelectorAll('tbody td[data-kind="select"]')).toHaveLength(3)
  })

  test('a tick never activates the row', () => {
    const { container } = render(<Subject />)
    fireEvent.click(rowTick(1))
    expect(container.querySelector('tbody tr[data-selected]')).not.toBeNull()
    expect(container.querySelectorAll('tbody tr[data-selected]')).toHaveLength(1)
  })
})
