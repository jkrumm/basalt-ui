# Fix log: is each class of fix landing less often

## Three lines

- Who opens it, the question, the verb: the factory owner, "Is each class of fix landing less often week over week, and across how many repos?", then "look at" the one class that rose (or leave the rest).
- Figures that answer: 5 of 8 classes landing less often (strip), 31 fixes in the newest week against Nov 7–13 (strip), 5 repos with a fix (strip), and the class that doubled, Flaky tests 3 to 6 (chart figure, accent line, Rising row).
- Identity from `DESIGN.md`: none in this tree; the console look of the shipped cards, ink steps for series, one accent.

## Surface

Four weekly windows, newest first in the data, drawn oldest to newest. One `useChartFocus` over the windows joins the line chart, the two total panes and, through `focusSeries`, the class rows: pointing at a row emphasises that class's line and reads it into the figure's status.

## Datasets

- `fixture.ts`: four windows x eight classes (zeros kept), seeded (mulberry32, seed 79). Source: the fix log. Shape: counts per class and window plus totals and repos per window. Forms: `Lines` (class over weeks), `DataTable` (latest against the one before), `Bars` panes (totals, repos).
- `?fixture=surge`: Flaky tests at 38 in the newest week; the y domain is capped by the kit clamp (`y.domain`), the caret keeps 38 and the table meter keeps 38.
- `?fixture=none`, `?shot-state=empty`: no measured windows. `loading` and `error` hold every slot.
- Zero at rest: Migrations is 0 in all four windows (row Idle, line on the baseline, named at its end). Extreme at rest: Flaky tests doubles.

## One view (1800x1200)

| part                    | question                                                  | x,y w×h          | joins                                                      |
| ----------------------- | --------------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Strip, three cells      | how much landed, in how many repos, how many classes fell | 264,72 1512×100  | nothing (figures with their base)                          |
| Fixes per class (Lines) | is each class falling, and which one rose                 | 264,188 750×846  | focus: windows and class rows                              |
| Movement (DataTable)    | each class's latest count, change and trend word          | 1026,188 750×372 | focusSeries to the lines; p1 + p2 columns sum under 480 px |
| Totals (two Bars panes) | did totals and repos fall across the four weeks           | 1026,576 750×460 | focus: windows, shares x with the lines                    |

No part is full width for four marks; the lower 160 px is empty by the card heights.

## Colour: meaning

- Accent blue: the class that rose (line, table dot, figure status dot). One meaning, chosen from the data.
- Ink steps: every other class line and the two total panes (dark for totals, mid for repos).
- No status hue; every pill is neutral.

## Empty, loading, error

- Empty, one sentence per part with a cause and next step: lines "No week has closed yet. Counts appear once the first one has."; table "Nothing to compare until two weeks have closed."; totals "Totals follow the first closed week." The strip cells stay a dash, no pill.
- Loading: the same slots as ready; the delta slot is held with an empty value.
- Error: one message, a Retry per part (each frame draws its own).

## Fact count

First run printed: `10 fixes`, `8 days`, `7 window`, `7 class`, `7 [7 days]`, `6 classes`, `5 repos`, `5 prior`, `5 landed`, `4 often`, `=base 3` and ten two-word phrases. Last run: `5 class` once, then after the final cut an empty print.

Measures and their one word each: fixes (a count of fixes), repos, class, week (a closed seven-day window; the page title says 28 days once), trend words Falling, Level, Rising, Idle.

## Read aloud

| fact                        | every slot that says it                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 31 fixes in the newest week | strip figure; the last Totals bar label (the mark's own place)                                               |
| 5 repos with a fix          | strip figure; the last Repos bar label                                                                       |
| base for the pills          | delta labels of cells 1 and 2 (`vs Nov 7–13`, from the data); table subtitle "latest against the one before" |
| Flaky tests doubled, 3 to 6 | figure status; accent line and its end label; table row (6, +3, Rising)                                      |
| 5 of 8 classes falling      | strip cell 3; the Falling words in the table (derivable, one word per row)                                   |
| Migrations never landed     | line named at its end; table row (0, Idle)                                                                   |
| the span Oct 24 to Nov 20   | figure period; the x ticks of three panes                                                                    |

Greps: `rg -n 'signed\(' ` gives the two pill values and the table delta is the kit's; `rg -n 'TREND_LABEL'` is used once (the status column); `rg -n 'CLASS_NAME'` feeds the series labels, the announcement and the status readout.

## Pass criteria

1. The strip answers both clauses at rest: 5 of 8 falling, 5 repos with a fix.
2. The rising class is the one accent on the lines, the table and the figure.
3. The zero class is a named line on the baseline and an Idle row.
4. The surge fixture keeps the other seven lines readable and the caret keeps 38.
5. Every state keeps the part order and heights of the ready frame.
