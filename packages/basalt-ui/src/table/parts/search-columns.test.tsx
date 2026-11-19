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

  test('a money change is found as its cell writes it', () => {
    type Change = { id: string; change: number }
    const d = col<Change>()
    let model2: TableModel<Change> | undefined
    function Changes(): ReactElement {
      const t = useDataTable<Change>({
        id: 'changes',
        label: 'Changes',
        columns: [d.delta('change', { polarity: 'up-good', currency: 'EUR' })],
        data: [
          { id: 'x', change: 50 },
          { id: 'y', change: -7 },
        ],
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
      })
      const built = modelOf(t)
      useEffect(() => {
        model2 = built
      })
      return <DataTable table={t} />
    }
    render(<Changes />)
    act(() => model2?.state.setRequest({ q: '+€50.00' }))
    expect(model2?.rows.map((r) => r.id)).toEqual(['x'])
  })

  test('an invalid date is skipped by search, never thrown', () => {
    type Due = { id: string; due: Date }
    const d = col<Due>()
    let model3: TableModel<Due> | undefined
    function Dues(): ReactElement {
      const t = useDataTable<Due>({
        id: 'dues',
        label: 'Dues',
        columns: [d.date('due', { header: 'Due' })],
        data: [
          { id: 'ok', due: new Date('2026-11-15T12:00:00Z') },
          { id: 'bad', due: new Date('not a date') },
        ],
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
      })
      const built = modelOf(t)
      useEffect(() => {
        model3 = built
      })
      return <DataTable table={t} />
    }
    render(<Dues />)
    act(() => model3?.state.setRequest({ q: '2026-11-15' }))
    expect(model3?.rows.map((r) => r.id)).toEqual(['ok'])
  })

  test('a server table keeps every row it was sent and carries the phrase as q', () => {
    render(<Subject server />)
    expect(searchFor('legal')).toEqual(['a', 'b', 'c'])
    expect(model().state.request.q).toBe('legal')
  })
})
