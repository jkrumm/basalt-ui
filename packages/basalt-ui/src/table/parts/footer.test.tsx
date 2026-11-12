/**
 * The footer (docs/v3/issues/g3/v3-table-t4-virtual.json): client mode reduces every row that
 * matches the request, never only the page; server mode prints `totals` and is absent without them.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { Mode, StateHandle, TableState, UseDataTable } from '../contract'
import type { Aggregate } from '../core/kinds-spec'
import { col } from '../core/kinds'
import { specOf } from '../core/kinds-spec'
import { DataTable } from './data-table'
import { aggregate, footerValue } from './footer-model'
import { useDataTable } from '../use-data-table'

type Row = { id: string; name: string; team: string; amount: number | null }

const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', team: 'Eng', amount: 10 },
  { id: 'b', name: 'Beta', team: 'Ops', amount: 20 },
  { id: 'c', name: 'Gamma', team: 'Eng', amount: 30 },
  { id: 'd', name: 'Delta', team: 'Eng', amount: null },
  { id: 'e', name: 'Epsilon', team: 'Ops', amount: 5 },
]

const STATE: TableState = {
  v: 1,
  request: { q: '', filters: [], sort: [], page: 1, pageSize: 25 },
  display: { visibility: {} },
}

function handleOf(initial: TableState): StateHandle<TableState> {
  return {
    use() {
      return useState(initial)
    },
  }
}

function Subject({
  mode = { kind: 'client' },
  fn = 'sum',
  state = STATE,
  options = {},
}: {
  mode?: Mode
  fn?: Aggregate
  state?: TableState
  options?: Partial<UseDataTable<Row>>
}): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'f',
    label: 'Spend',
    columns: [
      c.entity('name'),
      c.status('team', { options: ['Eng', 'Ops'], filter: 'multi' }),
      c.money('amount', { currency: 'EUR', footer: fn }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode,
    state: handleOf(state),
    ...options,
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const footerText = (container: HTMLElement): string =>
  container.querySelector('[data-slot="table-footer"] [data-kind="money"]')?.textContent ?? ''

afterEach(cleanup)

describe('aggregate', () => {
  const values = [10, null, 30, undefined, 'x', 5]
  const read = (v: unknown): unknown => v
  test.each([
    ['sum', 45],
    ['mean', 15],
    ['min', 5],
    ['max', 30],
    ['count', 3],
  ] as const)('%s skips absent values', (fn, expected) => {
    expect(aggregate(fn, values, read)).toBe(expected)
  })

  test('nothing to reduce is absent, except a count of zero', () => {
    expect(aggregate('sum', [null], read)).toBeNull()
    expect(aggregate('count', [null], read)).toBe(0)
  })
})

describe('DataTableFooter', () => {
  test('client: the sum equals the filtered rows, not every row', () => {
    const filtered: TableState = {
      ...STATE,
      request: { ...STATE.request, filters: [{ id: 'team', op: 'anyOf', values: ['Eng'] }] },
    }
    const { container } = render(<Subject state={filtered} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
    // Eng: 10 + 30 + absent = 40; every row would be 65.
    expect(footerText(container)).toContain('40.00')
    expect(footerText(container)).not.toContain('65')
    expect(footerText(container)).toContain('Sum')
  })

  test('client: a page sum is not the footer, every matching row is', () => {
    const paged: TableState = { ...STATE, request: { ...STATE.request, pageSize: 2 } }
    const { container } = render(<Subject state={paged} options={{ pager: 'pages' }} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(footerText(container)).toContain('65.00')
  })

  test('server without totals renders no footer cell', () => {
    const { container } = render(<Subject mode={{ kind: 'server', rowCount: 5 }} />)
    expect(container.querySelector('tfoot')).toBeNull()
    expect(container.querySelector('[data-slot="table-footer"]')).toBeNull()
  })

  test('server prints the totals it was given', () => {
    const { container } = render(
      <Subject mode={{ kind: 'server', rowCount: 500, totals: { amount: 12_345 } }} />,
    )
    expect(footerText(container)).toContain('12,345.00')
  })

  test('the row is named once and each value is a dl item', () => {
    const { container } = render(<Subject fn="mean" />)
    const foot = container.querySelector('[data-slot="table-footer"]')
    expect(foot?.textContent).toContain('Summary')
    expect(foot?.querySelectorAll('dl')).toHaveLength(1)
    expect(foot?.querySelector('dt')?.textContent).toContain('Average')
    // (10 + 20 + 30 + 5) / 4 rows that have a value.
    expect(foot?.querySelector('dd')?.textContent).toContain('16.25')
  })

  test('count prints a plain number, not money', () => {
    const { container } = render(<Subject fn="count" />)
    expect(container.querySelector('[data-slot="table-footer"] dd')?.textContent).toBe('4')
  })

  test('no footer column, no footer', () => {
    function Plain(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'p',
        label: 'Plain',
        columns: [c.entity('name'), c.money('amount', { currency: 'EUR' })],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
      })
      return <DataTable table={t} />
    }
    const { container } = render(<Plain />)
    expect(container.querySelector('tfoot')).toBeNull()
  })

  test('footerValue reads a server value by column id', () => {
    const c = col<Row>()
    const column = c.money('amount', { currency: 'EUR', footer: 'sum' })
    const spec = specOf(column)
    expect(footerValue(spec, { kind: 'server', totals: { amount: 'n/a' } })).toEqual({
      kind: 'text',
      value: 'n/a',
    })
    expect(footerValue(spec, { kind: 'server', totals: undefined })).toBeNull()
  })

  test('a footer on a kind that takes none throws naming the column', () => {
    const c = col<Row>()
    expect(() => c.entity('name', { footer: 'sum' } as never)).toThrow(/c\.entity\('name'\)/)
  })
})
