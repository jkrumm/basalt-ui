---
name: ScrollArea
use when: ''
never when: ''
subpath: basalt-ui/ui/scroll-area
peers: ['@base-ui/react']
slots: [scroll-area]
---

# ScrollArea

A scrolling region. It takes `tabindex="0"` only while its content overflows, so a keyboard user
can scroll it with the arrow keys and a region that fits adds no tab stop. Bound its size with
`max-h-*` or a flex parent, and name it with `aria-label` (it then reads as a region). Content is
wrapped in one plain `div` that the overflow is measured on.

## `scrollAreaVariants`

Part `scroll-area`.

- `orientation`: `vertical`, `horizontal`, `both` (default `vertical`)

## Slots

- `scroll-area`
