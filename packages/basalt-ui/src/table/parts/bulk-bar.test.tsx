/**
 * `BulkBar` (docs/v3/issues/g3/v3-table-t3b-selection.json): it exists only while a row is ticked,
 * shows the count, runs a declared action with the selected rows and the selection, and offers
 * "select all matching" only when `selectAll` is on and the table holds more rows than the page.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { BulkAction, UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { DataTable } from './data-table'
import { useDataTable } from '../use-data-table'

afterEach(cleanup)

type Row = { id: string; payee: string }

const ROWS: Row[] = [
  { id: 'a', payee: 'Rent' },
  { id: 'b', payee: 'Bakery' },
  { id: 'c', payee: 'Gym' },
]

function Subject({
  bulk,
  selectAll,
  mode,
}: {
  bulk: BulkAction<Row>[]
  selectAll?: boolean
  mode?: UseDataTable<Row>['mode']
}): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'b',
    label: 'Bookings',
    columns: [c.entity('payee')],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: mode ?? { kind: 'client' },
    selection: { bulk, ...(selectAll !== undefined && { selectAll }) },
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const bar = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-slot="table-bulk"]')
const tick = (index: number): HTMLElement =>
  screen.getAllByRole('checkbox', { name: 'Select row' })[index] as HTMLElement

describe('BulkBar', () => {
  test('selecting rows shows the count and the bulk actions; clearing hides it', () => {
    render(<Subject bulk={[{ key: 'x', label: 'Archive', onClick: mock(() => undefined) }]} />)
    expect(bar()).toBeNull()

    fireEvent.click(tick(0))
    fireEvent.click(tick(2))
    const found = bar() as HTMLElement
    expect(within(found).getByRole('status').textContent).toBe('2 selected')
    expect(within(found).getByRole('button', { name: 'Archive' })).toBeTruthy()

    fireEvent.click(within(found).getByRole('button', { name: 'Clear selection' }))
    expect(bar()).toBeNull()
  })

  test('an action receives the selected rows and the selection', () => {
    const onClick = mock((_rows: readonly Row[], _selection: unknown) => undefined)
    render(<Subject bulk={[{ key: 'x', label: 'Archive', onClick }]} />)
    fireEvent.click(tick(1))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    const [rows, selection] = onClick.mock.calls[0] ?? []
    expect(rows as readonly Row[]).toEqual([ROWS[1] as Row])
    expect(selection).toEqual({ kind: 'ids', ids: ['b'] })
  })

  test('unticking the last row removes the bar', () => {
    render(<Subject bulk={[]} />)
    fireEvent.click(tick(0))
    expect(bar()).not.toBeNull()
    fireEvent.click(tick(0))
    expect(bar()).toBeNull()
  })

  test('no all-matching offer without selectAll, or when the page is every row', () => {
    render(<Subject bulk={[]} selectAll />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }))
    expect(screen.queryByRole('button', { name: /Select all \d+ rows/ })).toBeNull()
  })

  test('selectAll on a server table offers every matching row and then reads all selected', () => {
    const onClick = mock((_rows: readonly Row[], _selection: unknown) => undefined)
    render(
      <Subject
        bulk={[{ key: 'x', label: 'Archive', onClick }]}
        selectAll
        mode={{ kind: 'server', rowCount: 120 }}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }))
    expect(within(bar() as HTMLElement).getByRole('status').textContent).toBe('3 selected')
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Select all 120 rows' }))
    })
    expect(within(bar() as HTMLElement).getByRole('status').textContent).toBe(
      'All 120 rows selected',
    )
    expect(screen.queryByRole('button', { name: /Select all \d+ rows/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const selection = onClick.mock.calls[0]?.[1] as { kind: string; count: number }
    expect(selection.kind).toBe('all-matching')
    expect(selection.count).toBe(120)
  })
})
