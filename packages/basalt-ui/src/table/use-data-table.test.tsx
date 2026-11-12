/**
 * `useDataTable` through `DataTable`: sort cycle, natural order, client filter and paging, the
 * selection (one writer, cleared by `resetOn`), the empty arms and the activation contract.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import { col } from './core/kinds'
import { useMemoryHandle } from './core/state'
import { DataTable } from './parts/data-table'
import { modelOf, useDataTable } from './use-data-table'
import type { UseDataTable } from './contract'

afterEach(cleanup)

type Row = { id: string; name: string; amount: number | null; state: string }

const ROWS: Row[] = [
  { id: 'a', name: 'Project 10', amount: 12, state: 'Engineering' },
  { id: 'b', name: 'Project 2', amount: null, state: 'Eng' },
  { id: 'c', name: 'Project 1', amount: 7, state: 'Engineering' },
]

type Options = Partial<UseDataTable<Row>>

function Subject({ options = {} }: { options?: Options }): ReactElement {
  const c = col<Row>()
  const handle = useMemoryHandle()
  const t = useDataTable<Row>({
    id: 'use-data-table-test',
    label: 'Rows',
    columns: [
      c.text('name', { header: 'Name', filter: 'text' }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.status('state', { options: ['Engineering', 'Eng'], filter: 'multi', header: 'State' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    state: handle,
    ...options,
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const names = (): (string | null)[] =>
  [...document.querySelectorAll('tbody tr')].map(
    (tr) => tr.querySelector('td')?.textContent ?? null,
  )

const sortButton = (name: string): HTMLElement => screen.getByRole('button', { name })

describe('sort', () => {
  test('cycles none, ascending, descending, none and reflects it in aria-sort', () => {
    render(<Subject />)
    const header = () => screen.getByRole('columnheader', { name: 'Name' })
    expect(header().getAttribute('aria-sort')).toBe('none')
    fireEvent.click(sortButton('Name'))
    expect(header().getAttribute('aria-sort')).toBe('ascending')
    expect(names()).toEqual(['Project 1', 'Project 2', 'Project 10'])
    fireEvent.click(sortButton('Name'))
    expect(header().getAttribute('aria-sort')).toBe('descending')
    expect(names()).toEqual(['Project 10', 'Project 2', 'Project 1'])
    fireEvent.click(sortButton('Name'))
    expect(header().getAttribute('aria-sort')).toBe('none')
    expect(names()).toEqual(['Project 10', 'Project 2', 'Project 1'])
  })

  test('an absent amount sorts last both ways and renders a dash, not 0', () => {
    render(<Subject />)
    fireEvent.click(sortButton('Amount (EUR)'))
    expect(names().at(-1)).toBe('Project 2')
    fireEvent.click(sortButton('Amount (EUR)'))
    expect(names().at(-1)).toBe('Project 2')
    expect(document.querySelector('[data-slot="table-absent"]')).not.toBeNull()
  })
})

describe('client filter and paging', () => {
  const state = (patch: object) => ({
    use: () =>
      [
        {
          v: 1,
          request: { q: '', filters: [], sort: [], page: 1, pageSize: 25, ...patch },
          display: { visibility: {} },
        },
        () => undefined,
      ] as never,
  })

  test('an anyOf filter is an exact match: Eng does not match Engineering (I17)', () => {
    render(
      <Subject
        options={{
          state: state({ filters: [{ id: 'state', op: 'anyOf', values: ['Eng'] }] }),
        }}
      />,
    )
    expect(names()).toEqual(['Project 2'])
  })

  test('the search phrase filters text columns; no match shows the filtered empty arm', () => {
    render(<Subject options={{ state: state({ q: 'zzz' }) }} />)
    expect(document.querySelector('[data-slot="table-empty"]')?.textContent).toContain(
      'No rows match',
    )
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
    expect(document.querySelector('[data-slot="table-root"]')?.getAttribute('data-phase')).toBe(
      'empty',
    )
  })

  test('pager pages slices the client rows', () => {
    render(<Subject options={{ pager: 'pages', state: state({ pageSize: 2 }) }} />)
    expect(names()).toHaveLength(2)
  })

  test('a filter on an unknown column id throws in development, naming it', () => {
    const quiet = mock(() => undefined)
    const original = console.error
    console.error = quiet
    try {
      expect(() =>
        render(
          <Subject
            options={{ state: state({ filters: [{ id: 'nope', op: 'contains', values: ['x'] }] }) }}
          />,
        ),
      ).toThrow(/nope/)
    } finally {
      console.error = original
    }
  })
})

describe('selection', () => {
  const ticks = () => [
    ...document.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'),
  ]

  test('ticks follow the row id across a re-sort (I4)', () => {
    render(<Subject options={{ selection: { bulk: [] } }} />)
    fireEvent.click(ticks()[0]!)
    expect(
      document.querySelector('tbody tr[data-selected]')?.querySelector('td + td')?.textContent,
    ).toBe('Project 10')
    fireEvent.click(sortButton('Name'))
    expect(
      document.querySelector('tbody tr[data-selected]')?.querySelector('td + td')?.textContent,
    ).toBe('Project 10')
  })

  test('the header tick selects and clears the page', () => {
    render(<Subject options={{ selection: { bulk: [] } }} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }))
    expect(document.querySelectorAll('tbody tr[data-selected]')).toHaveLength(3)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }))
    expect(document.querySelectorAll('tbody tr[data-selected]')).toHaveLength(0)
  })

  test('a resetOn change clears the selection', () => {
    const { rerender } = render(<Subject options={{ selection: { bulk: [] }, resetOn: ['x'] }} />)
    fireEvent.click(ticks()[0]!)
    expect(document.querySelectorAll('tbody tr[data-selected]')).toHaveLength(1)
    rerender(<Subject options={{ selection: { bulk: [] }, resetOn: ['y'] }} />)
    expect(document.querySelectorAll('tbody tr[data-selected]')).toHaveLength(0)
  })
})

describe('activation and keyboard', () => {
  test('Enter on a row activates it; Space never does (I10)', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    render(<Subject options={{ onRowActivate }} />)
    const row = document.querySelector('tbody tr') as HTMLElement
    expect(row.tabIndex).toBe(0)
    fireEvent.keyDown(row, { key: ' ' })
    expect(onRowActivate).not.toHaveBeenCalled()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[0])
  })

  test('detail shows its entry in the host', () => {
    const show = mock((_entry: unknown) => undefined)
    function WithHost(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'detail-test',
        label: 'Rows',
        columns: [c.text('name')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        detail: (row) => <span>{row.name}</span>,
      })
      return <DataTable table={t} detail={{ isOpen: false, show, hide: () => undefined }} />
    }
    render(<WithHost />)
    fireEvent.click(document.querySelector('tbody tr') as HTMLElement)
    expect(show).toHaveBeenCalledTimes(1)
  })

  test('a table with neither activation nor selection has no row tab stops', () => {
    render(<Subject />)
    expect(document.querySelector('tbody tr[tabindex]')).toBeNull()
  })
})

describe('the instance', () => {
  test('a value not made by useDataTable is refused with a clear error', () => {
    expect(() => modelOf({ __brand: 'DataTableInstance' })).toThrow(/useDataTable/)
  })

  test('a column the display state hides leaves the head and the cells', () => {
    act(() => {
      localStorage.setItem(
        'basalt:table:hidden-test',
        JSON.stringify({ v: 1, value: { visibility: { state: false } } }),
      )
    })
    render(<Subject options={{ id: 'hidden-test' }} />)
    expect(screen.queryByRole('columnheader', { name: 'State' })).toBeNull()
    localStorage.clear()
  })
})
