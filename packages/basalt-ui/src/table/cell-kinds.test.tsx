/**
 * `meta.kind` (SPEC § 6.6), asserted against real markup: each kind's chrome (a class from the CSS
 * module plus `data-kind`), the content it supplies without a `cell`, the `cell` override, the unset
 * kind's untouched cell, the throw on a wrong value — and the header: sorted brighter, no band.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { resetValidatedProps } from '../common/validate'
import { BasaltDataTable } from './data-table'
import { createColumnHelper } from './index'
import type { BasaltDataTableProps } from './data-table'

type Row = {
  name: string
  scope: string
  count: number
  cost: number | null
  seen: string
  load: number
}

const col = createColumnHelper<Row>()

const ROWS: Row[] = [
  {
    name: 'Back squat',
    scope: 'wan',
    count: 12480,
    cost: 1234.5,
    seen: '2026-01-15T09:30:00Z',
    load: 0.5,
  },
  { name: 'Bench', scope: 'lan', count: 3, cost: null, seen: 'garbage', load: 2 },
]

afterEach(() => {
  cleanup()
  resetValidatedProps()
})

function renderKinds(columns: BasaltDataTableProps<Row>['columns'], enableSorting = false) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={columns} enableSorting={enableSorting} />
    </MantineProvider>,
  )
}

/** The `<td>`s of one body column, by `data-kind` — row 0 first. */
function cells(container: HTMLElement, kind: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`td[data-kind="${kind}"]`)]
}

describe('cell kinds', () => {
  test('entity never wraps, and renders the raw value when the column has no cell', () => {
    const { container } = renderKinds([
      col.accessor('name', { header: 'Exercise', meta: { kind: 'entity' } }),
    ])
    const [first] = cells(container, 'entity')
    expect(first?.textContent).toBe('Back squat')
  })

  test('status is a Badge coloured by statusColor (default gray)', () => {
    const { container } = renderKinds([
      col.accessor('scope', {
        header: 'Scope',
        meta: { kind: 'status', statusColor: (v) => (v === 'wan' ? 'red' : 'orange') },
      }),
    ])
    const [wan, lan] = cells(container, 'status')
    expect(wan?.querySelector('.mantine-Badge-root')?.textContent).toBe('wan')
    expect(wan?.querySelector('.mantine-Badge-root')?.getAttribute('style')).toContain('red')
    expect(lan?.querySelector('.mantine-Badge-root')?.getAttribute('style')).toContain('orange')
  })

  test('status without statusColor is the neutral chip, dotted like the rest', () => {
    const { container } = renderKinds([
      col.accessor('scope', { header: 'Scope', meta: { kind: 'status' } }),
    ])
    expect(
      cells(container, 'status')[0]?.querySelector('.mantine-Badge-root')?.getAttribute('style'),
    ).toContain('--vx-faint')
  })

  test('number is right-aligned and formatted; null is a dash', () => {
    const { container } = renderKinds([
      col.accessor('count', { header: 'Count', meta: { kind: 'number' } }),
      col.accessor('cost', { header: 'Cost', meta: { kind: 'number' } }),
    ])
    const [big, small] = cells(container, 'number').filter((_, i) => i % 2 === 0)
    expect(big?.textContent).toBe('12,480')
    expect(big?.style.textAlign).toBe('right')
    expect(small?.textContent).toBe('3')
    expect(cells(container, 'number')[3]?.textContent).toBe('—')
    expect(container.querySelector('th')?.style.textAlign).toBe('right')
  })

  test('number keeps fractions, shows 0, and dashes what is not a figure', () => {
    const figures = [12.5, 0, -3, Number.NaN, Number.POSITIVE_INFINITY, 12480]
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable
          data={figures.map((n) => ({ n }))}
          columns={[
            createColumnHelper<{ n: number }>().accessor('n', {
              header: 'N',
              meta: { kind: 'number' },
            }),
          ]}
        />
      </MantineProvider>,
    )
    expect(cells(container, 'number').map((td) => td.textContent)).toEqual([
      '12.5',
      '0',
      '-3',
      '—',
      '—',
      '12,480',
    ])
  })

  test("money is the bare grouped figure in the currency's minor digits; an explicit align still wins", () => {
    const { container } = renderKinds([
      col.accessor('cost', { header: 'Cost', meta: { kind: 'money' } }),
      col.accessor('count', {
        header: 'Count',
        meta: { kind: 'money', currency: 'EUR', align: 'left' },
      }),
    ])
    const [usd, eur] = cells(container, 'money')
    expect(usd?.textContent).toBe('1,234.50')
    expect(eur?.textContent).toBe('12,480.00')
    expect(eur?.style.textAlign).toBe('left')
  })

  test('money in a zero-minor-digit currency prints no fraction', () => {
    const { container } = renderKinds([
      col.accessor('count', { header: 'Count', meta: { kind: 'money', currency: 'JPY' } }),
    ])
    expect(cells(container, 'money')[0]?.textContent).toBe('12,480')
  })

  test('relative-time renders a <time> with the full date as name; garbage is a dash', () => {
    const { container } = renderKinds([
      col.accessor('seen', { header: 'Seen', meta: { kind: 'relative-time' } }),
    ])
    const time = container.querySelector('time')
    expect(time?.getAttribute('datetime')).toBe('2026-01-15T09:30:00.000Z')
    expect(time?.getAttribute('aria-label')).toMatch(/2026/)
    expect(time?.textContent).toMatch(/ago|in |now/)
    expect(cells(container, 'relative-time')[1]?.textContent).toBe('—')
  })

  test('meter renders the bar for the value against meterMax', () => {
    const { container } = renderKinds([
      col.accessor('load', { header: 'Load', meta: { kind: 'meter', meterMax: 4 } }),
    ])
    const meter = container.querySelector('[data-basalt-meter]')
    expect(meter).not.toBeNull()
    expect(
      container.querySelector('[role="meter"], [aria-valuenow]')?.getAttribute('aria-valuenow'),
    ).toBe('0.5')
    expect(container.querySelector('[aria-valuemax]')?.getAttribute('aria-valuemax')).toBe('4')
  })

  test('text, entity and relative-time cells carry their kind', () => {
    const { container } = renderKinds([
      col.accessor('name', { header: 'Name', meta: { kind: 'text' } }),
      col.accessor('scope', { header: 'Scope', meta: { kind: 'entity' } }),
    ])
    expect(cells(container, 'text')).toHaveLength(2)
    expect(cells(container, 'entity')).toHaveLength(2)
  })

  test("a column's own cell still supplies the content", () => {
    const { container } = renderKinds([
      col.accessor('count', {
        header: 'Count',
        meta: { kind: 'number' },
        cell: (ctx) => <b data-testid="own">#{ctx.getValue()}</b>,
      }),
    ])
    expect(screen.getAllByTestId('own')[0]?.textContent).toBe('#12480')
    expect(cells(container, 'number')).toHaveLength(2)
  })

  test('an unset kind is the plain cell: numeric auto-style, no kind attribute', () => {
    const { container } = renderKinds([col.accessor('count', { header: 'Count' })])
    expect(container.querySelector('[data-kind]')).toBeNull()
    const td = container.querySelector('td')
    expect(td?.textContent).toBe('12480')
    expect(td?.style.fontVariantNumeric).toBe('tabular-nums')
  })

  test('a wrong kind value throws at render', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const bad = col.accessor('name', {
      header: 'Name',
      // @ts-expect-error a value the type refuses must still throw when it arrives untyped
      meta: { kind: 'currency' },
    })
    expect(() => renderKinds([bad])).toThrow(/meta\.kind="currency"/)
    error.mockRestore()
  })
})

describe('header', () => {
  test('a sorted column carries aria-sort; unsorted sortable headers are none', () => {
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable
          data={ROWS}
          columns={[
            col.accessor('name', { header: 'Name' }),
            col.accessor('count', { header: 'Count' }),
          ]}
          initialSorting={[{ id: 'count', desc: true }]}
        />
      </MantineProvider>,
    )
    const [name, count] = [...container.querySelectorAll('th')]
    expect(count?.getAttribute('aria-sort')).toBe('descending')
    expect(name?.getAttribute('aria-sort')).toBe('none')
  })
})
