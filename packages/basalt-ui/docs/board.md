---
name: Board
use when: 'work items move between states and the user moves them: a pipeline, an issue flow'
never when: 'the items are rows to compare (use DataTable) or the states are read-only and few (a grouped list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [board]
---

# Board

Columns of `KanbanCard`s that move between states. A card moves by its menu (Move up, Move
down, Move to a column: the keyboard and assistive path, always there) and, given `drag`, by
pointer and touch within and between columns; both call the one `onMove` with the card's final
index. While a card is dragged it stays in place at 40 %, a tilted copy follows the pointer, the
column under it takes a brand border and a line marks the slot. Each move is said in a polite
live region and focus goes back to the moved card's menu. Columns scroll sideways in one region;
below the regular container tier only `active` shows.

## Signature

```ts
Board<C extends string, T extends { id: string; title: string; }>({ label, columns, items, card, onMove, drag, active, onActiveChange, virtual, }: BoardProps<C, T>): ReactElement
  label: string  // The board's accessible name, the region its columns scroll in
  columns: readonly { id: C; label: string; tone?: Tone | undefined; total?: string | undefined; disabled?: boolean | undefined; }[]  // In order
  items: Readonly<Record<C, readonly T[]>>  // Every column's cards in order; a column's count is its length
  card: (item: T, move: { column: ColumnRef<C>; index: number; columns: readonly ColumnRef<C>[]; onMove: (m: Move<C>) => void; dragging?: boolean; }) => ReactElement  // One card: a `KanbanCard` given `move` as it is, so its menu is the keyboard path
  onMove: (move: Move<C>) => void  // Every finished move, by drop or by menu: `index` is the card's final index in `to`
  drag?: DragLike  // The drag engine: `drag` from `basalt-ui/ui/sortable-list`
  active?: C  // The one column shown below the regular container tier, where a switch above the board picks it
  onActiveChange?: ((column: C) => void)
  virtual?: { list: VirtualLike; cardHeight: number; }  // Window every column: `VirtualList` from `basalt-ui/ui/virtual-list` and the fixed px height of one card
```

`BoardProps`, `ColumnRef`, `Move`, `Tone` import from `basalt-ui/cards`: `import type { BoardProps, ColumnRef, Move, Tone } from 'basalt-ui/cards'`.

## Example

```tsx
<Board label="Issues" columns={stages} items={byStage} drag={drag} onMove={move.mutate}
  card={(issue, move) => <KanbanCard {...issue} move={move} />} />
```
