---
name: CartesianChart
use when: 'a metric needs a time or category chart, or a mix of lines, bars and dots'
never when: 'the chart is a tiny inline trend (use Sparkline) or a one-value readout (use a StatCard)'
peers: ['@tanstack/charts']
slots: []
---

# CartesianChart

The one cartesian chart. `series` is a union by `mark` (`line`, `bar`, `dot`) and the single source of
colour, legend entry and tooltip row. `Lines` and `Bars` are this component with the series narrowed
to lines, or to bars plus line overlays. Source: `src/charts/parts/`.

## Signature

```ts
CartesianChart<D>(props: CartesianChartProps<D>): ReactElement
  data: readonly D[]
  x: { value: (d: D) => number | Date | string; format?; domain?; title?; scale?: 'linear' | 'log' }
  series: readonly Series<D>[]
  ariaLabel: string
  y?: YConfig // + title?: string
  summary?: string
  table?: boolean
  height?: number | 'fill'
  phase?: Phase | QueryStateLike
  tooltip?: ChartTooltipConfig<D> | false
  zones?: readonly ChartZone[]
  refLines?: readonly ChartRefLine[]
  cursor?: string
  selection?: { selected: D | null; onSelect: (d: D | null) => void }
  marks?: CustomMarks<D>
  focus?: ChartFocus<D> // from useChartFocus: one tab stop, arrows and pointer focus a datum
CartesianChart.custom<D>(build: (plot: ChartPlot<D>) => readonly unknown[]): CustomMarks<D>
```

## Series

Every series carries `key`, `label`, `color: { light, dark }` and `y: (d) => number | null` (`null` is
an absence: a gap, no tooltip row). Shared: `format`, `axis`, `note`, `role`, `legend: false`,
`tooltip: false`, `failed`, `getMarker`.

| mark   | extra fields                                                                                |
| ------ | ------------------------------------------------------------------------------------------- |
| `line` | `curve`, `dash`, `area: 'fade'`, `weight: 'quiet' or 'strong'`, `gaps: 'connect'`, `parent` |
| `bar`  | `stack`, `opacity: (d) => number`                                                           |
| `dot`  | `r: (d) => number`                                                                          |

There is no `tone`, no free colour and no numeric stroke width: each is a type error. `weight` is the
closed stroke scale.

## Accessibility

- `ariaLabel` is required and names the chart.
- `summary` is read by assistive technology beside the chart; without it the chart states the first
  series' min, max and last value.
- `table` renders a visually hidden data table for up to 200 points and none above.

## Selection

`selection={{ selected, onSelect }}` makes a click and the Enter key on a point propose that datum to
`onSelect`; a click on the blank plot proposes `null` while something is selected. The selected datum
is ringed at its own value, so on stacked or normalized `Bars` the ring does not follow the segment.
The server render draws the ring and attaches no handler.

## Custom marks

`CartesianChart.custom((plot) => marks)` is the only way to build the `marks` prop. The builder gets
`plot.data`, `plot.rows(key)` (datums of a visible series), `plot.visible`, `plot.plotHeight` and
`plot.focused` (the datum `focus` holds, else `null`: dim the rest against it), and returns engine
marks from the allowed `@tanstack/charts/*` subpaths. They draw after the series' own.

## Axis titles, log x, vertical rules

`x.title` and `y.title` name an axis with its unit. `x.scale: 'log'` puts a numeric x on decades; a
row with x <= 0 is not drawn. A `refLines` entry with `axis: 'x'` is a full-height rule at a band
key, number or Date. A `mark: 'dot'` series legends as a dot. Focus and readout: `use-chart-focus.md`.

## Not yet applied

`y.domain` as an object or function and `y.gutter` are in the type and read by the consumer seams of
`v3-charts-2b-seams` (`src/charts/seams.ts`); until then only a `[min, max]` tuple applies. A bar series' `stack` key and `Marker.label` are in the
type and not read: every bar of a chart stacks by the chart's `layout`, and a marker draws its dot only.
