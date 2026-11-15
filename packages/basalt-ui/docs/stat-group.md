---
name: StatGroup
use when: 'a page shows several headline figures side by side, a status bar or a row of KPIs'
never when: 'there is one figure (use a stat card) or the figures need a chart each (use chart cards)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# StatGroup

A row of `StatCell`s on shared tracks. `strip` draws them on one surface for the dense status bar
of a dashboard; `cards` draws one card each with the headline bands aligned across them, two to a line
in a narrow container. A cell fills the tracks it
declares and the rest collapse, so a loading cell is already its final height.

## Signature

```ts
StatGroup({ variant, label, children }: StatGroupProps): ReactElement
  variant: "strip" | "cards"  // `strip` is one dense surface whose cells share their tracks; `cards` is one card per cell with the bands alig…
  label?: string  // Names the group for assistive tech (`Recovery`)
  children: StatCellElement | readonly StatCellElement[]
```

## Example

```tsx
<StatGroup variant="strip" label="Link health">
  <StatCell label="Downstream" value={412} unit="Mbit/s" phase={query} />
  <StatCell label="Upstream" value={44} unit="Mbit/s" phase={query} />
</StatGroup>
```
