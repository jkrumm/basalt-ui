// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
import type { BoardProps, Move } from 'basalt-ui/cards'

export type Col = 'todo' | 'doing' | 'done'
export type Item = { id: string; title: string; age: string }
export type Cards = Record<Col, Item[]>

export const COLUMNS = [
  { id: 'todo', label: 'To do', tone: 'neutral' },
  { id: 'doing', label: 'Doing', tone: 'info' },
  { id: 'done', label: 'Done', tone: 'good' },
] as const satisfies BoardProps<Col, Item>['columns']

// A stand-in server: a move takes a little while and then holds.
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
export const issuesApi = {
  async move(_move: Move<Col>): Promise<void> {
    await wait(300)
  },
}
export const boardKey = ['issues', 'board'] as const

// The recipe sits below the stand-in server it reads: a binding is declared before the closure that reads it.
// #region recipe:board
import { useMutation } from '@tanstack/react-query'
import { applyMove, Board, KanbanCard } from 'basalt-ui/cards'
import { optimistic } from 'basalt-ui/data'
import { drag } from 'basalt-ui/ui/sortable-list'
import { VirtualList } from 'basalt-ui/ui/virtual-list'

export function IssueBoard({ cards, active }: { cards: Cards; active: Col }) {
  const move = useMutation({
    mutationFn: (m: Move<Col>) => issuesApi.move(m),
    ...optimistic<Move<Col>, Cards>({
      key: boardKey,
      targets: [{ queryKey: boardKey, apply: applyMove }],
    }),
  })
  return (
    <Board
      label="Issues"
      columns={COLUMNS}
      items={cards}
      active={active}
      drag={drag}
      virtual={{ list: VirtualList, cardHeight: 116 }} // the tallest card in px: rows are never measured
      onMove={(m) => move.mutate(m)}
      card={(issue, m) => <KanbanCard {...issue} move={m} />}
    />
  )
}
// #endregion
