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
  href?: string | NavTarget
  age?: string
  meta?: readonly [string, string] | readonly [string]
  chips?: readonly [CardChip?, CardChip?, CardChip?, CardChip?]
  reason?: { icon?: IconComponent; text: string; }
  status?: Verdict
  menu?: readonly MenuEntry[]  // Entries after the move rows the card always offers, so one entry is enough
  contextMenu?: boolean  // Whether a right click, a long press or Shift+F10 on the card opens the card's menu where the pointer is, the same entries as its "..." button; default true
  move: "static" | { column: ColumnRef<C>; index: number; columns: readonly ColumnRef<C>[]; onMove: (m: Move<C>) => void; dragging?: boolean; }  // Required: no card exists without the non-drag path
```

`CardChip`, `ColumnRef`, `KanbanCardProps`, `MenuEntry`, `Move`, `Verdict` import from `basalt-ui/cards`: `import type { CardChip, ColumnRef, KanbanCardProps, MenuEntry, Move, Verdict } from 'basalt-ui/cards'`.

`IconComponent`, `NavTarget` import from `basalt-ui`: `import type { IconComponent, NavTarget } from 'basalt-ui'`.

## Example

```tsx
<KanbanCard
  id={issue.id}
  title={issue.title}
  href={`/issues/${issue.id}`}
  age="2 h"
  meta={['EP-412']}
  chips={[{ label: 'api' }]}
  move={{ column, index, columns, onMove: moveIssue }}
/>
```
