// The board wired to local state: what the layout fixture and the S9 test mount. The engine is the
// shipped `drag`; the S9 test passes a stand-in with the same port.
import { applyMove, Board, KanbanCard } from 'basalt-ui/cards'
import type { DragLike } from 'basalt-ui'
import type { Move } from 'basalt-ui/cards'
import { drag } from 'basalt-ui/ui/sortable-list'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { COLUMNS } from './board'
import type { Cards, Col } from './board'

/** `n` cards spread over the columns; `done` takes the long tail so its list must virtualise. */
export function seedCards(counts: Record<Col, number>): Cards {
  const column = (c: Col): Cards[Col] =>
    Array.from({ length: counts[c] }, (_, i) => ({
      id: `${c}-${i + 1}`,
      title: `${c === 'done' ? 'Shipped' : 'Fix'} the ${['cache key', 'retry policy', 'export'][i % 3]} (${c} ${i + 1})`,
      age: `${i + 1} h`,
    }))
  return { todo: column('todo'), doing: column('doing'), done: column('done') }
}

export function BoardDemo({
  initial,
  active = 'todo',
  onMove,
  engine = drag,
}: {
  initial: Cards
  active?: Col
  onMove?: (m: Move<Col>) => void
  engine?: DragLike
}): ReactElement {
  const [cards, setCards] = useState(initial)
  const [shown, setShown] = useState(active)
  return (
    <Board
      label="Issues"
      columns={COLUMNS}
      items={cards}
      active={shown}
      onActiveChange={setShown}
      drag={engine}
      virtual={{ list: VirtualList, cardHeight: 116 }}
      onMove={(m) => {
        onMove?.(m)
        setCards((prev) => applyMove(prev, m))
      }}
      card={(item, move) => <KanbanCard {...item} move={move} />}
    />
  )
}
