// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:stacked-charts
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
// #endregion
