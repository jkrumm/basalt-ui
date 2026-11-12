// The board recipe wired to state and to native drag and drop: what the layout fixture and the S9
// test mount. Nothing here is a recipe; the drag half is one app's choice of engine.
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { Move } from 'basalt-ui/cards'
import { KanbanBoard } from './board'
import type { Cards, Col, Wrap } from './board'

const COLUMNS: readonly Col[] = ['todo', 'doing', 'done']

const columnOf = (cards: Cards, id: string): Col | undefined =>
  COLUMNS.find((c) => cards[c].some((item) => item.id === id))

/** The next board after `m`: the card leaves `from` and lands at `index` of `to`. */
export function applyMove(cards: Cards, m: Move<Col>): Cards {
  const item = cards[m.from].find((i) => i.id === m.id)
  if (item === undefined) return cards
  const without = Object.fromEntries(
    COLUMNS.map((c) => [c, cards[c].filter((i) => i.id !== m.id)]),
  ) as Cards
  return { ...without, [m.to]: without[m.to].toSpliced(m.index, 0, item) }
}

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
}: {
  initial: Cards
  active?: Col
  onMove?: (m: Move<Col>) => void
}): ReactElement {
  const [cards, setCards] = useState(initial)
  // A drop on a card lands the dragged card right after it, so dropping on the last card of a
  // column appends: the same `Move` the menu's "Move to" item sends.
  const wrap: Wrap = (card) => {
    const { move } = card.props
    if (move === 'static') return card
    const { column, index } = move
    return (
      <div
        draggable
        data-testid={`drag-${card.props.id}`}
        onDragStart={(e) => e.dataTransfer.setData('text', card.props.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text')
          const from = columnOf(cards, id)
          if (from === undefined || from === column.id) return
          const m = { id, from, to: column.id, index: index + 1 }
          onMove?.(m)
          setCards(applyMove(cards, m))
        }}
      >
        {card}
      </div>
    )
  }
  return (
    <KanbanBoard
      cards={cards}
      active={active}
      wrap={wrap}
      onMove={(m) => {
        onMove?.(m)
        setCards(applyMove(cards, m))
      }}
    />
  )
}
