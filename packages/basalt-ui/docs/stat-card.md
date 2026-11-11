---
name: StatCard
use when: 'a page shows one headline figure with its change, verdict and trend as a card'
never when: 'the content is a list of rows (use a row list) or a chart with a legend (use a chart card)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [stat-card, stat-chart, stat-figure, stat-sub]
---

# StatCard

The signature stat card: one shell holding a header and a footer of at most two facts, and an
inset one surface step down inside a 4 px gutter with the figure, its delta pill and verdict, a
sub line and a chart box, all on one left edge (`--card-edge`). It owns its height at every
phase, and its loading skeleton draws the same rows; `chart` is called only in `ready` and
`stale`, in a fixed box.

## Signature

```ts
StatCard(props: StatCardProps): ReactElement
  href: string
  onSelect: () => void
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  value: string | number | null
  unit?: string
  delta?: Delta
  status?: Status
  sub?: string
  chart?: BoxSlot
  footer?: FootFacts
  controls?: ControlsSlot
  menu?: readonly [CardAction, CardAction, ...CardAction[]]
```
