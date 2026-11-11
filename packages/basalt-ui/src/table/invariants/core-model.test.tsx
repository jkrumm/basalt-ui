/**
 * Pinned 2.x invariants that the v3 core model flips (Issue t1a, docs/v3/concepts/data-table.md
 * section 8; evidence: docs/v3/evidence/self-table-data.md). Flipped by t1a: each is a plain test.
 *
 *   I15  numerals: tabular, unit in header, right-aligned, null = dash   t1a
 *   I16  a wrong alignment/kind value throws naming the column          t1a
 *   I19  natural sort registered ("Project 2" before "Project 10")      t1a
 *
 * `DataTable` and `useDataTable` land with the parts (t2a), so I15 and I19 hold at the core
 * boundary the parts render through: I15 renders a kind cell with the attributes the parts spread
 * on every `td`, I19 sorts through the module-scope engine with the kind's registered sort.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createFormat } from '../../core/format'
import { tableEngine } from '../core/features'
import { engineColumn, specOf } from '../core/kinds'
import { cellAttributes } from '../core/kinds-cells'
import { api } from './api'
import { ROWS } from './harness'
import type { Row } from './harness'

afterEach(cleanup)

const ENV = { format: createFormat(), now: 0, box: { height: 24, phase: 'ready' as const } }

describe('core model invariants', () => {
  // 2.x: table-features.ts:34-90
  test('I15 figure cells are right-aligned tabular, unit stays in the header, null is a dash', () => {
    const c = api.col<Row>()
    const spec = specOf(c.money('amount', { currency: 'EUR' }))
    const row: Row = { id: 'a', name: 'x', amount: null as unknown as number, state: 'Eng' }
    function Subject(): ReactNode {
      return (
        <table>
          <thead>
            <tr>
              <th {...cellAttributes(spec)}>{spec.header}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td {...cellAttributes(spec)}>{spec.render?.(row, ENV)}</td>
            </tr>
          </tbody>
        </table>
      )
    }
    const { container } = render(<Subject />)
    const header = screen.getByRole('columnheader', { name: /Amount \(EUR\)/ })
    expect(header.textContent).toContain('EUR')
    const cell = container.querySelector('tbody td') as HTMLElement
    expect(cell.textContent).toBe('–')
    expect(cell.getAttribute('data-align')).toBe('end')
    expect(cell.getAttribute('data-numerals')).toBe('tabular')
  })

  // 2.x: data-table.tsx:130-155, table-align.type-guard.test.ts
  test('I16 an unknown kind option throws and names the column', () => {
    const c = api.col<Row>()
    expect(() =>
      c.money('amount', { currency: 'EUR', align: 'middle' } as unknown as { currency: string }),
    ).toThrow(/amount/)
  })

  // 2.x: table-features.ts:100-121
  test('I19 sorting a text column is natural, not lexical', () => {
    function Subject(): ReactNode {
      const c = api.col<Row>()
      const table = tableEngine.useAppTable({
        columns: [engineColumn(specOf(c.text('name', { header: 'Name' })))],
        data: ROWS as Row[],
        getRowId: (r) => r.id,
      })
      return (
        <div>
          <button type="button" onClick={() => table.getColumn('name')?.toggleSorting(false)}>
            Name
          </button>
          <ol>
            {table.getRowModel().rows.map((r) => (
              <li key={r.id}>{r.original.name}</li>
            ))}
          </ol>
        </div>
      )
    }
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Project 1',
      'Project 2',
      'Project 10',
    ])
  })
})
