# n94 detector noise: design

## The three lines

- Who: the factory owner who reviews detectors that file Issues unasked. Question: which detectors file mostly noise and by how much past the mute line, which muted one is due to be asked again, which has too little history to judge. Decision: mute, ask again, or wait.
- Figures that answer: 6 past the line of 11 judged (hero); the points past the line on each bar; Stale branches as the one to ask again (footer); 3 of 14 with too little history (footer).
- Reads from DESIGN.md of the playground: Identity inherited, no deviation.

## Surface

| part                                                              | question it answers                                                   | x,y w x h (1800) | what it joins                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| Detectors past the mute line (ChartCard, bars, mute line at 50 %) | which detectors file mostly noise, how far past the line              | 264,72 750x564   | one useChartFocus over the detector rows                       |
| Mute status per detector (DataPanel, DataTable)                   | which is muted, which mute ran out, which is under the floor or empty | 1026,72 750x564  | the same focus by row id; one bar and one row are one detector |

Side by side at the wide container, stacked at 390 with the chart first. Both end at one height. The lower half of the 1800 frame is empty because 14 rows are all the data holds.

## Records line

14 detector records of one shape: the table is the records view, the chart is the ranking.

## Color: meaning

- accent (brand): a detector past the mute line, set by the bar series highlight; one class.
- mid ink: a detector on or under the line. Dark ink: the mute line. Status amber: Ask again, the one state that needs a hand. No other hue.

## Phases

Loading holds the figure, legend, footer and table skeleton slots; empty states the cause and the next step once (chart card), the table says "Nothing to list."; error names the cause on each card with its own Retry.

## Read aloud (1800 rest shot)

- Share of decided Issues dropped | chart subtitle only (bars print the percent; the axis has ticks)
- Past the mute line | chart title; legend "Past it"; bar labels print the points past
- 6 of 11 judged | hero value and unit
- 50 % mute rule | table subtitle; the mute line label says "Mute line" with no number
- Stale branches due to ask again | footer fact; table verdict "Ask again" on its row
- 3 of 14 under the floor | footer fact; the two bars with no value carry their count ("2 of 2", "none"); table verdict
- Noise count per detector (8 of 10) | table column only
- Open Issues with none decided (4 open) | table count cell of Env drift only; Open Issues column at wide widths
- Mute end date | table column "Mute until" only

## Pass criteria

1. The hero carries a count of judged detectors past the line.
2. The mute line is drawn and labelled; each bar past it prints its points past.
3. The exactly-half detector (Lockfile drift) is on the line, not muted.
4. A detector with nothing decided prints "none", not 0 %; one under the floor prints its count and has no bar.
5. A mute that ran out reads "Ask again" in the one status hue.
6. Pointing at a bar or a row focuses the other; arrow keys step both.

## Fixtures

`?fixture=quiet` no detector past the line; `?fixture=young` every detector under the floor; `?fixture=extreme` one long-named detector with 212 decided Issues.
