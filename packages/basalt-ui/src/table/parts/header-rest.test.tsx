/**
 * Owner review 2 (Issue 2418): a header is one button at rest, its kind icon and its label; a sorted
 * or filtered column adds one mark each, named for assistive tech, and the button's menu opens the
 * column's editor; a column carries a header icon and a value cell an icon.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import type { IconComponent } from '../../core/ports'
import { settled } from '../../testing/settled'
import { col } from '../core/kinds'
import { specOf } from '../core/kinds-spec'
import { useDataTable, modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { DataTable } from './data-table'
import { TableToolbar } from './toolbar'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

type Row = { id: string; name: string; state: string; amount: number; due: string; paid: boolean }
const ROWS: Row[] = [
  { id: 'a', name: 'Acme', state: 'open', amount: 1250, due: '2026-10-02', paid: true },
  { id: 'b', name: 'Beta', state: 'done', amount: 80, due: '2026-11-15', paid: false },
  { id: 'c', name: 'Corvo', state: 'blocked', amount: 42.5, due: '2026-12-24', paid: true },
]

const Glyph =
  (slot: string): IconComponent =>
  ({ className }) => <svg data-icon={slot} className={className} />

const c = col<Row>()
const COLUMNS = [
  c.entity('name', { header: 'Name', headerIcon: Glyph('name-head') }),
  c.status('state', {
    header: 'State',
    options: ['open', 'done', 'blocked'],
    labels: { open: 'In review', done: 'Shipped', blocked: 'Waiting on legal' },
    tone: (v) => (v === 'blocked' ? 'bad' : 'neutral'),
    filter: 'multi',
    icon: (row) => Glyph(`state-${row.state}`),
  }),
  c.money('amount', { header: 'Amount', currency: 'EUR', filter: 'range' }),
  c.date('due', { header: 'Due', icon: () => Glyph('due') }),
  c.boolean('paid', { header: 'Paid', icon: (row) => Glyph(row.paid ? 'yes' : 'no') }),
]

let latest: TableModel<Row> | undefined
const model = (): TableModel<Row> => {
  if (latest === undefined) throw new Error('no table rendered')
  return latest
}

function Subject({
  columns = COLUMNS,
  headerIcons = true,
}: {
  columns?: typeof COLUMNS
  headerIcons?: boolean
}): ReactElement {
  const t = useDataTable<Row>({
    id: 'rest',
    label: 'Invoices',
    columns,
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    headerIcons,
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} />
    </>
  )
}

const header = (name: string): HTMLElement => screen.getByRole('columnheader', { name })

describe('header controls at rest', () => {
  test('at rest a header is one button: its kind icon and its label, with no sort or filter mark', () => {
    render(<Subject />)
    const amount = header('Amount (EUR)')
    const buttons = within(amount).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Amount (EUR)'])
    expect(buttons[0]?.querySelector('[data-slot="table-kind-icon"]')).not.toBeNull()
    expect(buttons[0]?.querySelector('[data-slot="table-head-label"]')?.textContent).toBe(
      'Amount (EUR)',
    )
    expect(amount.querySelector('[data-slot="table-sort-mark"]')).toBeNull()
    expect(amount.querySelector('[data-slot="table-filter-mark"]')).toBeNull()
    expect(amount.getAttribute('aria-sort')).toBe('none')
  })

  test('a sorted column shows exactly one sort mark with its direction, and its name says sorted', () => {
    render(<Subject />)
    act(() => model().state.setRequest({ sort: [{ id: 'amount', desc: false }] }))
    const amount = header('Amount (EUR)')
    const marks = amount.querySelectorAll('[data-slot="table-sort-mark"]')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.getAttribute('data-direction')).toBe('asc')
    expect(
      within(amount).getByRole('button', { name: 'Amount (EUR), sorted ascending' }),
    ).toBeTruthy()
    expect(amount.getAttribute('aria-sort')).toBe('ascending')
    expect(amount.querySelector('[data-slot="table-filter-mark"]')).toBeNull()
  })

  test('a filtered column shows exactly one filter mark, and its name says filtered', () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({ filters: [{ id: 'amount', op: 'range', values: ['10', ''] }] }),
    )
    const amount = header('Amount (EUR)')
    expect(amount.querySelectorAll('[data-slot="table-filter-mark"]')).toHaveLength(1)
    expect(amount.querySelector('[data-slot="table-sort-mark"]')).toBeNull()
    expect(within(amount).getByRole('button', { name: /^Amount \(EUR\), filtered: / })).toBeTruthy()
  })

  test('a sorted and filtered header keeps its label before one sort mark and one filter mark', () => {
    render(<Subject />)
    act(() =>
      model().state.setRequest({
        sort: [{ id: 'amount', desc: true }],
        filters: [{ id: 'amount', op: 'range', values: ['10', ''] }],
      }),
    )
    const button = within(header('Amount (EUR)')).getByRole('button', {
      name: /^Amount \(EUR\), sorted descending, filtered: /,
    })
    expect(
      Array.from(button.querySelectorAll('[data-slot]'), (el) => el.getAttribute('data-slot')),
    ).toEqual(['table-head-label', 'table-kind-icon', 'table-sort-mark', 'table-filter-mark'])
    expect(
      button.querySelector('[data-slot="table-sort-mark"]')?.getAttribute('data-direction'),
    ).toBe('desc')
  })

  test("the menu's Filter column... opens that column's editor, and the filtered header shows its mark", async () => {
    render(<Subject />)
    fireEvent.click(within(header('State')).getByRole('button', { name: 'State' }))
    await settled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Filter column...' }))
    await settled()
    const dialog = screen.getByRole('dialog', { name: 'Filter State' })
    fireEvent.click(
      within(dialog)
        .getByRole('checkbox', { name: /^Shipped\b/ })
        .closest('label') as HTMLElement,
    )
    await settled()
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['done'] }])
    // the header button now names the filter and carries one filter mark, in brand ink
    const active = within(header('State')).getByRole('button', {
      name: 'State, filtered: Shipped',
    })
    const marks = active.querySelectorAll('[data-slot="table-filter-mark"]')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.getAttribute('class')).toContain('text-brand')
  })

  test('a column without a filter shows no filter button', () => {
    render(<Subject />)
    expect(within(header('Due')).queryByRole('button', { name: /^Filter/ })).toBeNull()
  })

  test('the header floor keeps room for the icon, and a filter mark takes none', () => {
    const plain = specOf(c.money('amount', { header: 'Amount', currency: 'EUR' }))
    const filtered = specOf(
      c.money('amount', { header: 'Amount', currency: 'EUR', filter: 'range' }),
    )
    const noIcon = specOf(
      c.money('amount', { header: 'Amount', currency: 'EUR', headerIcon: false }),
    )
    const width = (s: typeof plain): number => (s.width === 'icon' ? 0 : s.width.ch)
    expect(width(filtered)).toBe(width(plain))
    expect(width(plain)).toBeGreaterThan(width(noIcon))
    // a short text column sizes to its values, never below its header with its icon
    const text = (o: Parameters<typeof c.text>[1]): number =>
      specOf(c.text('name', o)).content?.short?.minCh ?? 0
    expect(text({ header: 'Category', filter: 'text' })).toBe(text({ header: 'Category' }))
    expect(text({ header: 'Category' })).toBeGreaterThan(
      text({ header: 'Category', headerIcon: false }),
    )
  })
})

describe('icons', () => {
  test('a column headerIcon renders before the header text', () => {
    render(<Subject />)
    const name = header('Name')
    const icon = name.querySelector('[data-icon="name-head"]')
    expect(icon).not.toBeNull()
    expect(icon?.closest('[data-slot="table-head-label"]')?.textContent).toBe('Name')
  })

  test('status, date and boolean cells draw the icon their column gives', () => {
    render(<Subject />)
    const body = document.querySelector('[data-slot="table-body"]') ?? document.body
    expect(body.querySelector('[data-icon="state-blocked"]')).not.toBeNull()
    expect(body.querySelectorAll('[data-icon="due"]').length).toBe(3)
    expect(body.querySelector('[data-icon="yes"]')).not.toBeNull()
    expect(body.querySelector('[data-icon="no"]')).not.toBeNull()
    // a status icon takes the dot's place, in the tone's ink
    const blocked = body.querySelector('[data-icon="state-blocked"]')
    expect(blocked?.getAttribute('class')).toContain('text-bad')
  })

  test('an unknown option on a kind that takes no icon throws naming the column', () => {
    const loose = c as unknown as { number(k: string, o: object): unknown }
    expect(() => loose.number('amount', { icon: () => undefined })).toThrow(
      /c\.number\('amount'\) got unknown option "icon"/,
    )
  })

  test('a table headerIcons:false and a column headerIcon:false draw no header icon', () => {
    const { unmount } = render(<Subject headerIcons={false} />)
    expect(document.querySelectorAll('[data-slot="table-head-label"]')).toHaveLength(0)
    expect(document.querySelectorAll('th [data-slot="table-kind-icon"]')).toHaveLength(0)
    unmount()
    render(
      <Subject
        columns={[
          c.entity('name', { header: 'Name' }),
          c.money('amount', { header: 'Amount', currency: 'EUR', headerIcon: false }),
        ]}
      />,
    )
    expect(
      document.querySelector('th[data-col="name"] [data-slot="table-kind-icon"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('th[data-col="amount"] [data-slot="table-head-label"]'),
    ).toBeNull()
  })

  test('a custom kind has no default header icon', () => {
    const custom = c.custom('code', {
      header: 'Code',
      render: () => 'x',
      sortValue: (r) => r.amount,
      card: 'meta',
      priority: 3,
    })
    expect(specOf(custom).headerIcon).toBeUndefined()
  })
})
