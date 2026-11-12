---
name: board
use-when: columns of KanbanCards that move between states, with a menu path and an app-owned drag engine
file: apps/playground/src/recipes/board.tsx
---

One `onMove` serves the menu and the drop; the card's `move` is required, so the non-drag path always exists. The board announces each move politely and gives the moved card's menu button focus back after it remounts, and `keepIndex` holds that row in a virtualised column. Below `@regular` one column shows: set `active` from a URL field.

```tsx
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
```
