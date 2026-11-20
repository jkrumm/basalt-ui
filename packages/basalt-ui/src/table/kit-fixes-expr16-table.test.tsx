/**
 * Expression cycle 16 (`v3-expr-16-kit-fixes` 1, 9): a `phone: 'columns'` table sizes its columns to what they
 * hold (n77 .16), and a group row tints its pinned cell too and draws no blank cell on the phone card (n80 .41).
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'
import type { UseDataTable } from './contract'

afterEach(cleanup)

const SHEET = readFileSync(new URL('./table.css', import.meta.url), 'utf8')

describe("phone: 'columns' tiers", () => {
  test('every tier forces the auto table layout, over the utility class a table draws', () => {
    const blocks = SHEET.match(/\[data-phone='columns'\] \[data-slot='table'\] \{[^}]*\}/g) ?? []
    expect(blocks).toHaveLength(4)
    for (const block of blocks) expect(block).toContain('table-layout: auto !important')
  })
})

type Run = { id: string; preset: string; model: string; cost: number }
const RUNS: Run[] = [
  { id: 'a', preset: 'Chat', model: 'one', cost: 1 },
  { id: 'b', preset: 'Chat', model: 'two', cost: 2 },
  { id: 'c', preset: 'Podcast', model: 'three', cost: 3 },
]

function Grouped(): ReturnType<typeof DataTable> {
  const c = col<Run>()
  const table = useDataTable<Run>({
    id: 'e16-group',
    label: 'Runs',
    columns: [c.entity('model'), c.text('preset'), c.number('cost', { footer: 'sum' })],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    group: { by: 'preset' },
  } as UseDataTable<Run>)
  return <DataTable table={table} />
}

describe('a group row', () => {
  test('hands its tint to the opaque pinned cell, so the band runs the whole row', () => {
    const { container } = render(<Grouped />)
    const row = container.querySelector('tbody tr[data-group]')
    expect(row?.className).toContain('--row-tint:')
    expect(row?.className).toContain('bg-muted/40')
  })

  test('leaves a cell that draws nothing off the phone card, and keeps one that holds a reduce', () => {
    const { container } = render(<Grouped />)
    const cells = [...(container.querySelector('tbody tr[data-group]')?.children ?? [])]
    expect(cells.map((cell) => cell.getAttribute('data-card'))).toEqual([null, 'hidden', null])
  })
})
