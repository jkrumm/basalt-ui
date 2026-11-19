/**
 * The table kit fixes of expression cycle 11 (table group): the card threshold steps to 700 when
 * priority 1+2 fit 700 px (n45, n49; cycle 13 moved the 720 px step to 700), and the card threshold steps follow the plan. The geometry
 * lives in `tests/layout/table-expr11.layout.test.ts`.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { col } from './core/kinds'
import type { KindName } from './core/kinds-spec'
import type { PlanInput } from './core/plan'
import { planInputs } from './core/plan'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

const quiet = { warn: () => {} }

function input(
  id: string,
  ch: number,
  priority: 1 | 2 | 3,
  kind: KindName = 'number',
  flex = false,
): PlanInput {
  return { id, kind, card: ['meta'], priority, width: { ch, flex }, pin: null }
}

describe('the card threshold steps through 480, 700 and 800', () => {
  test('priority 1+2 at 480 px keep the 480 step', () => {
    // 168 (flexible title, 18ch) + three 10ch numbers at 104 px each = 480
    const inputs = [
      input('t', 18, 1, 'entity', true),
      input('a', 10, 2),
      input('b', 10, 2),
      input('c', 10, 2),
    ]
    expect(planInputs(inputs, quiet).reducedFrom).toBe(480)
  })

  test('priority 1+2 above 480 and at most 700 px step to 700 (a 750 px table keeps its columns)', () => {
    // 168 + 152 (16ch text) + 104 + 104 = 528
    const inputs = [
      input('t', 18, 1, 'entity', true),
      input('x', 10, 1),
      input('y', 16, 2, 'text', true),
      input('z', 10, 2),
    ]
    expect(planInputs(inputs, quiet).reducedFrom).toBe(700)
  })

  test('priority 1+2 above 700 px step to 800', () => {
    // 168 + six 10ch numbers at 104 px each = 792
    const inputs = [
      input('t', 18, 1, 'entity', true),
      ...Array.from({ length: 6 }, (_, i) => input(`n${i}`, 10, 2)),
    ]
    expect(planInputs(inputs, quiet).reducedFrom).toBe(800)
  })
})

type Row = { id: string; name: string; a: number; b: number; c: number }

const c = col<Row>()

function Table({ phase }: { phase: 'error' | 'empty' }): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-span',
    label: 'Runs',
    columns: [
      c.entity('name', { header: 'Run', priority: 1 }),
      c.number('a', { header: 'A', priority: 1 }),
      c.number('b', { header: 'B', priority: 3 }),
      c.number('c', { header: 'C', priority: 3 }),
    ],
    data: [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(phase === 'error' && { phase: { tag: 'error' as const, retry: () => undefined } }),
    ...(phase === 'empty' && { empty: { cause: 'Nothing yet' } }),
  })
  return <DataTable table={t} />
}

describe('the error and empty row spans the columns every tier draws', () => {
  // A priority 3 column is display: none in the reduced tier and no column of the grid there; a cell
  // spanning it opens phantom auto columns that take width from the flexible one and move the head.
  for (const phase of ['error', 'empty'] as const) {
    test(`${phase}: the message cell skips the priority 3 columns`, () => {
      const { container } = render(<Table phase={phase} />)
      const cell = container.querySelector('tbody td[colspan]')
      expect(cell?.getAttribute('colspan')).toBe('2')
    })
  }
})

function Title({ text }: { text?: boolean }): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-fill',
    label: 'Runs',
    columns: [
      c.entity('name', { header: 'Run', priority: 1 }),
      c.number('a', { header: 'A', priority: 1 }),
      ...(text ? [c.text('id', { header: 'Notes', priority: 2 })] : []),
    ],
    data: [
      {
        id: 'a long note that is too long to size a text column to its value',
        name: 'alpha',
        a: 1,
        b: 2,
        c: 3,
      },
    ],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

describe('a lone flexible title column stops at its cap and a filler column takes the rest', () => {
  test('the title is the one flexible column: a filler col and the root flag', () => {
    // The cap itself (40ch, 80ch with a sub line) is a calc() the DOM shim drops: tests/layout/table-expr11 measures it.
    const { container } = render(<Title />)
    expect(container.querySelector('col[data-fill]')).not.toBeNull()
    expect(container.querySelector('[data-slot="table-root"]')?.hasAttribute('data-fill')).toBe(
      true,
    )
  })

  test('another flexible column takes the width: no filler', () => {
    const { container } = render(<Title text />)
    expect(container.querySelector('col[data-fill]')).toBeNull()
    expect(container.querySelector('[data-slot="table-root"]')?.hasAttribute('data-fill')).toBe(
      false,
    )
  })
})
