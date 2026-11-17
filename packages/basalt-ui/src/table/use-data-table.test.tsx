/**
 * `useDataTable` through `DataTable`: sort cycle, natural order, client filter and paging, the
 * selection (one writer, cleared by `resetOn`), the empty arms and the activation contract.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ControlHandle } from '../core/ports'
import { Page } from '../page/page'
import { PageAside } from '../page/page-aside'
import { installLayoutDoubles, restoreLayoutDoubles, setWidth } from '../page/page.test-support'
import { col } from './core/kinds'
import { useMemoryHandle } from './core/state'
import { DataTable } from './parts/data-table'
import { modelOf, useDataTable } from './use-data-table'
import type { UseDataTable } from './contract'

beforeEach(installLayoutDoubles)
afterEach(() => {
  cleanup()
  restoreLayoutDoubles()
})

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
      c.status('state', {
        options: ['Engineering', 'Eng'],
        filter: 'multi',
        header: 'State',
      }),
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
          request: {
            q: '',
            filters: [],
            sort: [],
            page: 1,
            pageSize: 25,
            ...patch,
          },
          display: { visibility: {} },
        },
        () => undefined,
      ] as never,
  })

  test('an anyOf filter is an exact match: Eng does not match Engineering (I17)', () => {
    render(
      <Subject
        options={{
          state: state({
            filters: [{ id: 'state', op: 'anyOf', values: ['Eng'] }],
          }),
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

  test('`empty` names why an empty table is empty and offers its action', () => {
    const run = mock(() => undefined)
    render(
      <Subject
        options={{
          data: [],
          empty: {
            cause: 'No orders this week.',
            action: { label: 'New order', onClick: run },
          },
        }}
      />,
    )
    const row = document.querySelector('[data-slot="table-empty"]')
    expect(row?.textContent).toContain('No orders this week.')
    fireEvent.click(screen.getByRole('button', { name: 'New order' }))
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('an `empty` action with an href renders a link', () => {
    render(
      <Subject
        options={{
          data: [],
          empty: {
            cause: 'No orders this week.',
            action: { label: 'All orders', href: '/orders' },
          },
        }}
      />,
    )
    expect(screen.getByRole('link', { name: 'All orders' }).getAttribute('href')).toBe('/orders')
  })

  test('a filtered-empty table keeps the no-matches sentence and Clear filters over `empty`', () => {
    render(
      <Subject
        options={{
          state: state({ q: 'zzz' }),
          empty: {
            cause: 'No orders this week.',
            action: { label: 'New order', onClick: () => {} },
          },
        }}
      />,
    )
    const row = document.querySelector('[data-slot="table-empty"]')
    expect(row?.textContent).toContain('No rows match')
    expect(row?.textContent).not.toContain('No orders this week.')
    expect(screen.queryByRole('button', { name: 'New order' })).toBeNull()
  })

  test('a page-filtered empty says so and Clear filters calls its reset', () => {
    const reset = mock(() => undefined)
    render(
      <Subject
        options={{
          data: [],
          empty: {
            cause: 'Nothing matches these filters.',
            action: { label: 'New order', onClick: () => {} },
            filtered: { reset },
          },
        }}
      />,
    )
    const row = document.querySelector('[data-slot="table-empty"]')
    expect(row?.textContent).toContain('Nothing matches these filters.')
    expect(screen.queryByRole('button', { name: 'New order' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  test('with no `empty` the default line does not claim the data is new', () => {
    render(<Subject options={{ data: [] }} />)
    const text = document.querySelector('[data-slot="table-empty"]')?.textContent
    expect(text).toContain('No rows to show')
    expect(text).not.toContain('yet')
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
            options={{
              state: state({
                filters: [{ id: 'nope', op: 'contains', values: ['x'] }],
              }),
            }}
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

  test('activeRowId marks the page-owned open row selected and current, and no other', () => {
    render(<Subject options={{ onRowActivate: () => undefined, activeRowId: 'b' }} />)
    const rows = [...document.querySelectorAll('tbody tr')]
    expect(rows.map((tr) => tr.hasAttribute('data-selected'))).toEqual([false, true, false])
    expect(rows.map((tr) => tr.getAttribute('aria-current'))).toEqual([null, 'true', null])
  })

  test('with detail the opened row is marked until its sheet closes', () => {
    function Detail(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'detail-active-test',
        label: 'Rows',
        columns: [c.text('name')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        detail: (row) => <span>{row.name} body</span>,
      })
      return <DataTable table={t} />
    }
    render(<Detail />)
    expect(document.querySelector('tbody tr[aria-current]')).toBeNull()
    fireEvent.click(document.querySelectorAll('tbody tr')[2] as HTMLElement)
    const open = document.querySelector('tbody tr[aria-current="true"]')
    expect(open?.textContent).toContain('Project 1')
    expect(open?.hasAttribute('data-selected')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.querySelector('tbody tr[aria-current]')).toBeNull()
  })

  test('a Page aside that closes on its own unmarks the row it showed', () => {
    setWidth(1440)
    function InPage(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'detail-aside-active-test',
        label: 'Rows',
        columns: [c.text('name')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        detail: (row) => <span>{row.name} body</span>,
      })
      return (
        <Page>
          <DataTable table={t} />
          <PageAside title="Inspector">own</PageAside>
        </Page>
      )
    }
    render(<InPage />)
    fireEvent.click(document.querySelectorAll('tbody tr')[1] as HTMLElement)
    expect(document.querySelector('tbody tr[aria-current="true"]')?.textContent).toContain(
      'Project 2',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(document.querySelector('tbody tr[aria-current]')).toBeNull()
  })

  test('activeRowId marks the row with no onRowActivate too', () => {
    render(<Subject options={{ activeRowId: 'c' }} />)
    expect(document.querySelectorAll('tbody tr[aria-current="true"]')).toHaveLength(1)
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

  test('detail opens in the enclosing Page aside with no host passed, titled by detailTitle', () => {
    setWidth(1440)
    function InPage(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'detail-page-test',
        label: 'Rows',
        columns: [c.text('name')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        detail: (row) => <span data-testid="body">{row.name} body</span>,
        detailTitle: (row) => `Row ${row.id}`,
      })
      return (
        <Page>
          <DataTable table={t} />
          <PageAside title="Inspector">own</PageAside>
        </Page>
      )
    }
    render(<InPage />)
    fireEvent.click(document.querySelectorAll('tbody tr')[1] as HTMLElement)
    const aside = screen.getByLabelText('Row b')
    expect(aside.getAttribute('data-slot')).toBe('page-aside')
    expect(aside.textContent).toContain('Project 2 body')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('without detailTitle the entry is titled by the table label; outside a Page it is a sheet', () => {
    function Bare(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'detail-sheet-test',
        label: 'Rows',
        columns: [c.text('name')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        detail: (row) => <span>{row.name} body</span>,
      })
      return <DataTable table={t} />
    }
    render(<Bare />)
    fireEvent.click(document.querySelector('tbody tr') as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'Rows' }).textContent).toContain('Project 10 body')
  })

  test('a table with neither activation nor selection still has a row to activate: the auto sheet', () => {
    render(<Subject />)
    expect(document.querySelector('tbody tr[tabindex]')).not.toBeNull()
  })
})

describe('the instance', () => {
  test('a value not made by useDataTable is refused with a clear error', () => {
    expect(() => modelOf({ __brand: 'DataTableInstance' } as never)).toThrow(/useDataTable/)
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

/** A string field kept outside React, as the URL keeps it: `set` is a navigation, `clear` unsets. */
function urlField(
  initial: string,
): ControlHandle<string> & { set(v: string): void; value(): string } {
  let value = initial
  const listeners = new Set<() => void>()
  const set = (next: string): void => {
    value = next
    for (const listener of listeners) listener()
  }
  return {
    key: 'row',
    kind: 'string',
    isDefault: true,
    use: () => [
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        () => value,
        () => value,
      ),
      set,
    ],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => set(''),
    set,
    value: () => value,
  }
}

/** The sheet leaves the DOM after its exit animation; closed means gone or no longer open. */
const closed = (): boolean => {
  const dialog = screen.queryByRole('dialog')
  return (
    dialog === null ||
    dialog.hasAttribute('data-closed') ||
    dialog.hasAttribute('data-ending-style')
  )
}

describe('detail bound to a field', () => {
  function Bound({
    field,
    phase,
    byId,
    extra,
  }: {
    field: ControlHandle<string>
    phase?: 'loading'
    byId?: (id: string) => ReactElement
    extra?: object
  }): ReactElement {
    const c = col<Row>()
    const t = useDataTable<Row>({
      id: 'detail-state-test',
      label: 'Rows',
      columns: [c.text('name', { filter: 'text' })],
      data: ROWS,
      getRowId: (r) => r.id,
      mode: { kind: 'client' },
      ...(phase !== undefined && { phase }),
      detail: (row) => <span>{row.name} body</span>,
      detailState: field,
      ...(byId !== undefined && { detailById: (id: string) => byId(id) }),
      ...extra,
    })
    return <DataTable table={t} />
  }

  test('a field that names a row opens its detail on load', () => {
    render(<Bound field={urlField('b')} />)
    expect(screen.getByRole('dialog', { name: 'Rows' }).textContent).toContain('Project 2 body')
  })

  test('a field that names no row opens nothing and is cleared with a dev warning', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const field = urlField('zzz')
    render(<Bound field={field} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(field.value()).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('detail-state-test')
    expect(String(warn.mock.calls[0]?.[0])).toContain('zzz')
    warn.mockRestore()
  })

  test('a field naming an unloaded id waits for the query, then clears', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const field = urlField('zzz')
    const { rerender } = render(<Bound field={field} phase="loading" />)
    expect(field.value()).toBe('zzz')
    expect(warn).not.toHaveBeenCalled()
    rerender(<Bound field={field} />)
    expect(field.value()).toBe('')
    warn.mockRestore()
  })

  test('activating a row writes its id, closing the sheet clears the field', async () => {
    const field = urlField('')
    render(<Bound field={field} />)
    fireEvent.click(document.querySelectorAll('tbody tr')[2] as HTMLElement)
    expect(field.value()).toBe('c')
    expect(screen.getByRole('dialog').textContent).toContain('Project 1 body')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(field.value()).toBe('')
    await waitFor(() => expect(closed()).toBe(true))
  })

  test('a close clears on the field lane; a name no row has is cleared as a replace', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const calls: (object | undefined)[] = []
    const base = urlField('')
    const field = { ...base, clear: (o?: object) => (calls.push(o), base.set('')) }
    render(<Bound field={field} />)
    fireEvent.click(document.querySelectorAll('tbody tr')[1] as HTMLElement)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(calls).toEqual([undefined])
    await waitFor(() => expect(closed()).toBe(true))
    cleanup()
    calls.length = 0
    const stale = { ...urlField('zzz'), clear: (o?: object) => void calls.push(o) }
    render(<Bound field={stale} />)
    expect(calls).toEqual([{ replace: true }])
    warn.mockRestore()
  })

  test('a Page aside that closes on its own clears the field and unmarks the row', () => {
    setWidth(1440)
    const field = urlField('')
    function InPage(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'detail-state-aside-test',
        label: 'Rows',
        columns: [c.text('name')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        detail: (row) => <span>{row.name} body</span>,
        detailState: field,
      })
      return (
        <Page>
          <DataTable table={t} />
          <PageAside title="Inspector">own</PageAside>
        </Page>
      )
    }
    render(<InPage />)
    fireEvent.click(document.querySelectorAll('tbody tr')[1] as HTMLElement)
    expect(field.value()).toBe('b')
    expect(document.querySelector('tbody tr[aria-current="true"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(field.value()).toBe('')
    expect(document.querySelector('tbody tr[aria-current]')).toBeNull()
  })

  describe.each([{ bound: false }, { bound: true }])(
    'a deep link into a Page aside (aside state bound: $bound)',
    ({ bound }) => {
      function DeepLinked({ field }: { field: ControlHandle<string> }): ReactElement {
        const c = col<Row>()
        const t = useDataTable<Row>({
          id: 'detail-state-deep-link-test',
          label: 'Rows',
          columns: [c.text('name')],
          data: ROWS,
          getRowId: (r) => r.id,
          mode: { kind: 'client' },
          detail: (row) => <span>{row.name} body</span>,
          detailState: field,
        })
        return (
          <Page>
            <DataTable table={t} />
            <PageAside title="Inspector" {...(bound && { state: field })}>
              own
            </PageAside>
          </Page>
        )
      }

      test('keeps its id and marks its row until the user closes it', async () => {
        setWidth(1440)
        const field = urlField('b')
        render(<DeepLinked field={field} />)
        await act(async () => new Promise((r) => setTimeout(r, 50)))
        expect(field.value()).toBe('b')
        expect(screen.getByRole('complementary', { name: /./ }).textContent).toContain(
          'Project 2 body',
        )
        expect(document.querySelectorAll('tbody tr[aria-current="true"]')).toHaveLength(1)
        fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
        expect(field.value()).toBe('')
        expect(document.querySelector('tbody tr[aria-current]')).toBeNull()
      })
    },
  )

  test('the field going unset (Back) closes the sheet', async () => {
    const field = urlField('a')
    render(<Bound field={field} />)
    expect(screen.getByRole('dialog')).not.toBeNull()
    act(() => field.set(''))
    await waitFor(() => expect(closed()).toBe(true))
  })

  test('a render before the field clears does not reopen the closed sheet', async () => {
    const field = { ...urlField('a'), clear: () => undefined }
    const { rerender } = render(<Bound field={field} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(closed()).toBe(true))
    rerender(<Bound field={field} />)
    expect(closed()).toBe(true)
    fireEvent.click(document.querySelectorAll('tbody tr')[0] as HTMLElement)
    expect(closed()).toBe(false)
  })

  test('the field changing to another row swaps the detail', () => {
    const field = urlField('a')
    render(<Bound field={field} />)
    act(() => field.set('c'))
    expect(screen.getByRole('dialog').textContent).toContain('Project 1 body')
  })

  const filtered = (q: string): object => ({
    state: {
      use: () =>
        [
          {
            v: 1,
            request: { q, filters: [], sort: [], page: 1, pageSize: 1 },
            display: { visibility: {} },
          },
          () => undefined,
        ] as never,
    },
    pager: 'pages',
  })

  test('a row on another page of a client table still opens its detail', () => {
    render(<Bound field={urlField('c')} extra={filtered('')} />)
    expect(names()).toEqual(['Project 10'])
    expect(screen.getByRole('dialog').textContent).toContain('Project 1 body')
  })

  test('a row the client filter excludes opens detailById, else clears', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    render(
      <Bound
        field={urlField('c')}
        byId={(id) => <span>fetched {id}</span>}
        extra={filtered('Project 2')}
      />,
    )
    expect(screen.getByRole('dialog').textContent).toContain('fetched c')
    cleanup()
    const field = urlField('c')
    render(<Bound field={field} extra={filtered('Project 2')} />)
    expect(field.value()).toBe('')
    warn.mockRestore()
  })

  describe('detailById', () => {
    const byId = (id: string): ReactElement => <span>fetched {id}</span>

    test('opens a record no loaded row has, once the query settled', () => {
      const field = urlField('zzz')
      const { rerender } = render(<Bound field={field} byId={byId} phase="loading" />)
      expect(screen.queryByRole('dialog')).toBeNull()
      rerender(<Bound field={field} byId={byId} />)
      const dialog = screen.getByRole('dialog', { name: 'Rows' })
      expect(dialog.textContent).toContain('fetched zzz')
      expect(field.value()).toBe('zzz')
    })

    test('closing it clears the field', async () => {
      const field = urlField('zzz')
      render(<Bound field={field} byId={byId} />)
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(field.value()).toBe('')
      await waitFor(() => expect(closed()).toBe(true))
    })

    test('a loaded row still opens through detail, from the field and on click', () => {
      const field = urlField('b')
      render(<Bound field={field} byId={byId} />)
      expect(screen.getByRole('dialog').textContent).toContain('Project 2 body')
      act(() => field.set('zzz'))
      expect(screen.getByRole('dialog').textContent).toContain('fetched zzz')
      act(() => field.set(''))
      fireEvent.click(document.querySelectorAll('tbody tr')[2] as HTMLElement)
      expect(field.value()).toBe('c')
      expect(screen.getByRole('dialog').textContent).toContain('Project 1 body')
    })

    test('a record opened by id carries the title detailTitleById gives it, a row the one detailTitle gives', () => {
      const field = urlField('zzz')
      const title = (id: string): string => `Edit ${id}`
      render(
        <Bound
          field={field}
          byId={byId}
          extra={{ detailTitle: (row: Row) => title(row.id), detailTitleById: title }}
        />,
      )
      expect(screen.getByRole('dialog', { name: 'Edit zzz' }).textContent).toContain('fetched zzz')
      act(() => field.set('b'))
      expect(screen.getByRole('dialog', { name: 'Edit b' }).textContent).toContain('Project 2 body')
    })

    test('without detail every activation opens through detailById, on the row id', () => {
      function ByIdOnly(): ReactElement {
        const c = col<Row>()
        const t = useDataTable<Row>({
          id: 'detail-by-id-only',
          label: 'Rows',
          columns: [c.text('name', { filter: 'text' })],
          data: ROWS,
          getRowId: (r) => r.id,
          mode: { kind: 'client' },
          detailTitle: (row) => `Edit ${row.id}`,
          detailById: byId,
        })
        return <DataTable table={t} />
      }
      render(<ByIdOnly />)
      fireEvent.click(document.querySelectorAll('tbody tr')[1] as HTMLElement)
      const dialog = screen.getByRole('dialog', { name: 'Edit b' })
      expect(dialog.textContent).toContain('fetched b')
    })
  })
})

/** An enum field with a fallback, as a page store's filter: `clear()` returns it to `all`. */
function filterField(key: string): ControlHandle<string> & { set(v: string): void } {
  let value = 'all'
  const listeners = new Set<() => void>()
  const set = (next: string): void => {
    value = next
    for (const listener of listeners) listener()
  }
  return {
    key,
    kind: 'enum',
    get isDefault() {
      return value === 'all'
    },
    use: () => [
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        () => value,
        () => value,
      ),
      set,
    ],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => set('all'),
    set,
  }
}

describe('page filters bound to the table', () => {
  const state = filterField('state')
  const name = filterField('name')
  function Bound(): ReactElement {
    return (
      <Subject
        options={
          {
            filters: [
              { field: state, match: (row: Row, value: string) => row.state === value },
              { field: name, match: (row: Row, value: string) => row.name === value },
            ],
          } as Options
        }
      />
    )
  }
  afterEach(() => {
    state.clear()
    name.clear()
  })

  test('rows narrow by every field off its default, with no page code', () => {
    render(<Bound />)
    expect(names()).toHaveLength(3)
    act(() => state.set('Eng'))
    expect(names()).toEqual(['Project 2'])
    act(() => state.set('Engineering'))
    expect(names()).toHaveLength(2)
    act(() => name.set('Project 1'))
    expect(names()).toEqual(['Project 1'])
  })

  test('no row left draws Clear filters, which clears exactly the bound fields', () => {
    render(<Bound />)
    act(() => {
      state.set('Eng')
      name.set('Project 1')
    })
    expect(document.querySelector('[data-slot="table-empty"]')?.textContent).toContain('No')
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(state.isDefault).toBe(true)
    expect(name.isDefault).toBe(true)
    expect(names()).toHaveLength(3)
  })
})

describe('the empty sentence of a table the page filtered', () => {
  const state = filterField('state')
  const name = filterField('name')
  const bound = (empty?: Options['empty']): ReactElement => (
    <Subject
      options={
        {
          filters: [
            { field: state, match: (row: Row, value: string) => row.state === value },
            { field: name, match: (row: Row, value: string) => row.name === value },
          ],
          ...(empty !== undefined && { empty }),
        } as Options
      }
    />
  )
  const sentence = (): string | null | undefined =>
    document.querySelector('[data-slot="table-empty"]')?.textContent
  afterEach(() => {
    state.clear()
    name.clear()
  })

  test('the page cause replaces the default and Clear filters stays', () => {
    render(bound({ cause: 'No Issue matches this filter.' }))
    act(() => state.set('Nope'))
    expect(sentence()).toContain('No Issue matches this filter.')
    expect(sentence()).not.toContain('No rows match')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  test('without a cause the default names filters only, there being no search', () => {
    render(bound())
    act(() => state.set('Nope'))
    expect(sentence()).toContain('No rows match the current filters')
    expect(sentence()).not.toContain('search')
  })

  test('a search phrase keeps the default that names the search, over the page cause', () => {
    render(
      <Subject
        options={
          {
            state: {
              use: () =>
                [
                  {
                    v: 1,
                    request: { q: 'zzz', filters: [], sort: [], page: 1, pageSize: 25 },
                    display: { visibility: {} },
                  },
                  () => undefined,
                ] as never,
            },
            filters: [{ field: state, match: (row: Row, value: string) => row.state === value }],
            empty: { cause: 'No Issue matches this filter.' },
          } as Options
        }
      />,
    )
    act(() => state.set('Eng'))
    expect(sentence()).toContain('No rows match the current search and filters')
  })
})
