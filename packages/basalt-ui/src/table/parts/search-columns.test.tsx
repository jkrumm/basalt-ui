/**
 * Search over every column (owner review 2, Issue 2418): in client mode the phrase matches what a
 * cell shows (a status label, a formatted amount, a date) and the stored value, in every column but
 * `spark` and `actions`; a server table receives it as `q` untouched.
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { col } from '../core/kinds'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { DataTable } from './data-table'

afterEach(cleanup)

type Row = { id: string; name: string; state: string; amount: number; due: string; paid: boolean }
const ROWS: Row[] = [
  { id: 'a', name: 'Acme', state: 'open', amount: 1250, due: '2026-10-02', paid: true },
  { id: 'b', name: 'Beta', state: 'done', amount: 80, due: '2026-11-15', paid: false },
  { id: 'c', name: 'Corvo', state: 'blocked', amount: 42.5, due: '2026-12-24', paid: true },
]

const c = col<Row>()
const COLUMNS = [
  c.entity('name', { header: 'Name' }),
  c.status('state', {
    header: 'State',
    options: ['open', 'done', 'blocked'],
    labels: { open: 'In review', done: 'Shipped', blocked: 'Waiting on legal' },
  }),
  c.money('amount', { header: 'Amount', currency: 'EUR' }),
  c.date('due', { header: 'Due' }),
  c.boolean('paid', { header: 'Paid' }),
]

let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject({ server = false }: { server?: boolean }): ReactElement {
  const t = useDataTable<Row>({
    id: 'search',
    label: 'Invoices',
    columns: COLUMNS,
    data: ROWS,
    getRowId: (r) => r.id,
    mode: server ? { kind: 'server', rowCount: ROWS.length } : { kind: 'client' },
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return <DataTable table={t} />
}

const shownIds = (): string[] => model().rows.map((r) => r.id)
const searchFor = (q: string): string[] => {
  act(() => model().state.setRequest({ q }))
  return shownIds()
}

describe('search reads every column', () => {
  test('a status label finds its row', () => {
    render(<Subject />)
    expect(searchFor('legal')).toEqual(['c'])
    expect(searchFor('shipped')).toEqual(['b'])
  })

  test('a number, as shown and as stored, finds its row', () => {
    render(<Subject />)
    expect(searchFor('1,250.00')).toEqual(['a'])
    expect(searchFor('42.5')).toEqual(['c'])
  })

  test('a date string, as shown and as stored, finds its row', () => {
    render(<Subject />)
    expect(searchFor('2026-11-15')).toEqual(['b'])
    expect(searchFor('Dec 24')).toEqual(['c'])
  })

  test('a boolean label finds its rows', () => {
    render(<Subject />)
    expect(searchFor('no')).toEqual(['b'])
  })

  test('a server table keeps every row it was sent and carries the phrase as q', () => {
    render(<Subject server />)
    expect(searchFor('legal')).toEqual(['a', 'b', 'c'])
    expect(model().state.request.q).toBe('legal')
  })
})
