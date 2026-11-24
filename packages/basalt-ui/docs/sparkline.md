---
name: Sparkline
use when: 'a card, a table row or a strip shows the trend of one metric in a small box'
never when: 'the reader needs axes, a legend or several series (use a line chart)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: [spark-band, spark-caret, spark-guide, spark-guide-y, spark-line, spark-now, spark-reference]
---

# Sparkline

A quiet inline trend: a neutral line, or an area that fades to nothing, with the now dot on the
last point. Hand SVG, no engine and no tooltip. Without `axisLabels` it is an image with a name and
no tab stop; with them it is a chart host: the arrow keys, Home and End (or a pointer) move a readout
of the point's x and y (`18 · W41`: its `label`, else its day, else its place, `#8`) into the label
row's middle slot, a polite live region reads each step, the line dims round the point and a guide
crosses it to both edges. `cap` holds an outlier on the top edge under an
off-scale caret. No `tone`, no `color`: the dot reads `--spark-now`, which the frame sets from its
delta or status and is neutral outside a frame.

## Signature

```ts
Sparkline(props: SparklineProps): ReactElement
  series: readonly SparkPoint[]
  height: number | "fill"
  width?: number
  form?: "line" | "area"
  reference?: number | "mean" | { min: number; max: number; }  // A value, the `'mean'`, or a target range: two dashed lines with a faint band between
  cap?: number  // The highest value the plot scales to: a point above it is drawn on the top edge with the off-scale caret, so one outlier does not flatten the rest
  axisLabels?: readonly [string, string, string]  // The label row (start, middle, end)
  format?: (v: number) => string
  summary?: string
  label: string
```

`SparklineProps`, `SparkPoint` import from `basalt-ui/charts`: `import type { SparklineProps, SparkPoint } from 'basalt-ui/charts'`.

## Example

```tsx
<Sparkline series={perDay} height={72} axisLabels={['Mon', 'Today', 'Sun']} label="Shipped per day" />
<Sparkline
  series={weeks.map((w) => ({ value: w.hours, label: w.name }))}
  cap={12}
  height={56}
  axisLabels={['W41', 'Time in queue', 'W52']}
  label="Time in queue per week"
/>
```
