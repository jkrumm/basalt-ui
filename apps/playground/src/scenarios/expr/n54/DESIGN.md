# Work inbox, last 14 days (expr-n54)

## The three lines

- Who: an employee clearing the work inbox. Question: which sources bring the most mail this week, and how much of it is still untagged. Decision: triage (tag the biggest untagged source first).
- Figures: 292 messages in the last 7 days (+6% vs the 7 before); 86 of them untagged; 34 untagged mail older than 7 days; the oldest untagged is 13 days old.
- Window: 14 days ending Thu 19 Nov 2026 UTC; "this week" is the last 7 complete days.

## Surface

One focus over source-by-day cells (8 sources x 14 days). The grid shows when, the stacked list shows how much and how much is untagged, the figure follows either (a cell, or a source row held as its 14 cells).

| part                                        | question it answers                              | x,y w x h (1800) | what it joins                                                                           |
| ------------------------------------------- | ------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------- |
| Mail by source and day (ChartCard, Heatmap) | when did each source send, which day spiked      | 264,72 750x538   | the one focus (cells); figure, delta, status and footer read the focused cell or source |
| Most mail, tagged or not (BarList, stacked) | which sources lead, how much of each is untagged | 1026,72 750x430  | the same focus through focusItems (a row holds the source's 14 cells)                   |

Checks: no two parts answer one question twice (grid = time, list = amount and tag state); no full-width part; no card-wide gap; both parts join the focus. The BarList card ends 108 px above the chart card: BarList has no fill-height, named as a kit gap.

## Colour: meaning

- accent blue: untagged mail (segments, legend). Amber dot: untagged mail older than 7 days (the one state that needs a hand). Ink steps: tagged mail, the heat ramp, the 3x annotation.

## Fixtures

- default: 568 messages, Platform alerts tripled on Mon 16 Nov (20 vs 7 to 8), 34 untagged older than 7 days.
- tidy: every message tagged, zero untagged, no oldest (a zero).
- flood: Platform alerts at 81 on Monday (an extreme; the heat scale and ranking keep it true).
- Loading, empty and error are `?shot-state=`.

## Pass criteria

1. The figure at rest names the week total, its base and the untagged-over-7-days count.
2. The tripled cell carries its multiple on the mark.
3. Pointing at a list row lights its source across the grid; stepping with arrows over the grid updates the figure and lights the list row.
4. Loading holds both frames at their ready height.
5. At 390 the figure row keeps its value, delta and status above the grid.
