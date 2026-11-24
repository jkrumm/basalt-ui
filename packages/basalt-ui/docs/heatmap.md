---
name: Heatmap
use when: 'two ordered categories cross (weekday by hour, service by day) and the cell value is the answer'
never when: 'there is one row of states over time (use BandStrip), or the exact value matters more than the pattern (use a table)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# Heatmap

A band by band grid of cells whose intensity is absolute (one scale across the whole grid), with
named states for cells that are failed, idle or absent. `getRow`, `getCol`, `getValue`, `getState` and
`tickCols` need a stable identity (module scope or memoized) to spare the work: a new function every render
rebuilds the chart on each pass. Focus settles either way: an inline `data`, `domain`, `legend` or `tooltip`
and a build without the React Compiler hover, key and hold the grid without a render loop.

## Signature

```ts
Heatmap<T, K extends string = string>(props: HeatmapProps<T, K>): ReactElement
  className?: string  // Appended to the root element's own class — never replaces it
  style?: CSSProperties  // Merged onto the root element's own inline style, if it has one
  data: readonly T[]
  getRow: (d: T) => string  // The y band (a row) of a datum
  getCol: (d: T) => string  // The x band (a column) of a datum
  getValue: (d: T) => number | null  // The intensity; `null` is an absent cell (flat neutral), never a zero
  rows?: readonly string[]  // Explicit band order
  cols?: readonly string[]
  color?: string  // The ink at full intensity, a `BASALT.*` ref or a series token
  domain?: readonly [number, number]  // The value range the color scale spans
  formatValue?: ((v: number) => string)  // Tooltip value format
  formatLegend?: ((v: number) => string)  // The gradient legend's two end labels
  getState?: ((d: T) => K | undefined)  // The state a datum is in, a `states` key, or `undefined` for the plain value ramp
  states?: readonly HeatmapState<K>[]  // The named states `getState` may return, legended after the gradient (hidden with `legend={false}`)
  formatRow?: ((row: string) => string)  // Band tick and tooltip header labels
  formatCol?: ((col: string) => string)
  tickCols?: readonly string[]  // Column keys whose x tick must survive the kit's thinning (an onset hour)
  legend?: false | { label?: string | undefined; }  // `false` hides the gradient legend; `label` titles it
  tooltip?: false | { rows?: ((d: T) => readonly ChartTooltipRow[]) | undefined; valueLabel?: string | undefined; }  // Rows after the value row, per cell (a sample count, a failure reason)
  height?: number | "fill" | ResponsiveChartHeight  // A fixed height, one per container class, or `'fill'` (the card's `box.height`) to take the parent's, as `matchHeight` does
  matchHeight?: boolean  // Fill the parent's height instead (the same as `height="fill"`)
  phase?: Phase | QueryStateLike  // The load state, as on every data part: a `Phase` or a query result
  empty?: Empty | null  // The measured-empty state once the query settled; `cause` is the line the tile prints
  focus?: ChartFocus<T>  // `useChartFocus(data, …)`: pointing at a cell or stepping with the arrow keys focuses its datum, every other cell dims, and `focus.readout` drives a card fact
  annotate?: ((d: T) => string | null)  // A short mark in the cell (an onset glyph, a two-digit hour), `null` for none
  label: string
```

`Empty`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Empty, Phase, QueryStateLike } from 'basalt-ui/cards'`.

`ChartFocus`, `HeatmapProps`, `HeatmapState` import from `basalt-ui/charts`: `import type { ChartFocus, HeatmapProps, HeatmapState } from 'basalt-ui/charts'`.
