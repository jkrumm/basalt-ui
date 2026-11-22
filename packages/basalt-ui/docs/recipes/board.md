---
name: board
use-when: columns of KanbanCards that move between states, by drag and by the card menu, with an optimistic save
---

`Board` owns the columns, the drop state, the empty placeholder, the polite announcement and the focus return; the app owns the cards and the save.
Pass `drag` from `basalt-ui/ui/sortable-list` (the optional peer `@atlaskit/pragmatic-drag-and-drop`). Without it the card menu still moves every card: the menu is the keyboard and assistive path either way.
`onMove` gets the card's final index in its target column, for a drop and for the menu alike. `applyMove` is that update as a pure function, so it is the `apply` of an `optimistic` target, and a refused move rolls back through `optimistic`'s restore.
`virtual` windows each column: pass `VirtualList` and the tallest card's height in px. The dragged card and the one just moved stay mounted.
Below `@regular` one column shows: set `active` from a URL field. A column's `tone` draws its dot, `total` is a formatted sum, and a `disabled` column takes no card.

```tsx
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
```
