// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
import type { ColumnRef, KanbanCardProps, Move } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

export type Col = 'todo' | 'doing' | 'done'
export type Item = { id: string; title: string; age: string }
export type Cards = Record<Col, Item[]>
/** The app's drag library attaches here: it wraps one card, whose props name its column and index. */
export type Wrap = (card: ReactElement<KanbanCardProps<Col>>) => ReactElement
export type BoardProps = { cards: Cards; active: Col; onMove: (m: Move<Col>) => void; wrap?: Wrap }
export const LABELS: Record<Col, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

/** The columns with their counts: what every card's `move.columns` and `move.column` read. */
export const columnsOf = (cards: Cards): ColumnRef<Col>[] =>
  (Object.keys(LABELS) as Col[]).map((id) => ({ id, label: LABELS[id], count: cards[id].length }))

// #region recipe:board
import { KanbanCard } from 'basalt-ui/cards'
import { CountBadge } from 'basalt-ui/ui/badge'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import { useEffect, useState } from 'react'
export function KanbanBoard({ cards, active, onMove, wrap = (card) => card }: BoardProps) {
  const [moved, setMoved] = useState<Move<Col> | null>(null)
  const columns = columnsOf(cards)
  const move = (m: Move<Col>) => (onMove(m), setMoved(m))
  useEffect(() => {
    const at = `[data-card-id="${moved?.id}"] [data-slot="kanban-menu"]`
    document.querySelector<HTMLElement>(at)?.focus() // the card remounted: give focus back
  }, [moved])
  return (
    <div className="grid gap-4 @container @regular:grid-cols-3">
      <p role="status" className="sr-only">
        {moved && `Moved to ${LABELS[moved.to]}`}
      </p>
      {columns.map((col) => (
        <section
          key={col.id}
          aria-label={col.label}
          className={`${col.id === active ? 'flex' : 'hidden'} min-w-0 flex-col gap-2 @regular:flex`}
        >
          <h3 className="m-0 text-sm">
            {col.label} <CountBadge count={col.count} />
          </h3>
          <VirtualList
            className="max-h-[70dvh]"
            count={col.count}
            estimateSize={() => 124} // rows are never measured: the tallest card plus its gap
            getItemKey={(i) => cards[col.id][i]!.id}
            keepIndex={moved?.to === col.id ? moved.index : undefined} // keeps the target mounted
          >
            {([row]) => (
              <div className="h-31 pb-2">
                {wrap(
                  <KanbanCard
                    {...cards[col.id][row!.index]!}
                    move={{ column: col, index: row!.index, columns, onMove: move }}
                  />,
                )}
              </div>
            )}
          </VirtualList>
        </section>
      ))}
    </div>
  )
}
// #endregion
