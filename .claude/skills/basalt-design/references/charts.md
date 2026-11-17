# Charts

How a chart earns its place and its marks. Props are in the generated docs: [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md), [ChartCard](node_modules/basalt-ui/docs/chart-card.md); the law is `basalt-charts.md`.

## Pick the form

- Start from the question's row in the AGENTS block table; a chart is the answer only when the reader compares or follows a shape. One value, fewer than four points or a ratio against a limit is a [StatCard](node_modules/basalt-ui/docs/stat-card.md) or a [Meter](node_modules/basalt-ui/docs/meter.md).
- A ranked list or a split of a total is a [BarList](node_modules/basalt-ui/docs/bar-list.md): one shared scale, the value printed, the legend left out.
- More than about seven classes to tell apart is a [DataTable](node_modules/basalt-ui/docs/data-table.md).
- A part-to-whole of a few named parts is a one-row stacked [BarList](node_modules/basalt-ui/docs/bar-list.md) (`series` names the parts, the row's `parts` carries their values) or, for one value on named zones, a [Meter](node_modules/basalt-ui/docs/meter.md), where a bar of hand-sized `div`s draws none of that ([part to whole](#part-to-whole)).
- Two weekday-by-hour (or service-by-day) grids on one scale are [Heatmap](node_modules/basalt-ui/docs/heatmap.md)s that share one focus ([heatmap tools](#heatmap-tools)).

## Part to whole

- The row takes its parts' colours from the app's series file, in the order `series` lists them, so the bar, its legend rows and every other list of the same parts show one colour per part. A second blue for the same part (n29 used `BASALT.brand` on the bar and the series blue in the list) breaks "swatches match the marks" (.27, .30).
- The parts are named where the eye is: the part that answers carries its value on its segment (`chartLabels.fits` places it where it fits), so segments are read by name where a legend would be read by order (.25, .28).
- The legend rows join the page's focus both ways: spread `focus.item(i)` (rows of the page's items) or `focus.seriesItem(key)` (rows that stand for a series) on each, so a focused segment lights its row and a focused row lights its segment, and the hero follows through `focus.readout` (.29, .35). Two near greys for a dimmed part and a focused one read as equal: take the dim from the kit alone (.36).
- Worked, n29 (how much of the year is tagged): round 0 drew the tags as `div` segments, listed them in a legend that joined neither focus nor series, spent a second blue on the untagged segment and left its 38 % in the legend (X3 scored a P2). Round 1 spread `tagFocus.item(i)` on the rows, used one blue and labelled the segments, and passed at 84. Draw it as one stacked [BarList](node_modules/basalt-ui/docs/bar-list.md) row from the start: the colours, the focus and the labels are then the kit's.

## Colour budget

- Neutral by default, one accent, one status hue. The accent marks the series the question is about; the rest sit in ink steps.
- A part of a whole or a category split is read from position, order and a direct label. A hue per part is a rainbow.
- A ramp starts neutral below its threshold and turns hue only past it; zero stays neutral.
- A state has one colour in every linked view: the legend swatches and a table's status dots match the marks (c16, n08); a rise is one hue in the chart and in the table pill, and a fall the other; the accent marks the answer (the next run, the leader) and nothing else, so one word keeps one colour across parts (n13 drew a rise in the chart and a fall in the table).
- A status hue means a status: carry it with a word or a dot, not hue alone. [lint:status-fill-as-text]
- The accent goes to the item that answers (the culprit hop, the signal that leads the verdict), chosen from the data, so it follows the culprit whichever series that is: n26 fixed it to the gateway, so with the home fixture the culprit router was grey (.74); n11 spent it on a 6 px difficulty dot while the progress bars carried none (.4). One fact takes one hue: a red delta pill beside an amber 'Behind pace' dot said one fact twice (n25 .61), and a Down figure drawn without a hue beside table dots with one split a state in two (n23 .33).
- A status hue marks a state that needs action; a target rule, a "live" band and a passing delta stay in ink steps, and the failed mark takes the status fill instead of its category hue.
- The common state stays neutral and the state that needs action takes the hue: n32 put amber "Waiting" on 16 of 25 rows, so the one row that needed a hand stayed hidden among them (.54); colour the few.
- Kinds told apart by colour take the series file's pairs, and an HTML mark (a [Meter](node_modules/basalt-ui/docs/meter.md) bar, a track `div`, a dot) reads them as CSS variables: `seriesTokens(SERIES)`, or the group's `groupTokens`, from `basalt-ui/tokens` give `var(--basalt-…)` refs, so a kind keeps one colour in the chart, the list and the track. Cycle 9 drew kinds as close greys or one grey dot: n33 gave "Pass", "Never run", "Low" and "Medium" one grey dot (.3), n35's builder saw only one route to colour its HTML marks from the series file (`seriesTokens` and `groupTokens` are it) and told Focus from Personal by close greys (.22), n38 carried kind by the accent and two grey steps read off a legend (.53). The one status hue goes to the state that needs action (a stuck or overdue row) and nothing else shares it.
- A quiet or zero day reads as calm, and its delta stays neutral: n31's delta pill turned red on an empty Saturday ("−3.1 vs 3.1 a day"). A delta against an empty or partial period stays neutral, and two kinds one grey step apart (Fix, Chore) take distinct ink steps or a direct label (.46).

## One measure

- The hero, the marks and the baseline measure one quantity. n21's hero was minutes down after a reboot while its dots were total minutes down and its baseline stood against nothing: three quantities, three P2s. Pick the quantity the question names, then derive the hero, the marks and the baseline from it.
- A question that compares a group against its control draws both groups on one axis and leads with the signed difference ("-2 min vs held back"); drops after a reboot against their control read on one axis, and a date scatter hides the comparison.
- A target for an unfinished period is prorated, or its pill stays neutral ([copy](copy.md)).

## A headline value has a baseline

- Give every headline figure a baseline: a zero line, a reference line, a zone, or a signed delta that names its period. `refLines` and `zones` are data on [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md). [type:ChartRefLine] [type:ChartZone]
- Against a limit, draw the limit and print the distance to it; "steady at 1.6x" without the 3x line is a claim without a scale. A limit that exists only as a colour rule becomes geometry or a signed distance.

- The threshold that defines the answer is drawn on the chart, where a footer value alone leaves the reader a claim without a scale: where "part" means 4 kt apart, a `refLines` rule or a zone at 4 kt shows it, and the mark that matters carries why it matters ("Models part: over 4 kt apart"), beyond its name (n10 .27, n07 .12, n14 .43, n17 .53, n03 .1: the number sat in the footer and the chart drew nothing for it).

## Label and annotate the mark that matters

- Label marks directly with `text` marks placed by [chartLabels](node_modules/basalt-ui/docs/chart-labels.md): it measures, avoids overlaps and drops what is too wide. The worked example is region `example:chartLabels` in `apps/playground/src/recipes/seam-examples.tsx`.
- Annotate the one mark the page is about (the best run, the onset, the live stage) and let the rest recede. [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md) holds one focused datum for the marks, the card fact and the live region; region `example:useChartFocus` in the same file.
- The hero states the answer with its verb ("Runs out 13:52", where "13:52" alone answers nothing) and at most one phrase of baseline; the one mark the page is about carries the annotation at rest, so the sentences around it say something else ([copy](copy.md)). A list keeps the answer above its cut.
- When the answer needs a word on one mark (the slowest, the spike, last night), compose [CartesianChart](node_modules/basalt-ui/docs/cartesian-chart.md) with a `text` mark placed by `chartLabels`: a kind such as [Bars](node_modules/basalt-ui/docs/bars.md) takes only its own marks. Engine `text` marks from `@tanstack/charts/text` are allowed in custom marks. On focus the figure's readout carries what the mark means, delta and status included (`focus.readout` takes any value: [linked parts](#linked-parts)) (its share, its model, its stage) and returns to the answer on leave (c11, c12, c13, n02, n12: the answer was a sentence, or the readout a bare total).
- Name the few marks that matter. On a band axis `x.ticks` as a list of keys labels exactly those bands (`ticks: ['Acme', 'Globex']`); a number only thins. Elsewhere an engine `text` mark placed by `chartLabels`. A band or zone that is the answer carries its words on the mark, where a faint fill with an empty face leaves the reader to guess (n13, n04, c15, n16).
- The mark that answers carries the answer at rest, placed by `chartLabels`: the leading line's end value, the total on each top bar, the gap at today. Worked: n25's hero said "−3 vs pace" and nothing on the chart marked today or the gap to the pace line (n25 .60); n22 left the RHR line that exits the band unmarked (n22 .16); n24 printed a value on none of its bars (n24 .46). The hero and the annotation state it once between them.
- The answer sits on the mark that answers, as its value or its name, with the hero or a footer as a second place at most. Cycle 8 cases: the untagged share on its 38 % segment (n29 .25), the production sha on the "Deployed" rule's label (n31 .45), the top blocker's row and bar (n32 .53), the slid measures named in the headline and the 38 h spike labelled (n27 .2), the mover's figure beside its name (n28 .12). A label the plot edge drops is placed again inside the plot.
- Cycle 9, on pages that count where a mark could name: the rows that answer carry a verdict at rest, the word on the row (n36 counted 'yours, stuck' while !433 and !441 sat as bare rows and the 3-week !391 stood unannotated, .30); the failing items are named, where a strip that counts failing probes and names none leaves the reader to scan the table (n33 .2); a window or a tide that stays under the bar is annotated on its span (n34's neap tide under the bar went unremarked, its go bands without a label or key, and 'bar dry' misread 2.4 m, .13); the at-risk tickets are marked on the chart (n37 .44). The answer stands on the mark, and a count is its second place.
- Custom marks read `plot.rows(key)` and `plot.visible`, so a legend toggle hides the mark. [type:ChartPlot]

## One name

- An item has one name across the axis, the list and the hero. n28's axis said "Food", "Trips", "Power" while the list and the hero said the full category names (.11, .23). A name that is too long is cut by the kit's own truncation; an invented short one splits the item in two.

## One readout

- When the figure follows focus, the tooltip is off (`tooltip={false}`) and the hero, the dimmed marks and the list row are the one readout. n24 and n26 showed a tooltip, a swapped hero and a lit row: three readouts for one pointer (n24 .49, n26 .77).
- The announcement names the focused item's values in the tooltip's order (`name: a, b, c`), and a verdict alone is too little: n22 announced "stable" with the values left out, n25 and n23 the same in round 1 (n22 .23).

## Anatomy of a chart card

- The headline figure, its unit, delta, period and status live in the card's `figure`; a card action lives in the card's own menu or controls, not in the page bar. [type:ChartCardProps]
- The status is a dot and its word ([Status](node_modules/basalt-ui/docs/status.md)), in the figure. [lint:status-fill-as-text]
- The footer holds at most two facts. [type:FootFacts]
- Region `chart-card` in `apps/playground/src/routes/overview.tsx` is the composed card; regions `weight-chart`, `domain-chart`, `shared-x` and `plot-marks` in `apps/playground/src/routes/charts.tsx` are the chart bodies.

## Linked parts

- Where a chart and a list, a table or a timeline show the same items, they share one focus: pointing at or stepping to an item in either focuses it in the other, both ways, and the rest dims in both.
- The figure's delta and status follow focus through `focus.readout(rest, read)`, which takes any value: `delta: focus.readout(restDelta, (d) => ...)` (c16 believed a delta stays fixed under focus; n20 put a placeholder 'partial' delta on its figure).
- One [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md) is passed to the chart host as `focus` and spread on each row of the list through `focus.item(i)`; the list sits in its own [ScrollArea](node_modules/basalt-ui/docs/scroll-area.md) at the chart's height, and the keyboard step scrolls the focused row into view. The wiring is the snippet in the basalt-charts skill.
- A list of groups (versions, releases) beside samples of those groups spreads `focus.groupItem(name)` on each row instead; the recipe is `seam-linked` in `docs/recipes/`.
- A page of tables, with nothing to chart, still takes one `useChartFocus` over the rows it shows. Each `DataTable` gets it as `focus` (`getRowId` maps a row to its item), a focused row dims the rest, and the hero or the stat cell reads the focused item through `focus.readout`. n33 and n36 were built from tables and stat cells, wired a hover tint only (the shipped rule asks for focus 'chart or none'), and each lost 2 on F7: hover tinted one row and nothing dimmed or read out (n33 .5, n36 .34).
- Where a chart and a list could show different grains, draw the chart at the list's grain: one bar per ticket, grouped by status zones, so a table row and a bar are the same item and `DataTable focus` joins them by id. n37's round 0 drew bars per status beside a table of tickets, and the two joined nothing (.51, X3 3 lost); its round 1 drew one bar per ticket and passed.
- The kit owns the dim and the clear: the page takes the kit's dim for a seam-drawn mark, and rows that take focus sit under a container whose pointer leave clears (`focus.target`), so the gap between two rows keeps the last focus.

## Form from structure

- An ordinal (a difficulty, a level, a rank) is a mark, where a word in a column reads rather than sees: n11 printed '4 Hard' (n11 .1); five pips or a segmented [Meter](node_modules/basalt-ui/docs/meter.md) draw it.
- The items the question names go on the chart's axis: the stalled books on the time axis, linked to their rows (n25 .59), the hops in path order (n26 .71), where a table beside a chart of something else leaves the question to the reader.
- Where the items carry a structure the question asks about (hops in a graph, two scores per item, the stages of a pipeline, the stages of a night), the form draws that structure: the hops as a path, the pair as a scatter or paired marks, the stages as segments. A ranked list or a total-only stack is the fallback, and the page names it as the fallback (c10, c11, c12, n02, n12 F1).

## One view

- Where two charts share an axis and answer the two halves of one question, they are one chart above and below the axis (a diverging chart) in one card, where two cards and a strip would stack (c13 X2, F1; n01 in cycle 2: a strip, per-day bars, a list and a line as four stacked parts). Charts on one x share one card, or sit side by side inside the 1800x1200 fold; the second below the fold is the defect (n19). Two cards stand only when the axes differ. A list longer than the chart sits beside it in its own scroll region at `@wide`, and a box takes its content's height, so a fixed height cannot leave a gap or clip (n13, n09, c14, n04). A chart is as tall as its marks need: c16 drew eight dots in a 490 px chart, n15 and n20 short charts across 750 and 550 px boxes.

- Cards in one row end at one height: a short card is given its content's height or a second fact, so the row ends flush (n28's row-1 cards ended at 597 and 647 px; n29's legend left 140 px empty to match its list; n27's cards were 240 px each for a figure and a line: .9, .22, .34, .61).
- Two parts that share a focus share one legend and one caption: n30's two heatmaps on one scale carried two legends and two captions, and the lower half of the 1800 frame was empty (.44). One legend sits above both, one caption under them; a chart and its day list are one card (n31 .50), the list scrolling in its own region with a cue where it is cut.
- A page of many small cards groups them by verdict and leads with the group that needs action (n27 sorted slid first but nothing marked where the slid group ended, so the viewer scanned pill colours, .1); on a phone the verdict reads above the fold (n27's eight cards ran 2,000 px at 390 and two and a half showed above the tab bar, .7), and every phone card keeps a label for its figure (n32's showed an Issue id over "Unblocks: 23", .59).
- Parts that answer one question sit beside each other in one view, inside the 1800x1200 fold at `@wide`: n33's findings apart from their probes with half the page empty (.10), n34's window table a separate section below its chart (.18), n37's flush table beside a card (.50), n38's two cards with two items below the fold (.62).
- Three stacked bands that share one focus apiece are three pages in one: n23 drew a strip, five bars 1,480 px wide and, below them, the table of the same monitors (n23 .41). Join the list to the bars through one focus and put them side by side at `@wide`; run the check on your own 1800 shot before the fact count.
- A table that shows the chart's items is [DataTable](node_modules/basalt-ui/docs/data-table.md) with `focus`, which keeps the link through its own sort; a list that only repeats the chart's numbers is folded into the chart card or dropped (n18, n10, n03, n14, n17, n07); a table of the chart's items joins its card instead of a third stacked surface (c16).

## Encodings

- A share bar is scaled to the whole its caption names: "of 64 GB" is 64 GB, where the sum of the classes shown is a different whole (n17 .55).
- A list carries the chart's encoding of a state (the same fill, the same grey); a second encoding of one state reads as two states (n07 .15, .17; n14 .47; n10 .28).
- A ranking prints its values on the bars; at 390 a band axis names every key through a short `x.ticks` label ("Owner", "CI"), where a number only thins the keys away (n18 .68, .75).

## Progress against a target

- Progress against a target is a [Meter](node_modules/basalt-ui/docs/meter.md) with zones (behind pace, on pace, ahead), or a bar of done against the pace on one measure; a rule belongs on bars that measure it. n37's round 0 floated 'Pace: 78' over To do, In progress and In review, which hold points by status, where pace is another quantity; a [Meter](node_modules/basalt-ui/docs/meter.md) with zones draws done against pace (.43).
- The hero stands against the reference the data holds, said once in the hero or its pill: working hours for 'free' time (n35's '5 h free' stood against nothing, .21), the approvals a merge needs for 'stuck' (n36 .31), the 24 h default after which a review goes ahead on its own for 'held up' (n38's 28 stood bare and 'Review ahead in 1 h' left its review unnamed, .55).

## Honest marks

- Every fill a mark uses has a legend entry: a series, or a legend-only entry for a fill with no series of its own. [type:LegendEntry]
- A stepped or binned scale says its step in a caption; a size channel gets a key.
- A fixed row or bar count (`rows={8}`) is derived from the data, so the extreme fixture shows every item: hop 9 hidden behind eight rows, with a headline saying nine hops, is the defect (c10 F5; the bars summed to 18 of 19).
- An incomplete datum (a partial day, a night missing a stage) is marked on its mark (hatched, hollow or a caption on the bar) and named once; a complete smaller value would misstate it (n12 F5: a night with REM missing read as a finished 305 min; c12 F5: today's partial bar read as a finished day; n01 in cycle 2: a zero or absent day drew neither a mark nor a cue).
- The fixture shows its zero and its extreme at rest, so the card is judged with an empty hour and an over-limit value on screen. The extreme reads true: rounding or clamping it away hides it. A zero fixture shows a cue (a dash, a baseline) where the marks would be.
- One value that crushes the rest is capped with `y.domain`: the kit draws the off-scale caret and the tooltip keeps the true value (n26's 420 ms rescaled the axis and flattened every other hop, .79; n24's eleven bars shrank to slivers, .47). A ranking that saturates says how many are hidden (n23's five identical 1,440 min bars with fifteen more cut, .37), and a zero series gets a visible mark: a finished line at zero lay on the baseline rule and read as absent (n25 .64).
- Binned bars carry a unit caption ("per 15 min"). A count axis and a share-of-limit axis carry a caption (`y.title`: "Requests", "% of limit"), and a `y.format` keeps a decimal for a domain under 2 units (ticks `0.5`, `1.0`, `1.5`, where `1`, `1`, `2` repeats a label) (c14, n04, n16).

## Heatmap tools

- A [Heatmap](node_modules/basalt-ui/docs/heatmap.md) shows magnitude by hue, so the cells that answer carry their value: `annotate` returns a short mark for a datum (a two-digit hour, a peak glyph) and `null` for the rest, and the few cells that matter are the few it marks.
- A cell that is partial (a bucket that missed some of its samples) is a `states` entry returned by `getState`, drawn and legended as its own state; without it an hour that missed one to three of its buckets looks complete.
- `tickCols` keeps the column ticks the reader tells time by: the kit thins ticks to 00, 05, 10, which fall on odd hours; list the stops that matter ("00", "06", "12", "18") and they survive.
- Worked, n30 (when the line is busiest): the case passed at 88 and still lost three points to unused tools. Cells that answered ("Busiest Thu 20:15") showed their value only by hue (`annotate`, .38), a partial hour looked complete (`states`, .39) and a bare "0" on Mon 04:00 stood without a key beside hour ticks at 00, 05, 10 (`tickCols`, .40). Two grids on one scale also share one legend and one caption ([one view](#one-view)).

## A time window picks its resolution

- Up to 7 days the bucket is the hour, unless the data itself is daily; beyond that the day. Work that arrives in bursts through the day reads wrong by the day: a daily bar over 7 days hid that most of the work landed in a few hours (software-factory Console, Flow and Improve: 24 h and 7 d by the hour, 30 d by the day).
- The bucket is named on the chart: a unit caption ("per hour", "per day") and x labels for the window's start, now and end.
- A bucket takes the busiest sample (max) for a load-like series (queue depth, CPU, concurrency), so a spike survives the binning (a mean averages it away), and the sum for a count.
- One window control per page (24 h, 7 d, 30 d, opening on 7 d), and every chart on the page follows it. A chart with its own window beside another is two questions on one page.
- A sliding window's query key is quantised onto the data's step with [windowKey](node_modules/basalt-ui/docs/window-key.md), where the step is the bucket.

## Finish of a form the page draws

- A focused item gets its own mark beside the container's ring, and the ring is inset so it clears the text inside.
- Figures in the page's own markup take tabular numerals; every transition is motion-safe; every value is on the ladder.
- A status token is a fill or a border in a CSS module, and text takes a text token, because the lint stops short of a CSS module.

## One tab stop, one answer at 390

- One visualization is one tab stop: focus moves between datums with the arrows through [useChartFocus](node_modules/basalt-ui/docs/use-chart-focus.md), instead of a second grid of focusable cells.
- At 390 a chart keeps a plot tall enough for its axis: n38's was about 130 px with ticks at 0 and 5, so the dots crowded the baseline (.58): give the phone plot the height its ticks need and cut the ticks to the ones that fit. The page keeps one line of detail per item there: n35 dropped every event title at 390 and left detail nowhere (.27), so each item keeps its one line (its title, its time) and the rest folds into the item's detail.
- Keep the column that carries the answer at 390 wide and put the answer above the fold; a column that drops is one the answer can spare.

not guarded:

- Draw no `data ?? []` fallback and no second cursor; charts share one by default and isolate through a cursor group ([chartCursor](node_modules/basalt-ui/docs/chart-cursor.md)).
- A tooltip repeats what the surface already says; every value is reachable without hover.
