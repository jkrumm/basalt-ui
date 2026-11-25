---
name: ScrollArea
use when: 'a bounded region (a log, a list in a panel) scrolls on its own and must stay keyboard-reachable'
never when: 'the page itself scrolls (the shell owns one scrollport), or the content is a long list (use VirtualList)'
subpath: basalt-ui/ui/scroll-area
peers: []
slots: [scroll-area]
---

# ScrollArea

A scrolling region. It takes `tabindex="0"` only while its content overflows, so a keyboard user
can scroll it with the arrow keys and a region that fits adds no tab stop. Bound its size with
`max-h-*` or a flex parent, and name it with `aria-label` (it then reads as a region). Content is
wrapped in one plain `div` that the overflow is measured on.

## Props

### `ScrollArea`

```ts
ScrollArea({ orientation, className, children, ref, ...props }: ScrollAreaProps): ReactElement
  orientation?: "horizontal" | "vertical" | "both" | null
  className?: string  // Layout and the bound that makes it scroll (`max-h-64`, `h-full`)
```

## `scrollAreaVariants`

Part `scroll-area`.

- `orientation`: `vertical`, `horizontal`, `both` (default `vertical`)

## Slots

- `scroll-area`
