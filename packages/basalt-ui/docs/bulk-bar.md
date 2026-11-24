---
name: BulkBar
use when: 'a bespoke layout places a table''s bulk bar itself, or a list that is not a table (a mailbox, a card grid) acts on a selection'
never when: 'the full `DataTable` fits (it already renders the bar)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# BulkBar

The bulk bar of a table, or of any list that keeps its own selection. Renders nothing while
nothing is selected. `DataTable` composes the table form above the scroller. The list form is a
floating bar for the list to place at its foot: it wraps its actions rather than clip them, so
it fits the narrowest list it sits in.

## Signature

```ts
BulkBar<T>(props: BulkBarProps<T>): ReactElement | null
  // either count + actions + onClear or table
  count?: number  // How many items are selected; the bar renders nothing at 0
  actions?: readonly BulkBarAction[]  // What the selection can do, in the bar's order
  onClear?: () => void  // Empties the selection
  table?: DataTableInstance<T>
```

`BulkBarAction`, `BulkBarProps`, `DataTableInstance` import from `basalt-ui/table`: `import type { BulkBarAction, BulkBarProps, DataTableInstance } from 'basalt-ui/table'`.

## Example

```tsx
<BulkBar table={t} />
<BulkBar count={ids.length} onClear={clear} actions={[{ id: 'archive', label: 'Archive', icon: Archive, onClick: archive }]} />
```
