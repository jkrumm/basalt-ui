/**
 * The table kit fixes of expression cycle 4 (`v3-expr-4-kit-fixes`): a money delta, a column kept
 * off the phone cards, and a grouping by a column the table does not show. The geometry lives in
 * `tests/layout/charts-expr4.layout.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { createFormat } from '../core/format'
import type { UseDataTable } from './contract'
import { col } from './core/kinds'
import { DeltaCell } from './core/kinds-cells'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

describe('c.delta', () => {
  const en = createFormat({ locale: 'en' })
  const text = (value: number, currency?: string): string | null => {
    const { container } = render(
      <DeltaCell
        value={value}
        polarity="up-bad"
        format={en}
        unit={undefined}
        currency={currency}
      />,
    )
    return container.textContent
  }

  test('a currency formats like money, sign first, and keeps its direction', () => {
    expect(text(50, 'EUR')).toContain('+€50.00')
    expect(text(-5.66, 'EUR')).toContain('-€5.66')
    const { container } = render(
      <DeltaCell value={-5.66} polarity="up-bad" format={en} unit={undefined} currency="EUR" />,
    )
    const chip = container.querySelector('[data-slot="delta-badge"]')
    expect(chip?.getAttribute('data-direction')).toBe('down')
    expect(chip?.getAttribute('data-tone')).toBe('good')
  })

  test("the currency's own digits: yen has none", () => {
    expect(text(1200, 'JPY')).toContain('+¥1,200')
  })

  test('a zero change reads as a dash', () => {
    expect(text(0, 'EUR')).toBe('–')
    expect(text(0)).toBe('–')
  })
})

type Room = { id: string; room: string; floor: string; n: number }
const ROOMS: Room[] = [
  { id: 'a', room: 'Kitchen', floor: 'Floor 2', n: 4 },
  { id: 'b', room: 'Hall', floor: 'Floor 1', n: 1 },
  { id: 'c', room: 'Bath', floor: 'Floor 2', n: 5 },
]

function Subject({ hide, card }: { hide?: boolean; card?: 'hidden' }): ReactElement {
  const c = col<Room>()
  const t = useDataTable<Room>({
    id: hide === true ? 'rooms-hidden' : 'rooms',
    label: 'Rooms',
    columns: [c.entity('room'), c.text('floor', card === undefined ? {} : { card }), c.number('n')],
    data: ROOMS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    group: { by: 'floor' },
  } as UseDataTable<Room>)
  return <DataTable table={t} />
}

describe('card: hidden', () => {
  test('a column that declared it keeps off the phone cards, and stays in the table', () => {
    const { container } = render(<Subject card="hidden" />)
    const cells = container.querySelectorAll('tbody tr:not([data-group]) [data-kind="text"]')
    expect(cells.length).toBe(3)
    for (const cell of cells) expect(cell.getAttribute('data-card')).toBe('hidden')
    // The sheet hides it in every card tier.
    const sheet = readFileSync(new URL('./table.css', import.meta.url), 'utf8')
    for (const below of ['480', '800', 'always'])
      expect(sheet).toContain(
        `[data-below='${below}']:is([data-phone='cards'], [data-phone='fields'])\n      [data-slot='table-cell'][data-card='hidden']`,
      )
  })

  test('a column that did not declare it carries no marker', () => {
    const { container } = render(<Subject />)
    // a group row's empty cells carry it (expression cycle 16): they hold nothing a card could show
    expect(container.querySelector('tbody tr:not([data-group]) [data-card]')).toBeNull()
  })
})

describe('group by a hidden column', () => {
  test('groups by a column the display state hides, and draws no cell of it', () => {
    localStorage.setItem(
      'basalt:table:rooms-hidden',
      JSON.stringify({ v: 1, value: { visibility: { floor: false } } }),
    )
    const { container } = render(<Subject hide />)
    expect(container.querySelectorAll('tbody tr[data-group]').length).toBe(2)
    expect(container.querySelector('tbody [data-kind="text"]')).toBeNull()
    localStorage.clear()
  })
})
