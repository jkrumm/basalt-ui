/**
 * The table kit fixes of expression cycle 9 (`v3-expr-9-kit-fixes`, behaviour 6): a phone card
 * labels every value whose column has a header and names a headerless one by its column id, and a
 * card list clipped by `maxRows` says how many cards it shows. The geometry lives in
 * `tests/layout/table-states.layout.test.ts`.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Row = { id: string; name: string; total: number; state: string; owner: string; seen: string }
const ROWS: Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: `r${i}`,
  name: `eval-${i}`,
  total: i,
  state: 'Passed',
  owner: 'You',
  seen: '2026-11-01',
}))

const c = col<Row>()

function Subject({ maxRows }: { maxRows?: number }): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr9',
    label: 'Cases',
    columns: [
      c.entity('name', { header: 'Case' }),
      c.number('total', { header: 'Total', card: 'value' }),
      c.status('state', { header: '', options: ['Passed'], card: 'badge' }),
      c.text('owner', { header: '', card: 'meta' }),
      c.date('seen', { header: 'Last seen', card: 'subtitle' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} {...(maxRows !== undefined && { height: { maxRows } })} />
}

describe('phone card labels', () => {
  test('every value but the title carries its header, a headerless one its column id', () => {
    const { container } = render(<Subject />)
    const cells = [...container.querySelectorAll('tbody tr:first-child [data-slot="table-cell"]')]
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([
      null,
      'Total',
      'state',
      'owner',
      'Last seen',
    ])
  })
})

describe('a card list clipped by maxRows', () => {
  test('says how many of the rows show', () => {
    const { container } = render(<Subject maxRows={3} />)
    expect(container.querySelector('[data-slot="table-rows-shown"]')?.textContent).toBe(
      '3 of 5 shown',
    )
  })

  test('says nothing when every row fits, or when no height clips', () => {
    const fits = render(<Subject maxRows={5} />)
    expect(fits.container.querySelector('[data-slot="table-rows-shown"]')).toBeNull()
    cleanup()
    const open = render(<Subject />)
    expect(open.container.querySelector('[data-slot="table-rows-shown"]')).toBeNull()
  })
})
