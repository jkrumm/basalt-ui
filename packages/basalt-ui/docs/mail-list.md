---
name: MailList
use when: 'a list of conversations or notifications read newest first, opened into a reader beside it (a mailbox, an inbox, a support queue)'
never when: 'the rows are compared by columns (use DataTable), or a feed of events that are not opened (use EventList)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [mail-list, mail-list-bulk, mail-list-header]
---

# MailList

A mailbox's list: each row a face (the organisation as a corner badge), the sender, a star, the
time, the subject, a snippet and the record it is about; an unread row carries a dot and the
heavier weight. The face turns into a checkbox while the row is hovered or holds focus, and on
every row while any is selected; the selection is the caller's, and `bulk` floats at the foot
inside the list's box. Rows sit under sticky period headers and are windowed, so a mailbox of
thousands mounts a screenful. ArrowUp, ArrowDown, Home and End move between rows; `x` selects
the focused one. The list fills its parent's height and scrolls itself: place it in a bounded
pane (`SplitPage scroll="panes"`).

## Signature

```ts
MailList({ label, items, now, weekStartsOn, open, onOpen, selected, onSelectedChange, onStar, actions, virtual, bulk, phase, empty, }: MailListProps): ReactElement
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  label: string  // Names the list for assistive tech: the folder (`Inbox`)
  items: readonly MailItem[]  // Newest first, as the caller sorts them: the list never re-sorts, it groups runs by period
  now: number | Date  // The reading time the period headers are read against; the caller's, so server and client agree
  weekStartsOn?: 0 | 2 | 3 | 1 | 4 | 5 | 6  // The first day of the week for the This week header, 0 for Sunday
  open?: string | null  // The id shown in the reader: its row is marked current
  onOpen: (id: string) => void  // A click, Enter or Space on a row
  selected: readonly string[]  // The selected ids
  onSelectedChange: (ids: readonly string[]) => void
  onStar?: ((item: MailItem, starred: boolean) => void)  // Draws the star as a button
  actions?: readonly MailRowAction[]  // At most three actions on the hovered or focused row (archive, mark unread)
  virtual: VirtualLike  // The window the rows render through: `VirtualList` from `basalt-ui/ui/virtual-list`, passed in so `./cards` needs no virtual peer
  bulk?: ReactNode  // What the selection can do, drawn floating at the list's foot while any row is selected: a `BulkBar` from `basalt-ui/table` in its list form
```

`Phase`, `QueryStateLike`, `Empty` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike, Empty } from 'basalt-ui/cards'`.

## Example

```tsx
<MailList
  label="Inbox"
  items={mail}
  now={now}
  open={values.mail}
  onOpen={store.field.mail.set}
  selected={ids}
  onSelectedChange={setIds}
  virtual={VirtualList}
  bulk={<BulkBar count={ids.length} onClear={() => setIds([])} actions={bulk} />}
/>
```
