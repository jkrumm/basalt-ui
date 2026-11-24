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
CardGrid({ min, narrow, children }: CardGridProps): ReactElement
  min?: "regular" | "wide" | "narrow"  // The narrowest a card may get
  narrow?: "stack" | "scroll"  // What a row of stat cards does in a container narrower than `regular`: `scroll` lays the cards on one line that scrolls sideways with snap points, one card and the next one's edge per screen; `stack` keeps the tracks
  children?: ReactNode
```

## Example

```tsx
<CardGrid min="regular">
  <ChartCard title="Latency" chart={...} />
  <ChartCard title="Errors" chart={...} />
</CardGrid>
```
