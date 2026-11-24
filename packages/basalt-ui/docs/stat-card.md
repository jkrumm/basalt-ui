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
  // either href, onClick or neither
  href?: string | NavTarget
  onClick?: () => void
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  value: string | number | null  // `null` renders a muted dash: absent, never zero
  unit?: string
  delta?: Delta  // A change against a period; `value` prints as given, so pass `'+12%'`, never the fraction 0.12
  status?: Verdict  // The verdict home: dot plus word
  sub?: string
  subMono?: boolean  // The sub line is a time or an id: drawn in the mono face with tabular numerals
  chart?: BoxSlot  // Called only in `ready` and `stale`, in a fixed clipping box of `chartHeight` (72 px: plot 56 + label row 16)
  chartHeight?: number  // The chart box's height in px, default 72
  xLabels?: readonly [string, string, string]  // The three labels under the chart (start, middle, end), drawn in the 16 px row so the slot draws the plot alone
  footer?: FootFacts
  controls?: ControlsSlot<"widget">
  menu?: CardMenu
```

`CardMenu`, `Delta`, `Empty`, `FootFacts`, `Phase`, `QueryStateLike`, `StatCardProps`, `Verdict` import from `basalt-ui/cards`: `import type { CardMenu, Delta, Empty, FootFacts, Phase, QueryStateLike, StatCardProps, Verdict } from 'basalt-ui/cards'`.

`ControlsSlot` import from `basalt-ui/controls`: `import type { ControlsSlot } from 'basalt-ui/controls'`.

`BoxSlot`, `IconComponent`, `NavTarget` import from `basalt-ui`: `import type { BoxSlot, IconComponent, NavTarget } from 'basalt-ui'`.

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
  chart={(box) => <Sparkline series={perDay} height={box.height} label="Shipped per day" />}
  xLabels={["Mon", "Thu", "Sun"]}
  footer={[{ label: 'Open', value: 12 }, { label: 'Merged', value: 4 }]}
/>
```
