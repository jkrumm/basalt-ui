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
  x: { value: (d: D) => number | Date | string; format?; domain?; title?; scale?: 'linear' | 'log'; ticks?: number | readonly X[] }
  series: readonly Series<D>[]
  ariaLabel: string
  y?: YConfig // domain?, gutter?, title?, format?: (v: number) => string
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

`Phase`, `QueryStateLike`, `Empty` and `FrameState` import as types from `basalt-ui/cards`:
`import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.

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
`plot.data`, `plot.rows(key)` (datums of a visible series), `plot.visible`, `plot.plotWidth` and
`plot.plotHeight` (the plot area in px), `plot.x(value)` and `plot.y(value, axis?)` (a value's px
from the plot's top-left on the axis' own scale: time, log or a band key's centre; `x` is `null` off
the scale) and `plot.focused` (the datum `focus` holds, else `null`: dim the rest against it), and
returns engine marks from the allowed `@tanstack/charts/*` subpaths. They draw after the series' own.

A word on one mark (the slowest, the spike, last night) is an engine `text` mark
(`import { text } from '@tanstack/charts/text'`), allowed under `import-boundary` like every other
mark here, placed by [`chartLabels`](chart-labels.md) in plot pixels so it clears the dots and the
other labels. Draw each placed label at its datum with the placed `dx`/`dy`:

```tsx
marks={CartesianChart.custom<Sender>((plot) => {
  const r = VX.dotR + 1
  const dots = plot.rows('d').flatMap((s) => {
    const px = plot.x(s.perWeek)
    return px === null ? [] : [{ left: px - r, top: plot.y(s.openPct) - r, width: 2 * r, height: 2 * r }]
  })
  const { placed } = chartLabels.place(
    worst.map((s) => ({ key: s.id, text: s.name, x: plot.x(s.perWeek) ?? 0, y: plot.y(s.openPct) })),
    { width: plot.plotWidth, height: plot.plotHeight },
    // The gap clears the anchor's own dot, which is one of the obstacles.
    { obstacles: dots, gap: VX.dotR + 3 },
  )
  return [
    text(placed, {
      x: (l) => byId.get(l.key)!.perWeek,
      y: (l) => byId.get(l.key)!.openPct,
      text: (l) => l.text,
      dx: (l) => l.dx,
      dy: (l) => l.dy,
      anchor: (l) => l.textAnchor,
    }),
  ]
})}
```

A label with no clear spot is dropped; name it in `summary`. A kind such as `Bars` takes no custom
mark, so a chart that needs the word is `CartesianChart` with that mark.

## Zones

A `zones` entry is a y band (`{ from, to, fill, axis?: 'left' | 'right' }`), or with `axis: 'x'` an
x range: `from` and `to` are numbers (a log x too), `Date`s or band keys (both bands covered whole),
`y: { from, to }` bounds it on the left axis and `label` is a muted caption at its top-start corner,
beside the zone when it does not fit inside, dropped when no spot stays in the plot. A bound the
scale cannot place (at or under 0 on a log x, an unknown key) reaches the plot's edge.

```tsx
zones={[{ axis: 'x', from: MIN_PER_WEEK, to: weekEnd, y: { from: 0, to: MAX_OPEN_PCT }, fill: alpha(VX.brand, 0.1), label: 'Mute' }]}
```

## Axis titles, log x, vertical rules

`x.title` and `y.title` name an axis with its unit. `x.scale: 'log'` puts a numeric x on decades; a
row with x <= 0 is not drawn. A `refLines` entry with `axis: 'x'` is a full-height rule at a band
key, number or Date; on a band axis `at: 'start' | 'end'` puts it on the band's edge, mid-gap between
two bars (default `centre`). A `mark: 'dot'` series legends as a dot. Focus and readout:
`use-chart-focus.md`.

`x.ticks` as a number is the most labels: on a band axis they sit at an even stride that keeps the
first and the last band (`ticks: 3` over five stages at 390 px); as a list it labels exactly those
keys. Overlapping labels still thin. `y.format` writes the y tick labels (`2,5`); a series' `format`
still writes its tooltip value.

## Capping an outlier

`y.domain` as `[min, max]`, `{ floor, ceil, pad }` (the domain always reaches `floor` down and
`ceil` up) or `(extent) => extent`. A domain narrower than the data, a tuple or a capping function
(`([lo, hi]) => [lo, Math.min(hi, 80)]`), draws each datum past it on the plot's edge with a caret in
its series colour; the tooltip and the focus readout read the true value. A stack of two or more
bar series, and a `normalized` one, never clamps: a part's value is not the height it reaches. There
is no log y.

## Not yet applied

A bar series' `stack` key and `Marker.label` are in the
type and not read: every bar of a chart stacks by the chart's `layout`, and a marker draws its dot only.
