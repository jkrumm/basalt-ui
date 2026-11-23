---
name: VirtualList
use when: 'a list is long enough (hundreds of rows) that mounting every row costs more than the user sees'
never when: 'the list is short or paged (render it plainly)'
subpath: basalt-ui/ui/virtual-list
peers: ['@base-ui/react']
slots: [virtual-list]
---

# VirtualList

A windowed list on `@tanstack/react-virtual` (the one primitive that needs the peer). Only the
rows near the viewport are in the DOM, each keyed by `getItemKey` so a prepend keeps its row and
its focus; `keepIndex` holds one row mounted wherever the scroll is. The space of the rows left
out is a spacer, a `div` or (with `spacer="tr"`) a table row, so the rows stay real siblings.
`children` is called once per rendered row with `[item]`. The first window is drawn for
`initialHeight` before the scroller is measured, so server HTML holds rows. Works with no provider; assignable to
the `VirtualLike` port of `src/core/ports.ts`.

## Props

### `VirtualList`

A windowed list on `@tanstack/react-virtual` (the one primitive that needs the peer). Only the
rows near the viewport are in the DOM, each keyed by `getItemKey` so a prepend keeps its row and
its focus; `keepIndex` holds one row mounted wherever the scroll is. The space of the rows left
out is a spacer, a `div` or (with `spacer="tr"`) a table row, so the rows stay real siblings.
`children` is called once per rendered row with `[item]`. The first window is drawn for
`initialHeight` before the scroller is measured, so server HTML holds rows. Works with no provider; assignable to
the `VirtualLike` port of `src/core/ports.ts`.

```ts
VirtualList({ className, count, estimateSize, getItemKey, keepIndex, revealIndex, overscan, initialHeight, spacer, columns, head, tableProps, bodyProps, children, ...props }: VirtualListProps): ReactElement
  className?: string  // Layout and the bound that makes it scroll (`max-h-96`, `flex-1`)
  count: number  // How many rows there are, windowed or not
  estimateSize: (index: number) => number  // The height of row `index` in px
  getItemKey: (index: number) => string | number  // The stable id of row `index` (its record id), never the index: a prepend keeps every row
  keepIndex?: number  // A row that stays rendered however far it scrolls (the focused one)
  revealIndex?: number  // A row scrolled into view (nearest edge) whenever this index changes: the row a key moved to
  overscan?: number  // Rows rendered beyond the viewport on each side
  initialHeight?: number  // The scroller's height in px until it is measured: the server render and the first client render window the rows for this height, so a static page carries the first rows
  spacer?: "div" | "tr"  // What fills the space of the rows that are not rendered: `div` (the default) for a list of blocks, `tr` for table rows, which wraps the rows in a `<table><tbody>` (`tableProps` and `bodyProps` set their attributes)
  columns?: number  // The column count a `tr` spacer spans
  tableProps?: VirtualListTableProps<"table">  // Props for the `<table>` a `spacer="tr"` list renders (`role`, `aria-*`, `data-slot`, classes), so a table owns its attributes as markup, server render included
  bodyProps?: VirtualListTableProps<"tbody">  // Props for the `<tbody>` a `spacer="tr"` list renders
  head?: ReactNode  // A `<thead>` for `spacer="tr"`, kept inside the scroller so its columns line up with the rows
  children: (items: readonly VirtualItem[], totalSize: number) => ReactNode  // Called once per rendered row with that row alone; the list keys each call by `getItemKey`
```

## `virtualListVariants`

Part `virtual-list`.

No variant axes.

## Slots

- `virtual-list`
