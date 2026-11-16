# Charts

How a chart earns its place and its marks. Props are in the generated docs: [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md), [ChartCard](node_modules/basalt-ui/docs/chart-card.md); the law is `basalt-charts.md`.

## Pick the form

- Start from the question's row in the AGENTS block table; a chart is the answer only when the reader compares or follows a shape. One value, fewer than four points or a ratio against a limit is a [StatCard](node_modules/basalt-ui/docs/stat-card.md) or a [Meter](node_modules/basalt-ui/docs/meter.md).
- A ranked list or a split of a total is a [BarList](node_modules/basalt-ui/docs/bar-list.md): one shared scale, the value printed, the legend left out.
- More than about seven classes to tell apart is a [DataTable](node_modules/basalt-ui/docs/data-table.md).

## Colour budget

- Neutral by default, one accent, one status hue. The accent marks the series the question is about; the rest sit in ink steps.
- A part of a whole or a category split is read from position, order and a direct label. A hue per part is a rainbow.
- A ramp starts neutral below its threshold and turns hue only past it; zero stays neutral.
- A rise is one hue in the chart and in the table pill, and a fall the other; the accent marks the answer (the next run, the leader) and nothing else, so one word keeps one colour across parts (n13 drew a rise in the chart and a fall in the table).
- A status hue means a status: carry it with a word or a dot, not hue alone. [lint:status-fill-as-text]
- A status hue marks a state that needs action; a target rule, a "live" band and a passing delta stay in ink steps, and the failed mark takes the status fill instead of its category hue.

## A headline value has a baseline

- Give every headline figure a baseline: a zero line, a reference line, a zone, or a signed delta that names its period. `refLines` and `zones` are data on [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md). [type:ChartRefLine] [type:ChartZone]
- Against a limit, draw the limit and print the distance to it; "steady at 1.6x" without the 3x line is a claim without a scale. A limit that exists only as a colour rule becomes geometry or a signed distance.

- The threshold that defines the answer is drawn, never only stated in a footer: where "part" means 4 kt apart, a `refLines` rule or a zone at 4 kt shows it, and the mark that matters carries why it matters ("Models part: over 4 kt apart"), not only its name (n10 .27, n07 .12, n14 .43, n17 .53, n03 .1: the number was in the footer and no mark showed it).

## Label and annotate the mark that matters

- Label marks directly with `text` marks placed by [chartLabels](node_modules/basalt-ui/docs/chart-labels.md): it measures, avoids overlaps and drops what is too wide. The worked example is region `example:chartLabels` in `apps/playground/src/recipes/seam-examples.tsx`.
- Annotate the one mark the page is about (the best run, the onset, the live stage) and let the rest recede. [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md) holds one focused datum for the marks, the card fact and the live region; region `example:useChartFocus` in the same file.
- The hero states the answer with its verb ("Runs out 13:52", where "13:52" alone answers nothing) and at most one phrase of baseline; the one mark the page is about carries the annotation at rest, so the sentences around it say something else ([copy](copy.md)). A list keeps the answer above its cut.
- When the answer needs a word on one mark (the slowest, the spike, last night), compose [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md) with a `text` mark placed by `chartLabels`: a kind such as [Bars](node_modules/basalt-ui/docs/bars.md) takes only its own marks. Engine `text` marks from `@tanstack/charts/text` are allowed in custom marks. On focus the figure's readout carries what the mark means (its share, its model, its stage) and returns to the answer on leave (c11, c12, c13, n02, n12: the answer was a sentence, or the readout a bare total).
- Name the few marks that matter. On a band axis `x.ticks` as a list of keys labels exactly those bands (`ticks: ['Acme', 'Globex']`); a number only thins. Elsewhere an engine `text` mark placed by `chartLabels`. A band or zone that is the answer carries its words on the mark, where a faint fill with an empty face leaves the reader to guess (n13, n04, c15, n16).
- Custom marks read `plot.rows(key)` and `plot.visible`, so a legend toggle hides the mark. [type:ChartPlot]

## Anatomy of a chart card

- The headline figure, its unit, delta, period and status live in the card's `figure`; a card action lives in the card's own menu or controls, not in the page bar. [type:ChartCardProps]
- The status is a dot and its word ([Status](node_modules/basalt-ui/docs/status.md)), in the figure. [lint:status-fill-as-text]
- The footer holds at most two facts. [type:FootFacts]
- Region `chart-card` in `apps/playground/src/routes/overview.tsx` is the composed card; regions `weight-chart`, `domain-chart`, `shared-x` and `plot-marks` in `apps/playground/src/routes/charts.tsx` are the chart bodies.

## Linked parts

- Where a chart and a list, a table or a timeline show the same items, they share one focus: pointing at or stepping to an item in either focuses it in the other, both ways, and the rest dims in both.
- One [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md) is passed to the chart host as `focus` and spread on each row of the list through `focus.item(i)`; the list sits in its own [ScrollArea](node_modules/basalt-ui/docs/scroll-area.md) at the chart's height, and the keyboard step scrolls the focused row into view. The wiring is the snippet in the basalt-charts skill.
- A list of groups (versions, releases) beside samples of those groups spreads `focus.groupItem(name)` on each row instead; the recipe is `seam-linked` in `docs/recipes/`.
- The kit owns the dim and the clear: the page takes the kit's dim for a seam-drawn mark, and rows that take focus sit under a container whose pointer leave clears (`focus.target`), so the gap between two rows keeps the last focus.

## Form from structure

- Where the items carry a structure the question asks about (hops in a graph, two scores per item, the stages of a pipeline, the stages of a night), the form draws that structure: the hops as a path, the pair as a scatter or paired marks, the stages as segments. A ranked list or a total-only stack is the fallback, and the page names it as the fallback (c10, c11, c12, n02, n12 F1).

## One view

- Where two charts share an axis and answer the two halves of one question, they are one chart above and below the axis (a diverging chart) in one card, where two cards and a strip would stack (c13 X2, F1; n01 in cycle 2: a strip, per-day bars, a list and a line as four stacked parts). Two cards stand only when the axes differ. A list longer than the chart sits beside it in its own scroll region at `@wide`, and a box takes its content's height, so a fixed height cannot leave a gap or clip (n13, n09, c14, n04).

- A table that shows the chart's items is `DataTable` with `focus`, which keeps the link through its own sort; a list that only repeats the chart's numbers is folded into the chart card or dropped (n18, n10, n03, n14, n17, n07).

## Encodings

- A share bar is scaled to the whole its caption names: "of 64 GB" is 64 GB, never the sum of the classes shown (n17 .55).
- A list carries the chart's encoding of a state (the same fill, the same grey), never a second one (n07 .15, .17; n14 .47; n10 .28).
- A ranking prints its values on the bars; at 390 a band axis names every key through a short `x.ticks` label ("Owner", "CI"), where a number only thins the keys away (n18 .68, .75).

## Honest marks

- Every fill a mark uses has a legend entry: a series, or a legend-only entry for a fill with no series of its own. [type:LegendEntry]
- A stepped or binned scale says its step in a caption; a size channel gets a key.
- A fixed row or bar count (`rows={8}`) is derived from the data, so the extreme fixture shows every item: hop 9 hidden behind eight rows, with a headline saying nine hops, is the defect (c10 F5; the bars summed to 18 of 19).
- An incomplete datum (a partial day, a night missing a stage) is marked on its mark (hatched, hollow or a caption on the bar) and named once; a complete smaller value would misstate it (n12 F5: a night with REM missing read as a finished 305 min; c12 F5: today's partial bar read as a finished day; n01 in cycle 2: a zero or absent day drew neither a mark nor a cue).
- The fixture shows its zero and its extreme at rest, so the card is judged with an empty hour and an over-limit value on screen. The extreme reads true: rounding or clamping it away hides it. A zero fixture shows a cue (a dash, a baseline) where the marks would be.
- Binned bars carry a unit caption ("per 15 min"). A count axis and a share-of-limit axis carry a caption (`y.title`: "Requests", "% of limit"), and a `y.format` keeps a decimal for a domain under 2 units (ticks `0.5`, `1.0`, `1.5`, where `1`, `1`, `2` repeats a label) (c14, n04, n16).

## Finish of a form the page draws

- A focused item gets its own mark beside the container's ring, and the ring is inset so it clears the text inside.
- Figures in the page's own markup take tabular numerals; every transition is motion-safe; every value is on the ladder.
- A status token is a fill or a border in a CSS module, and text takes a text token, because the lint stops short of a CSS module.

## One tab stop, one answer at 390

- One visualization is one tab stop: focus moves between datums with the arrows through [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md), instead of a second grid of focusable cells.
- Keep the column that carries the answer at 390 wide and put the answer above the fold; a column that drops is one the answer can spare.

not guarded:

- Draw no `data ?? []` fallback and no second cursor; charts share one by default and isolate through a cursor group ([chartCursor](node_modules/basalt-ui/docs/chart-cursor.md)).
- A tooltip repeats what the surface already says; every value is reachable without hover.
