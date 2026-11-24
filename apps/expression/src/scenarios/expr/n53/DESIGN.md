# Ledger rewrite plan (expr-n53)

## The three lines

- Who: the factory owner, opening one project's plan. Question: how far along is it, which rows are blocked, which row can start next. Decision: "unblock" the stuck row or "start" the next one.
- Figures that answer: 17 of 40 rows done (meter against the 40); 1 blocked row, Backfill legacy entries, holding back 5, open 34 days; 6 rows can start, Cursor pagination first because it holds back 6.
- Reads from DESIGN.md: neutral surfaces, one accent, one status hue.

## Surface

| part                                                | question                                   | x,y w x h (1800x1200) | joins                                            |
| --------------------------------------------------- | ------------------------------------------ | --------------------- | ------------------------------------------------ |
| Plan progress, Blocked, Can start (StatGroup cards) | how far, which blocked, which next         | 264,72 1512x146       | the figures name rows of the chain and the table |
| What waits on what (DataPanel, ChainView)           | what blocks what                           | 264,235 902x900       | one focus with the table                         |
| All rows (DataPanel, DataTable)                     | every row's state, the three with no Issue | 1180,235 596x900      | one focus with the chain, by row key             |

- At 390: strip cells two to a line, then the chain as a nested list (each row under its first blocker, the rest named), then the table as cards.
- The chain draws the unfinished rows; the 17 done rows are in the table (a marked workaround in the code).
- The table keeps Row and State at 596 px; Holds back, Days open, Filed and Closed are priority 3 and show at 800 px and up or on the phone cards.

## Datasets

- 40 plan rows (key, title, state, waits on, filed, closed): a graph that waits on itself, so ChainView over the same rows on one `useChartFocus` beside DataTable.

## Colour: meaning

- accent: the row that can start next (the status dot in the Can start cell and the Start next state).
- status red: the blocked row, one dot in the Blocked cell and one state in the table.
- ink steps: every other state (done, open, waiting).
- warn edge: ChainView's own colour for an edge out of an unfinished row (kit-owned).

## Fixtures

- Default: one blocked row with five rows behind it, three rows with no Issue yet, a zero delta (2 closed this week and the week before).
- `?fixture=clear`: no blocked row (zero blocked); Backfill becomes an open row.
- `?fixture=stalled`: every open row waits behind the blocked row (zero can start, 22 rows behind it).
- `?shot-state=loading|empty|error`: each part keeps its place and height.

## Fact count (`rg` word count over the page strings, words said four or more times)

- First run: rows 13, plan 8, blocked 5, holds 4, back 4, closed 4, neutral 4.
- Last run: waiting 4, neutral 4, closed 4, blocked 4, behind 4. All five are state keys, tone keys or one column and cell label sharing a code identifier; no prose string repeats a word four times.

## Pass criteria

1. The strip carries a number for each clause: 17 of 40, 1 blocked, 6 can start.
2. The blocked row and the next row are named on their cells and drawn in the chain.
3. Pointing at or stepping to a row in the chain or the table focuses it in the other.
4. Loading, empty and error keep every part in its place; no subtitle or figure reads from rows in flight.
5. At 390 the strip and the first chain rows sit above the fold.
