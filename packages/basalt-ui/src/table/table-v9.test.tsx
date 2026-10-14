/**
 * What the Table v8 → v9 move must not change, asserted through `BasaltDataTable` (the public
 * boundary) rather than through TanStack: the spike's parity, sort-function and pinning findings
 * (`docs/waves/evidence/w1/ledger.md`), pinned so a `9.3.x` bump has a gate.
 */
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { BasaltDataTable, createColumnHelper } from './index'
import type { BasaltDataTableProps } from './data-table'

type Project = { id: string; name: string; team: string; revenue: number; updated: Date }

const TEAMS = ['core', 'data', 'infra']
const ROWS: Project[] = Array.from({ length: 200 }, (_, i) => ({
  id: `r${i}`,
  name: `Project ${(i * 7919) % 200}`,
  team: TEAMS[i % 3] ?? 'core',
  revenue: (i * 104729) % 10_000,
  updated: new Date(Date.UTC(2026, 0, 1 + (i % 300))),
}))

const col = createColumnHelper<Project>()
const COLUMNS = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('team', { header: 'Team' }),
  col.accessor('revenue', { header: 'Revenue', meta: { align: 'right' } }),
  col.accessor('updated', {
    header: 'Updated',
    cell: (cell) => cell.getValue().toISOString().slice(0, 10),
  }),
]

function renderRows(props: Partial<BasaltDataTableProps<Project>> = {}): string[][] {
  const { container } = render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={COLUMNS} getRowId={(row) => row.id} {...props} />
    </MantineProvider>,
  )
  return [...container.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''),
  )
}

const PAGE_OF_25 = { enablePagination: true, initialPagination: { pageIndex: 0, pageSize: 25 } }
const asCells = (row: Project): string[] => [
  row.name,
  row.team,
  String(row.revenue),
  row.updated.toISOString().slice(0, 10),
]

const names = (rows: string[][]): string[] => rows.map((cells) => cells[0] ?? '')

describe('v8 → v9 parity (sorted by revenue desc, page 1 of 25)', () => {
  test('renders the expected page', () => {
    const expected = ROWS.toSorted((a, b) => b.revenue - a.revenue).slice(0, 25)
    const rows = renderRows({ ...PAGE_OF_25, initialSorting: [{ id: 'revenue', desc: true }] })
    expect(rows).toEqual(expected.map(asCells))
  })

  test('without enablePagination every row renders (the paginated model is bypassed)', () => {
    expect(renderRows()).toHaveLength(ROWS.length)
  })
})

describe('sort functions (registered on the feature set; v9 degrades to `basic` otherwise)', () => {
  test('name asc is alphanumeric: "Project 2" before "Project 10"', () => {
    const sorted = names(renderRows({ initialSorting: [{ id: 'name', desc: false }] }))
    expect(sorted.slice(0, 3)).toEqual(['Project 0', 'Project 1', 'Project 2'])
    expect(sorted.indexOf('Project 2')).toBeLessThan(sorted.indexOf('Project 10'))
  })

  test('the spike negative control, inverted: 1, 2, 10 — not 1, 10, 2', () => {
    const data = ['Project 10', 'Project 2', 'Project 1'].map((name, i) => ({
      ...ROWS[i]!,
      name,
    }))
    expect(names(renderRows({ data, initialSorting: [{ id: 'name', desc: false }] }))).toEqual([
      'Project 1',
      'Project 2',
      'Project 10',
    ])
  })

  /**
   * `sortFn: 'datetime'` compares `getTime()`; `basic` compares the Date OBJECTS, so two distinct
   * Dates for the same instant are never "equal" to it (`a === b` is false) and tied rows lose their
   * stable order. Removing the `datetime` registration makes this fail.
   */
  test('the registered datetime sortFn orders Dates by instant and keeps tied rows stable', () => {
    const instant = (day: string): Date => new Date(`${day}T00:00:00Z`)
    const stamps = ['2026-12-10', '2026-01-02', '2026-12-10', '2026-01-02', '2026-06-01']
    const data = stamps.map((day, i) => ({
      ...ROWS[i]!,
      name: `row-${i}`,
      updated: instant(day),
    }))
    const byInstant = [
      col.accessor('name', { header: 'Name' }),
      col.accessor('updated', {
        header: 'Updated',
        sortFn: 'datetime',
        cell: (cell) => cell.getValue().toISOString().slice(0, 10),
      }),
    ]
    const sortedNames = (desc: boolean): string[] =>
      names(
        renderRows({
          data,
          columns: byInstant,
          initialSorting: [{ id: 'updated', desc }],
        }),
      )
    expect(sortedNames(false)).toEqual(['row-1', 'row-3', 'row-4', 'row-0', 'row-2'])
    expect(sortedNames(true)).toEqual(['row-0', 'row-2', 'row-4', 'row-1', 'row-3'])
  })
})

describe('pinned-column offsets (logical start/end, computed from getStart/getAfter)', () => {
  const sized = createColumnHelper<{ a: string; b: string; c: string; d: string; e: string }>()
  const columns = [
    sized.accessor('a', { header: 'A', size: 100 }),
    sized.accessor('b', { header: 'B', size: 120 }),
    sized.accessor('c', { header: 'C', size: 150 }),
    sized.accessor('d', { header: 'D', size: 80 }),
    sized.accessor('e', { header: 'E', size: 60 }),
  ]
  const data = [{ a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' }]

  /** A declaration read off the inline style text: the logical properties are what make `dir=rtl` mirror. */
  const inline = (el: HTMLElement | undefined, property: string): string | undefined =>
    new RegExp(`${property}:\\s*([^;]+)`).exec(el?.getAttribute('style') ?? '')?.[1]

  test('pinned offsets are logical insets, never physical left/right', () => {
    const styles = headerStyles()
    for (const id of ['A', 'B', 'D', 'E']) {
      expect(inline(styles[id], 'left')).toBeUndefined()
      expect(inline(styles[id], 'right')).toBeUndefined()
    }
  })

  function headerStyles(): Record<string, HTMLElement> {
    const { container } = render(
      <MantineProvider>
        <BasaltDataTable
          data={data}
          columns={columns}
          enablePinning
          initialColumnPinning={{ start: ['a', 'b'], end: ['d', 'e'] }}
        />
      </MantineProvider>,
    )
    return Object.fromEntries(
      [...container.querySelectorAll('th')].map((th) => [th.textContent ?? '', th]),
    )
  }

  test('start-pinned columns stick at the sum of the start columns before them', () => {
    const styles = headerStyles()
    expect(Number.parseFloat(inline(styles['A'], 'inset-inline-start') ?? 'NaN')).toBe(0)
    expect(inline(styles['B'], 'inset-inline-start')).toBe('100px')
  })

  test('end-pinned columns stick at the sum of the end columns after them', () => {
    const styles = headerStyles()
    expect(Number.parseFloat(inline(styles['E'], 'inset-inline-end') ?? 'NaN')).toBe(0)
    expect(inline(styles['D'], 'inset-inline-end')).toBe('60px')
  })

  test('the unpinned column is not sticky', () => {
    const styles = headerStyles()
    expect(styles['C']?.style.position).not.toBe('sticky')
    expect(styles['A']?.style.position).toBe('sticky')
    expect(styles['E']?.style.position).toBe('sticky')
  })
})
