---
name: two-pane
use-when: charts stacked on one x (a price over a momentum line) that share one crosshair, one x chip and one plot box
---

Two `Lines` stand in for a dual-pane chart. Both name one `cursor` group, so a hover on either pane moves the crosshair and the readout on the other. Both set the same `y.gutter`, a fixed y-axis width in px, so one day sits on one pixel column in both.

The gutter is a lock, not a minimum: a tick label wider than it is clipped. Size it to the widest label across the panes (`52k` fits 56 px).

One x chip: give every pane but the bottom `x.ticks: []`, so no axis labels repeat and the bottom pane carries the axis. The crosshair still draws on all of them.

Leave the bottom pane's last tick out of its explicit `ticks`. A label at the plot's right edge widens that pane's label reserve and shifts its right edge off the others; the kit has no option for this yet.

Read the shared cursor outside the charts with `chartCursor(group)`. Stack the panes in one `ChartCard` with `panes`: each pane takes its share of the card's box by `weight` (default 1) and is called with `height: 'fill'`, so no pane states a pixel height at any width. Pick `height="tall"` on the card for three panes. Pass the page's `focus` to every pane, not only the top one.

```tsx
import { ChartCard, Lines } from 'basalt-ui/charts'
import type { SeriesColor } from 'basalt-ui/charts'
export type Bar = { day: Date; close: number; momentum: number }
export const GROUP = 'momentum' // one cursor group for both panes
export const GUTTER = 56 // one y gutter in px for both panes
const blue = { light: 'var(--basalt-info)', dark: 'var(--basalt-info)' }
const amber = { light: 'var(--basalt-warn)', dark: 'var(--basalt-warn)' }
type Pane = { label: string; color: SeriesColor; y: (d: Bar) => number; ticks: Date[] }
const pane =
  (bars: Bar[], p: Pane) =>
  ({ height }: { height: number | 'fill' }) => (
    <Lines
      label={p.label}
      data={bars}
      x={{ value: (d: Bar) => d.day, ticks: p.ticks }}
      y={{ gutter: GUTTER }}
      cursor={GROUP}
      height={height}
      series={[{ mark: 'line', key: p.label, label: p.label, color: p.color, y: p.y }]}
    />
  )
export function TwoPane({ bars }: { bars: Bar[] }) {
  // The last tick is dropped: its label widens the reserve and moves this plot's right edge off the upper pane's.
  const ticks = bars.filter((_, i) => i % 15 === 0 && i < bars.length - 1).map((b) => b.day)
  const price = pane(bars, { label: 'Price', color: blue, y: (d) => d.close, ticks: [] })
  const momentum = pane(bars, { label: 'Momentum', color: amber, y: (d) => d.momentum, ticks })
  return (
    <ChartCard
      title="Price and momentum"
      height="tall"
      panes={[{ weight: 2, chart: price }, { chart: momentum }]}
    />
  )
}
```
