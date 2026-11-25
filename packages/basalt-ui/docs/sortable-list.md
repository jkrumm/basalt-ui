---
name: SortableList
use when: 'the user sets an order by hand: a settings list, the order of tabs or columns'
never when: 'the order is a sort the data defines (sort the table), or cards move between states (use Board)'
subpath: basalt-ui/ui/sortable-list
peers: ['@atlaskit/pragmatic-drag-and-drop']
slots: [sortable-list]
---

# SortableList

A vertical list the user reorders: drag a row by its 24 px handle, or focus the handle and press
Arrow Up, Arrow Down, Home or End. Each finished move calls `onMove` once with the row's final
index, says where it went in a polite live region and keeps focus on the moved row's handle.
While a row is dragged it stays in place at 30 % and a line marks where it will land. The list
holds no order of its own: render `items` in the order `onMove` produced.

## Props

### `SortableList`

```ts
SortableList<T extends { id: string; }>({ label, items, itemLabel, onMove, children, className, }: SortableListProps<T>): ReactElement
  label: string  // The list's accessible name
  items: readonly T[]
  itemLabel: (item: T) => string  // The row's name in the handle's label and the announcement
  onMove: (move: SortableMove) => void  // Called once per finished move with the row's final index
  children: (item: T, index: number) => ReactNode  // The row's content, after its handle
  className?: string  // Layout only
```

## `sortableListVariants`

Part `sortable-list`.

No variant axes.

## Slots

- `sortable-list`
