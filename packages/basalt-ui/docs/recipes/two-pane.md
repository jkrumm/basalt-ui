---
name: two-pane
use-when: two aligned chart panes (a price over a momentum line) that share one crosshair
---

Two `Lines` stand in for a dual-pane chart. Both name one `cursor` group, so a hover on either pane moves the crosshair and the readout on the other. Both set the same `y.gutter`, a fixed y-axis width in px, so one day sits on one pixel column in both.

The gutter is a lock, not a minimum: a tick label wider than it is clipped. Size it to the widest label across the panes (`52k` fits 56 px).

Read the shared cursor outside the charts with `chartCursor(group)`. Give each pane its own `height`; the panes stack in a plain flex column.

```tsx
import { Lines } from 'basalt-ui/charts'
export type Bar = { day: Date; close: number; momentum: number }
export const GROUP = 'momentum' // one cursor group for both panes
export const GUTTER = 56 // one y gutter in px for both panes
const blue = { light: 'var(--vx-info)', dark: 'var(--vx-info)' }
const amber = { light: 'var(--vx-warn)', dark: 'var(--vx-warn)' }
const x = { value: (d: Bar) => d.day }
export function TwoPane({ bars }: { bars: Bar[] }) {
  return (
    <div className="flex flex-col gap-1">
      <Lines
        label="Price"
        data={bars}
        x={x}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={180}
        series={[{ mark: 'line', key: 'close', label: 'Close', color: blue, y: (d) => d.close }]}
      />
      <Lines
        label="Momentum"
        data={bars}
        x={x}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={110}
        series={[{ mark: 'line', key: 'm', label: 'Momentum', color: amber, y: (d) => d.momentum }]}
      />
    </div>
  )
}
```
