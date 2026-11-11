---
name: CardGrid
use when: 'cards of one kind sit side by side and the column count should follow the space they get'
never when: 'the layout needs a fixed column count or an asymmetric split (compose the page with `Section`s)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [card-grid]
---

# CardGrid

A grid of cards that decides its columns from its own width: every track is at least `min` wide
and the tracks share the row. There is no column count and no breakpoint to choose, so the same
grid reads right in a phone column, a docked aside and a 1440 page.

## Signature

```ts
CardGrid({ min, children }: CardGridProps): ReactElement
  min?: "narrow" | "regular" | "wide"
  children?: ReactNode
```
