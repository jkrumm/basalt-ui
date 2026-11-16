---
name: Bars
use when: 'values are counts or amounts per category or per period, or parts of a whole stack'
never when: 'the trend is the point (use Lines), or a custom mark is needed (compose CartesianChart: Bars takes none)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# Bars

`CartesianChart` with the series narrowed to bars, plus line overlays: stacked, grouped or
normalised by `layout`.

## Signature

```ts
Bars<D>(props: BarsProps<D>): ReactElement
  data: readonly D[]
  x: XConfig<D>
  y?: YConfig
  ariaLabel: string
  summary?: string
  table?: boolean
  height?: number | "fill"
  phase?: Phase | QueryStateLike
  tooltip?: false | ChartTooltipConfig<D>
  zones?: readonly ChartZone[]
  refLines?: readonly ChartRefLine[]
  cursor?: string
  selection?: ChartSelection<D>
  focus?: ChartFocus<D>  // Pointer and arrow keys focus a datum of `focus.items`; the rest dims, the readout follows
  series: readonly BarsSeries<D>[]
  layout?: "stacked" | "grouped" | "normalized"  // Default `'stacked'`
```

`Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.

## Example

```tsx
<Bars
  ariaLabel="Orders per week"
  data={rows}
  x={{ value: (d) => d.week }}
  series={[{ mark: 'bar', key: 'orders', label: 'Orders', color: SERIES.orders, y: (d) => d.orders }]}
/>
```
