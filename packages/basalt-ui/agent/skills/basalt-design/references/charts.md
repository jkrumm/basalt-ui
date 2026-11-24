# Charts

How a chart earns its place and its marks. Props are in the generated docs ([CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md), [ChartCard](node_modules/basalt-ui/docs/chart-card.md)); the law is `basalt-charts.md`; the code is the `basalt-charts` skill. Read the branch the chart needs, not all of them:

- [chart-form](chart-form.md): which form answers, part to whole, one measure, progress against a target, the time window. Read it before you pick a kind.
- [chart-color](chart-color.md): the accent, the status hue and the series colors. Read it before you color a series or a delta.
- [chart-labels](chart-labels.md): the baseline, the label on the mark that answers, the axis ticks, one name per item. Read it before you write a figure, an axis or a label.
- [chart-view](chart-view.md): one view at 1800 and 390, the card anatomy and the sizes of the parts. Read it before you place a second part beside a chart.
- [chart-honest](chart-honest.md): legends, spread dots, caps, incomplete data and heat grids. Read it before the first shot.
- [linked-parts](../../basalt-charts/references/linked-parts.md): one focus over the chart and its lists, and what the readout says. Read it whenever a list, a table or a second chart shows the same items.

not guarded:

- Draw no `data ?? []` fallback and no second cursor; charts share one by default and isolate through a cursor group ([chartCursor](node_modules/basalt-ui/docs/chart-cursor.md)).
- A tooltip repeats what the surface already says; every value is reachable without hover.
