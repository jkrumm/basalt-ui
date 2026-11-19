/**
 * Owner review 2 (Issue 2418): a header shows its sort, filter and menu controls at rest and the
 * filter button opens the column's editor; a column carries a header icon and a value cell an icon.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

function Subject(): ReactElement {
  const t = useDataTable<Row>({
    id: 'rest',
    label: 'Invoices',
    columns: COLUMNS,
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
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
  test('a sortable, filterable column shows sort, filter and menu controls without a hover', () => {
    render(<Subject />)
    const amount = header('Amount (EUR)')
    const sort = within(amount).getByRole('button', { name: 'Amount (EUR)' })
    const mark = amount.querySelector('[data-slot="table-sort-mark"]')
    const filter = within(amount).getByRole('button', { name: 'Filter Amount (EUR)' })
    const menu = within(amount).getByRole('button', { name: 'Amount (EUR) column actions' })
    expect(sort.querySelector('[data-slot="table-sort-mark"]')).toBe(mark)
    for (const control of [mark, filter, menu]) {
      // nothing hides a control until hover: no zero opacity at rest
      expect(control?.getAttribute('class') ?? '').not.toMatch(/(^|\s)opacity-0(\s|$)/)
    }
    // a fine pointer sees the filter button at rest; a coarse one keeps the menu as the door
    expect(filter.className).toContain('pointer-coarse:hidden')
    expect(menu.className).not.toContain('pointer-coarse:hidden')
  })

  test('the controls sit in one order: label and sort mark, filter, menu', () => {
    render(<Subject />)
    const names = within(header('Amount (EUR)'))
      .getAllByRole('button')
      .map((el) => el.getAttribute('aria-label') ?? el.textContent)
    expect(names).toEqual(['Amount (EUR)', 'Filter Amount (EUR)', 'Amount (EUR) column actions'])
  })

  test("clicking filter opens that column's editor in one click", async () => {
    render(<Subject />)
    fireEvent.click(within(header('State')).getByRole('button', { name: 'Filter State' }))
    await settled()
    const dialog = screen.getByRole('dialog', { name: 'Filter State' })
    fireEvent.click(
      within(dialog)
        .getByRole('checkbox', { name: /^Shipped\b/ })
        .closest('label') as HTMLElement,
    )
    await settled()
    expect(model().state.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['done'] }])
    // the same button now carries the filter, in brand ink
    const active = within(header('State')).getByRole('button', {
      name: 'State filtered: Shipped. Edit filter',
    })
    expect(active.hasAttribute('data-active')).toBe(true)
    expect(active.className).toContain('text-brand')
  })

  test('a column without a filter shows no filter button', () => {
    render(<Subject />)
    expect(within(header('Due')).queryByRole('button', { name: /^Filter/ })).toBeNull()
  })

  test('the header floor keeps room for the filter button and the icon', () => {
    const plain = specOf(c.money('amount', { header: 'Amount', currency: 'EUR' }))
    const filtered = specOf(
      c.money('amount', { header: 'Amount', currency: 'EUR', filter: 'range' }),
    )
    const iconed = specOf(
      c.money('amount', { header: 'Amount', currency: 'EUR', headerIcon: Glyph('x') }),
    )
    const width = (s: typeof plain): number => (s.width === 'icon' ? 0 : s.width.ch)
    expect(width(filtered)).toBeGreaterThan(width(plain))
    expect(width(iconed)).toBeGreaterThan(width(plain))
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
})
