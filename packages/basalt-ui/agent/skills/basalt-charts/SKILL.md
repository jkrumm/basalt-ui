---
name: basalt-charts
description: Add or extend a chart in a basalt-ui app — pick a shipped kind or compose CartesianChart, register series colors, verify.
when_to_use: User wants to add or restyle a chart, introduce a metric and its color, or extract a repeated chart shape. Companion to /basalt-design.
---

Procedure only; the contract is `.claude/rules/basalt-charts.md`.

## Steps

1. Write the one-sentence question the chart answers, then pick the form that answers it (the reader's next action decides: a running stage, a median against p95, a pair of rows), then the cheapest substrate that draws that form: a shipped kind whose form is that form, else `CartesianChart` marks in the page's own chart file. A kind is never chosen because it is the nearest catalogue row, and a missing kind is never a reason to draw a different form. A bespoke form stays in that chart file; one repeated in this app is extracted there, never into a new `basalt-ui/charts` kind.
2. Register each new series color in the app's one series file (exempt from `check-theme`): `groupTokens('health', defineSeries({ hrv: { light, dark } }))` from `basalt-ui/tokens` (lighter on dark, deeper on light), then pass the group as `<BasaltProvider paletteOptions={{ groups: [SERIES] }} />` (or `buildPaletteCss` for SSR). A neutral grey comparison series (prior period, "everything else") must be keyed `other`: the one key exempt from the series guard's chroma floor; it still needs the ΔE separation from its neighbours.
3. Compose the chart; import marks from the allowed `@tanstack/charts/*` subpaths:

```tsx
import { lineY } from '@tanstack/charts/line'
import { rect } from '@tanstack/charts/rect'

const [RAIL_PX, Y_MIN, Y_MAX] = [3, 0, 100] // px along the top of a [Y_MIN, Y_MAX] plot
const railTop = (plotHeight: number) => Y_MAX - (RAIL_PX * (Y_MAX - Y_MIN)) / plotHeight
;<CartesianChart
  ariaLabel="HRV"
  data={data}
  x={(d) => d.date}
  series={[{ key: 'hrv', label: 'HRV', color: SERIES.hrv, getValue: (d) => d.hrv }]}
  marks={(plot) => [
    ...plot.visible.map((s) => lineY(plot.rows(s.key), { x: 'x', y: 'y', stroke: s.color })),
    // `plot.plotHeight` is the plot (`plot.height` the frame); `plot.data` is every raw row; `fillOpacity`
    // is one number per mark, so bucket a measured opacity: one mark per step.
    ...[...Map.groupBy(plot.data, (d) => Math.round(d.loss * 20) / 20)].map(([o, r]) =>
      rect(r, { x1: 'at', y1: railTop(plot.plotHeight), y2: Y_MAX, fillOpacity: o }),
    ),
  ]}
/>
```

4. Make the marks answer to focus (the geometry seam): `useChartFocus(items, { announce })` makes one handle; pass it as `focus` to `CartesianChart` (custom marks dim against `plot.focused`), `Heatmap` or a segmented `Meter`, and bind the card's figure to `focus.readout(total, read)`, which returns the total on leave. The host owns the one tab stop, the arrow keys and the polite announcement. A form the page draws itself spreads `focus.target` on its container and `focus.item(i)` on each mark, and places direct labels with `chartLabels.place` (same pixels on the server and the client). Axis names are `y.title` / `xTitle`, a vertical rule is `xRefLines`, a log x is `xScale: 'log'`.

```tsx
const focus = useChartFocus(stages, { announce: (d) => `${d.name}: ${fmt(d.behind)} behind best` })
;<ChartCard title="Pace" facts={{ value: focus.readout(fmt(total), (d) => fmt(d.behind)), period: focus.readout('whole run', (d) => d.name) }}>
  <CartesianChart ariaLabel="Pace" data={stages} x={(d) => d.at} series={series} focus={focus}
    marks={(plot) => {
      // fillOpacity is one number per mark: split the rows on plot.focused, dim the rest.
      const rows = plot.rows('behind')
      const rest = rows.filter((r) => plot.focused !== null && r.datum !== plot.focused)
      return [
        dot(rest, { x: 'x', y: 'y', fill: SERIES.pace, fillOpacity: 0.25 }),
        dot(rows.filter((r) => !rest.includes(r)), { x: 'x', y: 'y', fill: SERIES.pace }),
      ]
    }} />
</ChartCard>

// Hand-drawn (a part-of-whole bar): one tab stop, a mark per item, one live region.
<div {...focus.target} aria-label="Context window" className="flex">
  {parts.map((p, i) => <div key={p.key} {...focus.item(i)} style={{ flexGrow: p.tokens }} className="data-dimmed:opacity-25" />)}
  {focus.live}
</div>
```

5. Wrap it in `ChartCard`; pass `state={{ pending, error, empty }}` from the query. A `cursorValue` series colours its CURSOR dot per datum with `getMarker: (d) => ({ color })`; always-on markers are `Lines`-only, so a consumer-`marks` chart draws its persistent dots itself.
6. Run the repo's own gate (e.g. `make check`), which runs lint, the theme guard and typecheck; fix every finding at its source.
7. Check both color schemes, a pending query, and a keyboard-focused frame.
