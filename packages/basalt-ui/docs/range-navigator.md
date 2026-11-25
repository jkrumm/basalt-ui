---
name: RangeNavigator
use when: 'a series spans far more time than one plot can show (years of daily data) and the reader picks the window'
never when: 'the history fits the plot (draw it whole), or the window is a table filter (use the range field''s own control)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# RangeNavigator

The overview of a long series with its window held by a brush, and the preset row above it.
`RangeNavigator.window(data, x, value, spans)` is the window the main chart draws: its `x.domain`
and the rows that reach into it.

## Signature

```ts
RangeNavigator<D, P extends string>(props: RangeNavigatorProps<D, P>): ReactElement
  label: string
  data: readonly D[]  // The whole history, sorted by `x`
  x: (d: D) => Date
  y: (d: D) => number | null
  color: SeriesColor
  window: WindowHandle<P>  // The window: a `field.range({ presets, custom: true })` handle; the presets are `spans`' keys
  spans: Readonly<Record<P, number | "all">>
  height?: number | "fill"  // The strip's height in px (default 64), or `'fill'`: the preset row and the strip take the parent's height (a `ChartCard` pane)
  scale?: "linear" | "log"  // `log` for a history over orders of magnitude, as the main chart draws it
  format?: ((d: Date) => string)  // Writes the handles' values for assistive tech
  presets?: false  // The preset row above the strip, one option per key of `spans` labelled as the handle labels it
```

`RangeNavigatorProps`, `SeriesColor`, `WindowHandle` import from `basalt-ui/charts`: `import type { RangeNavigatorProps, SeriesColor, WindowHandle } from 'basalt-ui/charts'`.
