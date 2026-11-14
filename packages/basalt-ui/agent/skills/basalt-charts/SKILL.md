---
name: basalt-charts
description: Add or extend a chart in a basalt-ui app — pick a shipped kind or compose CartesianChart, register series colors, verify.
when_to_use: User wants to add or restyle a chart, introduce a metric and its color, or extract a repeated chart shape. Companion to /basalt-design.
---

Procedure only; the contract is `.claude/rules/basalt-charts.md`.

## Steps

1. Write the one-sentence question the chart answers, then the surface it sits in: the parts it needs (the mark, the figure, the detail list, table or timeline), where each sits and what they share. A chart with a detail list sits beside it at a wide container, the list scrolling in its own region at the chart's height, and stacks at a narrow one; the footprint fits the question. Then pick the form that answers it (the reader's next action decides: a running stage, a median against p95, a pair of rows), then the cheapest substrate that draws that form: a shipped kind whose form is that form, else `CartesianChart` marks in the page's own chart file. A kind is never chosen because it is the nearest catalogue row, and a missing kind is never a reason to draw a different form. A bespoke form stays in that chart file; one repeated in this app is extracted there, never into a new `basalt-ui/charts` kind.
2. Register each new series color in the app's one series file (exempt from `check-theme`): `groupTokens('health', defineSeries({ hrv: { light, dark } }))` from `basalt-ui/tokens` (lighter on dark, deeper on light), then pass the group as `<BasaltProvider paletteOptions={{ groups: [SERIES] }} />` (or `buildPaletteCss` for SSR). A neutral grey comparison series (prior period, "everything else") must be keyed `other`: the one key exempt from the series guard's chroma floor; it still needs the ΔE separation from its neighbours.
3. Compose the chart with marks from the allowed `@tanstack/charts/*` subpaths, and make it answer to focus (the geometry seam): `useChartFocus(items, { announce })` is one handle; pass it as `focus` to `CartesianChart`, `Heatmap` or a segmented `Meter` (the host owns the one tab stop, arrow keys and polite announcement), dim the rest against `plot.focused`, and bind the card's figure to `focus.readout(total, read)` (the total again on leave). `plot.plotHeight` is the plot, `plot.data` every raw row; `fillOpacity` is one number per mark, so split rows into one mark per opacity. Name axes with `y.title` / `xTitle`; a vertical rule is `xRefLines`, a log x `xScale: 'log'`; place direct labels with `chartLabels.place` (same pixels on server and client).

```tsx
const focus = useChartFocus(stages, { announce: (d) => `${d.name}: ${fmt(d.behind)} behind best` })
;<ChartCard title="Pace" facts={{ value: focus.readout(fmt(total), (d) => fmt(d.behind)), period: focus.readout('whole run', (d) => d.name) }}>
  <CartesianChart ariaLabel="Pace" data={stages} x={(d) => d.at} series={series} y={{ title: 'Seconds behind' }} focus={focus}
    marks={(plot) => {
      const rows = plot.rows('behind')
      const rest = rows.filter((r) => plot.focused !== null && r.datum !== plot.focused)
      return [dot(rest, { x: 'x', y: 'y', fill: SERIES.pace, fillOpacity: 0.25 }),
        dot(rows.filter((r) => !rest.includes(r)), { x: 'x', y: 'y', fill: SERIES.pace })]
    }} />
</ChartCard>
// A form the page draws itself (recipe `seam-bar`, or `seam-track` for marks on a time axis): the container is the tab stop, each mark an item; the kit dims the rest.
<div {...focus.target} aria-label="Context window" className="flex">
  {parts.map((p, i) => <div key={p.key} {...focus.item(i)} style={{ flexGrow: p.tokens }} />)}
  {focus.live}
</div>
```

Linked parts: where the chart and a list, table or timeline show the same items, one `useChartFocus` goes to the chart host as `focus` and is spread on each row through `focus.item(i)`, so pointing at or stepping to an item in either focuses it in the other. The list's own `onPointerLeave` clears, so the gap between rows never flashes the unfocused state, and the kit dims: the page sets no opacity. A list of groups beside samples spreads `focus.groupItem(name)` (recipe `seam-linked`); the wiring is in [linked-parts](references/linked-parts.md).

4. Wrap it in `ChartCard`; pass `state={{ pending, error, empty }}` from the query. A `cursorValue` series colours its CURSOR dot per datum with `getMarker: (d) => ({ color })`; always-on markers are `Lines`-only, so a consumer-`marks` chart draws its persistent dots itself.
5. Run the repo's own gate (e.g. `make check`), which runs lint, the theme guard and typecheck; fix every finding at its source.
6. Render the page and run the device checklist in the basalt-design `references/anti-defaults.md` on it at 1800 and 390, in both color schemes, with a pending query and a keyboard-focused frame: answer annotated on the mark, baseline or limit drawn, status hue spent only on a state that needs action, label collisions and light-mode contrast, a focus mark beside the ring, tabular numerals and motion-safe transitions, the extreme true and a zero cue, binned bars with a unit caption, the answer above the fold at 390.
