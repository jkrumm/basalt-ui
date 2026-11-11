/**
 * Pinned 2.x invariants that the v3 core model flips (Issue t1a, docs/v3/concepts/data-table.md
 * section 8; evidence: docs/v3/evidence/self-table-data.md). Each is `test.failing` until the
 * flipper lands; the flipper turns it into a plain `test`.
 *
 *   I15  numerals: tabular, unit in header, right-aligned, null = dash   t1a
 *   I16  a wrong alignment/kind value throws naming the column          t1a
 *   I19  natural sort registered ("Project 2" before "Project 10")      t1a
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { api } from './api'
import { renderTable } from './harness'
import type { Row } from './harness'

afterEach(cleanup)

const bodyCells = (container: HTMLElement, col: number) =>
  [...container.querySelectorAll('tbody tr')].map((tr) => tr.children[col]?.textContent ?? '')

describe('core model invariants', () => {
  // 2.x: table-features.ts:34-90
  test.failing(
    'I15 figure cells are right-aligned tabular, unit stays in the header, null is a dash',
    () => {
      const { container } = renderTable({
        data: [{ id: 'a', name: 'x', amount: null as unknown as number, state: 'Eng' }],
      })
      const header = screen.getByRole('columnheader', { name: /Amount \(EUR\)/ })
      expect(header.textContent).toContain('EUR')
      const cell = container.querySelector('tbody td:nth-child(2)') as HTMLElement
      expect(cell.textContent).toBe('–')
      expect(cell.getAttribute('data-align')).toBe('end')
    },
  )

  // 2.x: data-table.tsx:130-155, table-align.type-guard.test.ts
  test.failing('I16 an unknown kind option throws and names the column', () => {
    const c = api.col<Row>()
    expect(() =>
      c.money('amount', { currency: 'EUR', align: 'middle' } as unknown as { currency: string }),
    ).toThrow(/amount/)
  })

  // 2.x: table-features.ts:100-121
  test.failing('I19 sorting a text column is natural, not lexical', () => {
    const { container } = renderTable()
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(bodyCells(container, 0)).toEqual(['Project 1', 'Project 2', 'Project 10'])
  })
})
