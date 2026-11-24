# Speech model for each preset (expr-n80)

## The three lines

- Who opens it: the owner, choosing a speech model and voice for each use (chat, briefing, podcast). Decision: pick.
- Question: which model and voice does a blind listen prefer for each preset, and at what latency and cost a minute.
- Figures that answer: per preset the preferred model with its voice, first audio, cost a minute and verbatim share (strip), the rank of all five models against cost (chart), every candidate's numbers (table).

## Surface

- Strip (three cells, one per preset): the answer at rest. A tie is a sub line on the cell, the cheaper of the tied models is the figure.
- Chart card, three stacked panes on one cost axis (log): one dot per model, higher is preferred, the preferred dot in the accent, each dot named. Same grain as the table (one candidate = one model in one preset), so one focus joins them.
- Table (`DataTable focus`): the 15 candidates grouped by preset, scrolls nowhere at 1800. Total latency, verbatim and the preset column are priority 3 and show only where the table is wider than the kit allows at this width; the strip carries the winner's verbatim.
- At 390: strip, chart, table as phone cards; the answer is in the first screen.

## Datasets

- 60 samples (3 presets x 5 models x 4), 40 blind-ranked in 8 listening sets, 4 without latency, one model ten times the cheapest, one preset (briefing) tied for first. Form: `fixture.ts`, seeded by hand-set rank sets and a fixed generator.
- Fixtures: default, `unranked` (podcast has no blind rank), `slow` (Orate answers 12 times slower).

## One view (1800x1200)

| part           | question it answers                                        | x,y w x h       | joins                |
| -------------- | ---------------------------------------------------------- | --------------- | -------------------- |
| strip, 3 cells | which model and voice per preset, at what latency and cost | 264,72 1512x196 | none (the answer)    |
| chart card     | how the five models rank against their cost, per preset    | 264,284 595x692 | focus with the table |
| table          | every candidate's numbers                                  | 875,284 901x692 | focus with the chart |

Table columns: priority 1 and 2 (Model, Rank, First audio, US$/min, Total) sum about 544 px by the kit's formula, so the table needs the 880 px cell it has.

## Color: meaning

- accent blue: the model a blind listen prefers for its preset (strip has none; chart dots and legend).
- ink step: every other model.
- status hue: none.

## Fact count

First run printed 18 lines (rank 10, preset 6, model 6, ranked 5, mean 5, first 5, samples 4, price 4, preferred 4, minute 4, blind 4 and 7 phrases). Last run prints `2 [first audio]`: the strip row and the table column name one quantity with one word, and are kept apart on purpose (row label against column header).

Words per measure: latency to the first sound "first audio" (strip row, table header); whole synthesis "total" (table header only); cost "cost a minute" (strip row), "US$ a minute" (x axis, unit), "US$/min" (table unit); blind placement "rank" (axis, header, readout), "mean rank" (axis title).

## Read aloud

| fact                               | every slot that says it                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| preferred model of a preset        | strip figure; chart: the dot's name and its accent; table: the row (not marked)                                                              |
| its voice                          | strip row; table row sub line                                                                                                                |
| mean rank of the preferred         | chart label ("Voxa 1.3"); table Rank cell; the strip pill says it as a difference ("-1.7 vs 3 average", derived, one measure in two numbers) |
| first audio, cost of the preferred | strip rows; table cells                                                                                                                      |
| tie                                | strip sub line (briefing); two accent dots on one rank in the chart                                                                          |
| cost spread                        | chart figure (10x); x ticks name the five prices                                                                                             |
| samples ranked, without latency    | chart footer only                                                                                                                            |
| sort and window                    | table subtitle ("best first", "median of four samples")                                                                                      |

Helpers grepped (`rg -n 'money\(|rank\(|reading|PRESET_NAME|LEGEND'`): `money` prints cost in the strip row, the x ticks and the readout; `rank` prints the label, the pill and the readout; `reading` is the announcement and the figure period (one string); `PRESET_NAME` labels the cells and the pane titles; `LEGEND` is the legend and the series labels. Each caller is a slot above.

Kept repeats: the winner's numbers stand in the strip and in the table (the strip is the answer, the table the detail of fifteen); the rank difference in the pill beside the label.

## Escape hatches and gaps

- `cycle-expression-16` markers: reversed y domain (the axis plots the negated rank), direct labels on a dot series (a `text` mark placed by `chartLabels`), a group-by column that the table also shows.
