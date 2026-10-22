import type { ReactElement } from 'react'
import { Board } from '../../../src/dashboard/board'
import type { BoardProps } from '../../../src/dashboard/board'

const card = (id: string, title: string): BoardProps['columns'][number]['cards'][number] => ({
  id,
  actor: 'warden',
  type: 'PR review',
  title,
  status: 'Waiting on CI · 2 h',
})

const many = (prefix: string, n: number): BoardProps['columns'][number]['cards'] =>
  Array.from({ length: n }, (_, i) => card(`${prefix}${i}`, `${prefix} task number ${i}`))

const COLUMNS: BoardProps['columns'] = [
  { id: 'needs', title: 'Needs you', total: '12 items', cards: many('n', 12) },
  { id: 'working', title: 'Working', cards: many('w', 6) },
  { id: 'blocked', title: 'Blocked', empty: 'Nothing is blocked', cards: [] },
  { id: 'done', title: 'Done', total: '2 items', cards: many('d', 2) },
]

/** Wave 45: `Board` with each column bounded at 360 px; the viewport picks columns or compact. */
export function BoardFixture(): ReactElement {
  return (
    <div data-testid="board-host">
      <Board label="Board" columns={COLUMNS} height={360} />
    </div>
  )
}
