# Charts

How a chart earns its place and its marks. Props are in the generated docs: [CartesianChart](docs/cartesian-chart.md), [ChartCard](docs/chart-card.md); the law is `basalt-charts.md`.

## Pick the form

- Start from the question's row in the AGENTS block table; a chart is the answer only when the reader compares or follows a shape. One value, fewer than four points or a ratio against a limit is a [StatCard](docs/stat-card.md) or a [Meter](docs/meter.md).
- A ranked list or a split of a total is a [BarList](docs/bar-list.md): one shared scale, the value printed, the legend left out.
- More than about seven classes to tell apart is a [DataTable](docs/data-table.md).

## Colour budget

- Neutral by default, one accent, one status hue. The accent marks the series the question is about; the rest sit in ink steps.
- A part of a whole or a category split is read from position, order and a direct label. A hue per part is a rainbow.
- A ramp starts neutral below its threshold and turns hue only past it; zero stays neutral.
- A status hue means a status: carry it with a word or a dot, not hue alone. [lint:status-fill-as-text]

## A headline value has a baseline

- Give every headline figure a baseline: a zero line, a reference line, a zone, or a signed delta that names its period. `refLines` and `zones` are data on [CartesianChart](docs/cartesian-chart.md). [type:ChartRefLine] [type:ChartZone]
- Against a limit, draw the limit and print the distance to it; "steady at 1.6x" without the 3x line is a claim without a scale.

## Label and annotate the mark that matters

- Label marks directly with `text` marks placed by [chartLabels](docs/chart-labels.md): it measures, avoids overlaps and drops what is too wide. The worked example is region `example:chartLabels` in `apps/playground/src/demo/gallery/seam.tsx`.
- Annotate the one mark the page is about (the best run, the onset, the live stage) and let the rest recede. [useChartFocus](docs/use-chart-focus.md) holds one focused datum for the marks, the card fact and the live region; region `example:useChartFocus` in the same file.
- Custom marks read `plot.rows(key)` and `plot.visible`, so a legend toggle hides the mark. [type:ChartPlot]

## Anatomy of a chart card

- The headline figure, its unit, delta, period and status live in the card's `figure`; a card action lives in the card's own menu or controls, not in the page bar. [type:ChartCardProps]
- The status is a dot and its word ([Status](docs/status.md)), in the figure. [lint:status-fill-as-text]
- The footer holds at most two facts. [type:FootFacts]
- Region `chart-card` in `apps/playground/src/routes/overview.tsx` is the composed card; regions `weight-chart`, `domain-chart`, `shared-x` and `plot-marks` in `apps/playground/src/routes/charts.tsx` are the chart bodies.

## Honest marks

- Every fill a mark uses has a legend entry: a series, or a legend-only entry for a fill with no series of its own. [type:LegendEntry]
- A stepped or binned scale says its step in a caption; a size channel gets a key.
- The fixture shows its zero and its extreme at rest, so the card is judged with an empty hour and an over-limit value on screen.

## One tab stop, one answer at 390

- One visualization is one tab stop: focus moves between datums with the arrows through [useChartFocus](docs/use-chart-focus.md), instead of a second grid of focusable cells.
- Keep the column that carries the answer at 390 wide and put the answer above the fold; a column that drops is one the answer can spare.

not guarded:

- Draw no `data ?? []` fallback and no second cursor; charts share one by default and isolate through a cursor group ([chartCursor](docs/chart-cursor.md)).
- A tooltip repeats what the surface already says; every value is reachable without hover.
