---
name: StatCard
use when: 'a page shows one headline figure with its change, verdict and trend as a card'
never when: 'the content is a list of rows (use a row list) or a chart with a legend (use a chart card)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [stat-card, stat-chart, stat-figure, stat-stale, stat-sub]
---

# StatCard

The signature stat card: one shell holding a header and a footer of at most two facts, and an
inset one surface step down inside a 4 px gutter with the figure, its delta pill and verdict, a
sub line and a chart box, all on one left edge (`--card-edge`). The inset is as tall as the rows
the card declares, the same at every phase, and its loading skeleton draws those rows; `chart`
is called only in `ready` and `stale`, in a fixed box. A stale card says so at the end of the
figure row.

## Signature

```ts
StatCard(props: StatCardProps): ReactElement
  // either href, onSelect or neither
  href?: string | NavTarget
  onSelect?: () => void
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  value: string | number | null  // `null` renders a muted dash: absent, never zero
  unit?: string
  delta?: Delta  // A change against a period; `value` prints as given, so pass `'+12%'`, never the fraction 0.12
  status?: Status  // The verdict home: dot plus word
  sub?: string
  chart?: BoxSlot  // Called only in `ready` and `stale`, in a fixed 72 px clipping box (plot 56 + label row 16)
  footer?: FootFacts
  controls?: ControlsSlot<"widget">
  menu?: readonly [CardAction, CardAction, ...CardAction[]]
```

## Example

```tsx
<StatCard
  icon={GitMerge}
  title="Shipped"
  subtitle="vs last week"
  info="Merged pull requests."
  value={388}
  delta={{ value: '+12%', polarity: 'up-good' }}
  phase={query}
  chart={(box) => <Sparkline series={perDay} height={box.height} ariaLabel="Shipped per day" />}
  footer={[{ label: 'Open', value: 12 }, { label: 'Merged', value: 4 }]}
/>
```
