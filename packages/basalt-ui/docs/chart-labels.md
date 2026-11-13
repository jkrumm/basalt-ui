---
name: chartLabels
use when: 'a page draws its own marks and needs direct labels that never overlap, or needs to know whether a label fits its segment, with the same answer on the server and in the browser.'
never when: 'the chart is a shipped kind (it labels itself), or the label is HTML in normal flow that the browser lays out.'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# chartLabels

Label measuring and direct-label placement for marks a page draws itself (custom
`CartesianChart` marks, a hand-built SVG).

## Signature

```ts
chartLabels: {
  ;(width, fits, place)
}
```

## Example

`apps/playground/src/demo/gallery/seam.tsx`

```tsx
/** Direct labels as `text` marks: placed in plot pixels, drawn at each dot with a pixel offset. */
function labelMarks(plot: PlotContext<Model, number>) {
  const [lo, hi] = plot.yDomain
  const rows = plot.visible.flatMap((s) => plot.rows(s.key)).filter((r) => r.y !== null)
  const anchors = rows.map((r) => ({
    x: (plot.xFraction(r.x) ?? 0) * plot.plotWidth,
    y: ((hi - (r.y ?? lo)) / (hi - lo)) * plot.plotHeight,
  }))
  const { placed } = chartLabels.place(
    rows.map((r, i) => ({
      key: r.datum.name,
      text: r.datum.name,
      x: anchors[i]?.x ?? 0,
      y: anchors[i]?.y ?? 0,
      priority: r.datum.frontier ? 1 : 0,
    })),
    { width: plot.plotWidth, height: plot.plotHeight },
    {
      gap: DOT_R + 2,
      obstacles: anchors.map((a) => ({
        left: a.x - DOT_R,
        top: a.y - DOT_R,
        width: 2 * DOT_R,
        height: 2 * DOT_R,
      })),
    },
  )
  const byName = new Map(placed.map((l) => [l.key, l]))
  const offset = (r: PlotRow<Model, number>, axis: 'x' | 'y'): number => {
    const label = byName.get(r.datum.name)
    const anchor = anchors[rows.indexOf(r)]
    if (label === undefined || anchor === undefined) return 0
    return axis === 'x' ? label.textX - anchor.x : label.baselineY - anchor.y
  }
  return text(
    rows.filter((r) => byName.has(r.datum.name)),
    {
      id: 'model-labels',
      x: 'x',
      y: 'y',
      text: (r: PlotRow<Model, number>) => r.datum.name,
      anchor: (r: PlotRow<Model, number>) => byName.get(r.datum.name)?.textAnchor ?? 'start',
      dx: (r: PlotRow<Model, number>) => offset(r, 'x'),
      dy: (r: PlotRow<Model, number>) => offset(r, 'y'),
      fill: VX.muted,
      fontSize: VX.text.micro,
    },
  )
}
```
