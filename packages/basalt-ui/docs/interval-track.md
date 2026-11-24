---
name: IntervalTrack
use when: 'spans with a start and an end sit on rows over time: a calendar week by the hour, the steps of a run, outages by day, shifts by person'
never when: 'the spans are one gap-free row of states (use BandStrip), a value is the answer (use Bars or Lines), or tasks depend on each other (a dependency view)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# IntervalTrack

Rows of spans and point events on one shared x axis, with labels the kit places or drops.

## Signature

```ts
IntervalTrack<T, X extends IntervalX = IntervalX, K extends string = string>(props: IntervalTrackProps<T, X, K>): ReactElement
  className?: string  // Appended to the root element's own class — never replaces it
  style?: CSSProperties  // Merged onto the root element's own inline style, if it has one
  label: string
  data: readonly T[]
  getRow: (d: T) => string  // The row a datum sits on (a day, a step, a host)
  rows?: readonly string[]  // Explicit row order, top to bottom
  formatRow?: ((row: string) => string)  // A row's axis label
  getStart: (d: T) => X
  getEnd?: ((d: T) => X | null)  // The span's end; `null` or omitted draws a point event at the start
  series: readonly IntervalSeries<K>[]
  getSeries: (d: T) => K
  getLabel?: ((d: T) => string | null)  // A span's label, placed by the lane pass; `null` for none
  getPriority?: ((d: T) => number)  // Which label wins room first
  rowExtent?: ((row: string) => readonly [X, X] | null)  // A row's own extent (working hours), drawn as a quiet band behind its spans
  xDomain?: readonly [X, X]  // `[min, max]` of the x axis
  formatX?: ((x: X) => string)  // Tick and tooltip text for an x value
  xTicks?: number | readonly X[]  // A tick count, or the exact tick values
  xTitle?: string  // The x axis name with its unit
  legend?: false  // `false` hides the legend
  tooltip?: false | { rows?: ((d: T) => readonly ChartTooltipRow[]) | undefined; }  // Rows after the span row (a status, an owner)
  focus?: ChartFocus<T>  // `useChartFocus(data, …)`: pointing at a span or stepping with the arrow keys focuses it, it takes a ring (a lane span also lifts one tone) while every other span keeps its paint, and `focus.readout` drives a card fact
  height?: number | "fill" | ResponsiveChartHeight  // A fixed height, or `'fill'` (a `ChartCard` box) to take the parent's
  phase?: Phase | QueryStateLike  // The load state, as on every data part: a `Phase` or a query result
  empty?: Empty | null  // The measured-empty state once the query settled; `cause` is the line the tile prints
```

`Empty`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Empty, Phase, QueryStateLike } from 'basalt-ui/cards'`.

`ChartFocus`, `IntervalSeries`, `IntervalTrackProps`, `IntervalX` import from `basalt-ui/charts`: `import type { ChartFocus, IntervalSeries, IntervalTrackProps, IntervalX } from 'basalt-ui/charts'`.
