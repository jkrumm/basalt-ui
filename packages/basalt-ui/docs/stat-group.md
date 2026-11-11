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
of a dashboard; `cards` draws one card each with the headline bands aligned across them, and below
`@regular` a snap row that is a keyboard stop only while it scrolls. A cell fills the tracks it
declares and the rest collapse, so a loading cell is already its final height.

## Signature

```ts
StatGroup({ variant, label, children }: StatGroupProps): ReactElement
  variant: "strip" | "cards"
  label?: string
  children: StatCellElement | readonly StatCellElement[]
```
