---
name: Lines
use when: 'a metric over time or an ordered axis reads as one or more lines'
never when: 'the values are counts per category (use Bars), or a word must sit on one mark (compose CartesianChart with a custom text mark)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# Lines

`CartesianChart` with the series narrowed to lines: n series, an `area` fade, zones and reference
lines, and names at the line ends or in the legend (`naming`).

## Signature

```ts
Lines<D>(props: LinesProps<D>): ReactElement
  data: readonly D[]
  x: XConfig<D>
  y?: YConfig
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
  label: string
  series: readonly (SeriesBase<D> & Y<D> & { mark: "line"; curve?: CurveName; dash?: boolean; area?: "fade"; weight?: "quiet" | "strong"; gaps?: "connect"; parent?: string; })[]
  naming?: "auto" | "legend" | "endLabels"  // Who names the lines: `'auto'` (end labels from the wide class, the legend below it), `'legend'` or `'endLabels'`
```

`Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.

`ChartFocus`, `ChartRefLine`, `ChartSelection`, `ChartTooltipConfig`, `ChartZone`, `CurveName`, `LinesProps`, `SeriesBase`, `XConfig`, `YConfig` import from `basalt-ui/charts`: `import type { ChartFocus, ChartRefLine, ChartSelection, ChartTooltipConfig, ChartZone, CurveName, LinesProps, SeriesBase, XConfig, YConfig } from 'basalt-ui/charts'`.

## Example

```tsx
<Lines
  label="Sessions per day"
  data={rows}
  x={{ value: (d) => d.day }}
  series={[{ mark: 'line', key: 'sessions', label: 'Sessions', color: SERIES.sessions, y: (d) => d.sessions }]}
/>
```
