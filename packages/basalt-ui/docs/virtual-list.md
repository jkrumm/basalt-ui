---
name: VirtualList
use when: ''
never when: ''
subpath: basalt-ui/ui/virtual-list
peers: ['@base-ui/react']
slots: [virtual-list]
---

# VirtualList

A windowed list on `@tanstack/react-virtual` (the one primitive that needs the peer). Only the
rows near the viewport are in the DOM, each keyed by `getItemKey` so a prepend keeps its row and
its focus; `keepIndex` holds one row mounted wherever the scroll is. The space of the rows left
out is a spacer, a `div` or (with `spacer="tr"`) a table row, so the rows stay real siblings.
`children` is called once per rendered row with `[item]`. Works with no provider; assignable to
the `VirtualLike` port of `src/core/ports.ts`.

## `virtualListVariants`

Part `virtual-list`.

No variant axes.

## Slots

- `virtual-list`
