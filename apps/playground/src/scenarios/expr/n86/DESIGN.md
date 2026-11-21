# Hygiene checks (expr-n86)

## Three lines

- Who: a project owner, after the weekly sweep. Question: which checks came back clean, which found work, which were skipped or failed, which never ran. Decision: fix, look at or start a check.
- Figures that answer: four counts, one per clause of the question (clean 9, found work 4, skipped or failed 3, never run 1), each with its share of all checks; 17 findings on the found-work cell; 1 failed on the other.
- Reads from DESIGN.md: neutral surface, one accent, one status hue.

## One view (1800x1200)

| part                                            | question                                                  | x,y w x h          | joins                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Result counts strip (StatGroup cards, 4 cells)  | how many checks in each state                             | 264,72 1512 x 100  | nothing: counts of groups, no per-item grain                                              |
| Latest results (DataPanel + DataTable, 17 rows) | which check, what result, why, how many findings, how old | 264,188 1512 x 660 | one `useChartFocus` over the 17 rows, `DataTable focus`; live region rendered by the page |

Priority 1 and 2 columns (Check, Result, Detail, Findings, Days since last run) sum well past 480 px; the table runs full width. No part restates another: the strip counts, the table lists. The page ends at y 848, content-sized.

## Colour, one meaning each

- blue (accent): found work (strip status dot, table status dot).
- red (status hue): failed.
- ink steps: clean, skipped, never run, every meter. No series file group: no mark of mine needs a series colour.

## Surface notes

- Age is `c.meter` scaled to the oldest (90 days, the true value, no cap under the data); findings is `c.meter` scaled to the largest (12). Absent values print a dash, a zero is a zero.
- 390: `phone: 'columns'` keeps Check, Result and Findings; the reason, the age, cost class and cadence sit in each row's details.
- Unswept fixture: all 17 checks never run, counts 0 / 0 / 0 / 17.

## Fact count

First run printed: `6 checks`, `5 hygiene`, `4 [hygiene checks]`, `2 [weekly sweep]`, `2 [never run]`, `2 [found work]`, `2 [checks add]`, `2 [# findings]`. Cut: the unit "checks" on four cells, the repeated empty sentence, "hygiene" in table label and messages, "findings" in the live region.
Last run printed: `2 [never run]`, `2 [found work]`. These two are the strip cell label and the table's Result word for the same state, at two grains (a count, a row). Left standing because both slots are the state's only name; the strip label cannot take a different word without splitting one state in two.

Measures and their words: checks (check, checks), result (result, status never printed), findings (findings, to fix in the live region only), age (Days since last run, last run in the live region), cost (Cost class), cadence (Cadence).

## Read aloud

| fact                   | every slot that says it                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| 9 clean                | strip cell "Clean" value                                                       |
| share of all           | strip pill, one per cell (`share()` called four times, each a different count) |
| 17 findings            | strip status on Found work; the Findings column rows hold the per-check counts |
| 1 failed               | strip status on Skipped or failed; Result column "Failed" on its row           |
| skipped reason         | Detail column on the two Skipped rows                                          |
| 90 days since last run | Days since last run meter on image-scan                                        |
| a check's state        | Result column; the live region repeats it on focus                             |
| sort and window        | subtitle "Work first, then clean"                                              |
| empty cause            | DataPanel `empty`, once                                                        |
| error message          | strip, once with the retry; the table says only the title                      |

Greps run: `rg -n 'STATUS_LABEL|share\(|count\(' ExprN86.tsx` (STATUS_LABEL: Result column and the announcement; share and count: four cells).

## Owner self-check

- accent: found work only.
- bare borders: none written.
- hover sweep: hover and focus crops compared against rest, the table does not move.
- redraw test: no marks of my own.
- records as a table: the page is the table.

## Frames opened

rest, loading, empty, error, unswept, light and dark at 1800 and 390; hover, focus and keys (two arrows, row focused, no page error) from `basalt-ui shot`.
