---
name: Sparkline
use when: 'a card, a table row or a strip shows the trend of one metric in a small box'
never when: 'the reader needs axes, a legend or several series (use a line chart)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: [spark-line, spark-now, spark-reference]
---

# Sparkline

A quiet inline trend: a neutral line, or an area that fades to nothing, with the now dot on the
last point. Hand SVG, no engine and no tooltip. Without `axisLabels` it is an image with a name and
no tab stop; with them the arrow keys, Home and End (or a pointer) move a readout into the label
row's middle slot. No `tone`, no `color`: the dot reads `--spark-now`, which the frame sets from its
delta or status and is neutral outside a frame.

## Signature

```ts
Sparkline(props: SparklineProps): ReactElement
  series: readonly SparkPoint[]
  ariaLabel: string
  height: number | "fill"
  width?: number
  form?: "line" | "area"
  reference?: number | "mean"
  axisLabels?: readonly [string, string, string]
  format?: (v: number) => string
  summary?: string
```
