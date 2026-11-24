---
name: CartesianChart
use when: 'a metric needs a time or category chart, or a mix of lines, bars and dots'
never when: 'the chart is a tiny inline trend (use Sparkline) or a one-value readout (use a StatCard)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# CartesianChart

The cartesian chart. `series` is the single source of colour, legend entry and tooltip row; custom
engine marks come from `CartesianChart.custom` and are drawn after the series' own. The series
fields, selection, custom marks, axis titles and y capping are in `cartesian-chart-guide.md`.

## Signature

```ts
CartesianChart<D>(props: CartesianChartProps<D>): ReactElement
  data: readonly D[]
  x: XConfig<D>
  y?: YConfig
  series: readonly Series<D>[]
  summary?: string
  table?: boolean
  height?: number | "fill"
  phase?: Phase | QueryStateLike
  tooltip?: false | ChartTooltipConfig<D>
  zones?: readonly ChartZone[]
  refLines?: readonly ChartRefLine[]
  cursor?: string
  selection?: ChartSelection<D>
  marks?: CustomMarks<D>
  focus?: ChartFocus<D>  // Pointer and arrow keys focus a datum of `focus.items`; the rest dims, the readout follows
  label: string
```

`Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.

`CartesianChartProps`, `ChartFocus`, `ChartRefLine`, `ChartSelection`, `ChartTooltipConfig`, `ChartZone`, `CustomMarks`, `Series`, `XConfig`, `YConfig` import from `basalt-ui/charts`: `import type { CartesianChartProps, ChartFocus, ChartRefLine, ChartSelection, ChartTooltipConfig, ChartZone, CustomMarks, Series, XConfig, YConfig } from 'basalt-ui/charts'`.

## Example

```tsx
<CartesianChart
  label="Requests per day"
  data={rows}
  x={{ value: (d) => d.day }}
  series={[{ mark: 'line', key: 'requests', label: 'Requests', color: SERIES.requests, y: (d) => d.requests }]}
/>
```
