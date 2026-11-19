---
name: stacked-charts
use-when: several charts on one time axis stacked in a grid (a price over volume over momentum) that share one cursor and one plot edge
---

Stacked charts on one x are a recipe, not a kit surface: each panel is a plain `CartesianChart`. Charts share one cursor by default, so a hover on any panel moves the crosshair on all of them.

`y.gutter` is the same px on every panel, so one x value sits on one pixel column. `x.ticks: []` on the upper panels drops their x chip; the labelled bottom panel carries it. `height="fill"` in a `grid-rows-3` gives each panel one equal row.

The one hand-made step: the bottom panel takes an explicit tick list without its last tick, because a label at the plot's right edge widens its reserve and shifts that plot off the other two. The kit has no option for that yet; it is a gap to close in the kit.

```tsx
import { CartesianChart } from 'basalt-ui/charts'
export type Row = { at: Date; price: number; volume: number; momentum: number }
const GUTTER = 48 // one y gutter in px: every panel shares one plot left edge
const blue = { light: 'var(--basalt-info)', dark: 'var(--basalt-info)' }
const amber = { light: 'var(--basalt-warn)', dark: 'var(--basalt-warn)' }
const muted = { light: 'var(--basalt-muted-foreground)', dark: 'var(--basalt-muted-foreground)' }
const axis = { value: (d: Row) => d.at }
export function StackedCharts({ rows }: { rows: Row[] }) {
  // The last tick is left off: a label at the plot's right edge widens the reserve and shifts that plot off the others.
  const ticks = rows.filter((r, i) => i % 12 === 0 && i < rows.length - 1).map((r) => r.at)
  return (
    <div className="grid h-full grid-rows-3">
      <div className="min-h-0 [&>[data-basalt-chart]]:h-full">
        <CartesianChart
          label="Price"
          height="fill"
          data={rows}
          x={{ ...axis, ticks: [] }}
          y={{ gutter: GUTTER }}
          series={[
            {
              mark: 'line',
              key: 'price',
              label: 'Price',
              color: blue,
              legend: false,
              y: (d) => d.price,
            },
          ]}
        />
      </div>
      <div className="min-h-0 [&>[data-basalt-chart]]:h-full">
        <CartesianChart
          label="Volume"
          height="fill"
          data={rows}
          x={{ ...axis, ticks: [] }}
          y={{ gutter: GUTTER }}
          series={[
            {
              mark: 'bar',
              key: 'volume',
              label: 'Volume',
              color: muted,
              legend: false,
              y: (d) => d.volume,
            },
          ]}
        />
      </div>
      <div className="min-h-0 [&>[data-basalt-chart]]:h-full">
        <CartesianChart
          label="Momentum"
          height="fill"
          data={rows}
          x={{ ...axis, ticks }}
          y={{ gutter: GUTTER }}
          series={[
            {
              mark: 'line',
              key: 'momentum',
              label: 'Momentum',
              color: amber,
              legend: false,
              y: (d) => d.momentum,
            },
          ]}
        />
      </div>
    </div>
  )
}
```
