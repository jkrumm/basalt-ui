---
name: KanbanCard
use when: 'a board column lists work items that move between states'
never when: 'the items are rows to compare (use a table) or a headline figure (use a stat card)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [kanban-age, kanban-card, kanban-chips, kanban-meta, kanban-target, kanban-title]
---

# KanbanCard

A work item on a board: a title that is the card's link (two lines, then clipped), an age that
gives way to the menu on hover and focus (and sits beside it on a coarse pointer), up to two
meta lines, up to four chips, a reason line and a verdict. Two tab stops: the link and the menu.

## Signature

```ts
KanbanCard<C extends string>(props: KanbanCardProps<C>): ReactElement
  id: string
  title: string
  href?: string
  age?: string
  meta?: readonly [string] | readonly [string, string]
  chips?: readonly [CardChip?, CardChip?, CardChip?, CardChip?]
  reason?: { icon?: IconComponent; text: string; }
  status?: Status
  menu?: readonly CardAction[]
  move: "static" | { column: ColumnRef<C>; index: number; columns: …
```
