---
name: BandStrip
use when: 'a single row of states over time is the figure (up, degraded, down; running, failed, idle)'
never when: 'there is a value axis (use Lines or Bars), or two categories cross (use Heatmap)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# BandStrip

A one-dimensional strip of gap-free bands over the shared x axis, each band in one of the `states`
(an uptime day, a deploy, a phase), with an optional inset marker.

## Signature

```ts
BandStrip<T, X extends ChartX = ChartX, K extends string = string>(props: BandStripProps<T, X, K>): ReactElement
  data: readonly T[]
  x: (d: T) => X
  height?: number | ResponsiveChartHeight  // Default: the height law (measured width × class ratio, 160–420px, ≤ 45vh on touch)
  tooltip?: false | ChartTooltipConfig<T, X>
  legend?: false | ChartLegendConfig  // `false` hides the legend
  className?: string  // Appended to the root element's own class — never replaces it
  style?: CSSProperties  // Merged onto the root element's own inline style, if it has one
  xTicks?: number | readonly X[]  // A tick count, or the exact x tick values
  xDomain?: readonly [X, X]  // `[min, max]` of the x scale, in `x`'s type
  formatX?: ((x: X) => string)  // Tick label for an x value
  formatXTick?: ((x: X) => string)  // Tick label for an x value when it differs from the readout's: `formatX` then writes only the hover readout and the tooltip title
  xRefLines?: readonly XRefLine<X>[]  // Vertical reference rules at x values, on a band, numeric or time x
  xTitle?: string  // The x axis name with its unit, drawn under the ticks
  state?: ChartState
  cursorGroup?: string  // Joins a named cursor group instead of the page-shared default
  cursorResolution?: CursorResolution  // Default `'nearest'`
  label: string
  states: readonly (Pick<ChartSeries<never>, "tooltip" | "legend" | "key" | "label" | "color" | "note" | "fillOpacity"> & { glyph?: string | undefined; tone?: StatusTone | undefined; } & { formatValue?: ((d: T) => string | null) | undefined; } & { key: K; })[]
  getBand: (d: T) => BandSpan  // Which state, fill and marker each datum has
  fold?: BandFold<T>
  absentState?: K  // The `states` key that means "not measured"
```

`BandFold`, `BandSpan`, `BandStripProps`, `ChartTooltipConfig` import from `basalt-ui/charts`: `import type { BandFold, BandSpan, BandStripProps, ChartTooltipConfig } from 'basalt-ui/charts'`.
