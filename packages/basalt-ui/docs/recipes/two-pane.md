---
name: two-pane
use-when: charts stacked on one x (a price over a momentum line) that share one crosshair, one x chip and one plot box
---

Two `Lines` stand in for a dual-pane chart. Both name one `cursor` group, so a hover on either pane moves the crosshair and the readout on the other. Both set the same `y.gutter`, a fixed y-axis width in px, so one day sits on one pixel column in both.

The gutter is a lock, not a minimum: a tick label wider than it is clipped. Size it to the widest label across the panes (`52k` fits 56 px).

One x chip: give every pane but the bottom `x.ticks: []`, so no axis labels repeat and the bottom pane carries the axis. The crosshair still draws on all of them.

Leave the bottom pane's last tick out of its explicit `ticks`. A label at the plot's right edge widens that pane's label reserve and shifts its right edge off the others; the kit has no option for this yet.

Read the shared cursor outside the charts with `chartCursor(group)`. Give each pane its own `height`, or `height="fill"` in a grid of equal rows (`grid h-full grid-rows-3`, each cell `min-h-0`).

```tsx
import { Lines } from 'basalt-ui/charts'
export type Bar = { day: Date; close: number; momentum: number }
export const GROUP = 'momentum' // one cursor group for both panes
export const GUTTER = 56 // one y gutter in px for both panes
const blue = { light: 'var(--basalt-info)', dark: 'var(--basalt-info)' }
const amber = { light: 'var(--basalt-warn)', dark: 'var(--basalt-warn)' }
const x = { value: (d: Bar) => d.day }
export function TwoPane({ bars }: { bars: Bar[] }) {
  // The last tick is dropped: its label widens the reserve and moves this plot's right edge off the upper pane's.
  const ticks = bars.filter((_, i) => i % 15 === 0 && i < bars.length - 1).map((b) => b.day)
  return (
    <div className="flex flex-col gap-1">
      <Lines
        label="Price"
        data={bars}
        x={{ ...x, ticks: [] }}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={180}
        series={[{ mark: 'line', key: 'close', label: 'Close', color: blue, y: (d) => d.close }]}
      />
      <Lines
        label="Momentum"
        data={bars}
        x={{ ...x, ticks }}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={110}
        series={[{ mark: 'line', key: 'm', label: 'Momentum', color: amber, y: (d) => d.momentum }]}
      />
    </div>
  )
}
```
