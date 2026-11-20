# n77: did each app's deploys land cleanly, and which day or app broke

## The three lines

- Who opens it: an owner who leaves the deploy board open and glances at it. The question: did each app's deploys land cleanly over the last two weeks, and which day or app broke. The decision after reading: look into one app and one day, or leave it.
- The answer figure: 3 failures in a row, billing, Thu Nov 12, recovered 13:20. Both clauses have a number at rest: the day (the 4 on the all-apps row at Nov 12) and the app (the 3 on billing's cell and in the Failed column).
- From the repo's DESIGN.md: neutral by default, one status hue for the one state that needs a hand (a failed job), mono for ids and times.

## Surface

Two parts answer the one question and join one focus (`useChartFocus` over the heat cells): the heat grid (app by UTC day, last row all apps) and, beside it, the per-app table and the list of jobs not finished. Pointing at a table row holds the app's 14 cells (`focusItems`); pointing at a cell lights the figure's period and status; the list holds the app's cell of 20 Nov.

## One view (1800x1200)

| part                                                                  | question                        | x,y w×h          | joins                                                                                                |
| --------------------------------------------------------------------- | ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| Deploy failures by app and day (ChartCard, Heatmap, 7 rows x 14 days) | which day or app broke          | 264,72 750×539   | the one focus; figure period and status read it                                                      |
| Apps (DataPanel, DataTable: App, Landed meter, Failed)                | how cleanly did each app land   | 1026,72 750×307  | `focusItems`: a row holds the app's 14 cells (all three columns are p1 or p2 and show at half width) |
| Unfinished jobs (DataPanel, DataTable: App, State, Image tag)         | what is still running or queued | 1026,392 750×219 | `focusItems`: a row holds the app's cell of 20 Nov                                                   |

The right column ends at the heat card's height in the ready, loading, empty and error frames. At 390 the order is the heat card, the Apps table, then the unfinished list; the three heights match between ready and loading (470, 392, 288).

## Colour: meaning

- status red: a job that failed (cell ramp 1 to 4+; the figure status dot only while a failed cell is focused).
- ink steps: clean (mid), past the cap (pale), no deploy (palest), each a flat fill with its own legend swatch drawn the way its cells look; no glyphs, so swatch and cell are one thing.
- no accent series: the page has none; the one hue is the status red. Accent count: 0.

## Fixtures

- default: 200 jobs, three quiet days, billing 3 failures in a row on 12 Nov then recovered, 2 running and 1 queued, web listed from 10 Nov only.
- `?fixture=clean`: the same list with no failed job: figure 0 failures in a row, status "No failures", every table row 100 and 0.
- `?fixture=storm`: the extreme: web fails 19 times on 19 Nov; the colour domain is capped at 4, the ramp ends "4+" and the cell prints its true value; the table shows 65.6 for web.
- `?shot-state=loading|empty|error`: every slot held (footer label kept, value empty), an empty cause per part, one Retry for the one source.

## Fact count

First run, round 0 source: `10 failed`, `7 landed`, `7 deploy`, `6 jobs`, `5 last`, `5 days`, `4 newest`, `4 finished`, `4 apps`, `[newest jobs]`, `[200 newest]`, `[14 days]`, `[# failed]`, `[landed #]`, `[failed #]`, `[# landed]`. Round 1 first run printed `5 jobs`, then `4 running`, `4 queued`, `4 jobs` after each cut. Last run: empty print.

Measures and their words: a job that did not land: "failed" (cell reading, Failed column, footer; "failures" in the title, the unit and the all-clear status); a job that did: "landed"; a job not done: "Running" or "Queued" in the unfinished list only; an app-day with no job: "No deploy" (legend, focus reading); days with no job at all: the empty columns of the all-apps row, said nowhere else.

## Read aloud

| fact                                                 | every slot that says it                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| the answer: 3 failures in a row, billing, Thu Nov 12 | figure value and unit, figure period (`restPeriod`, one use)                                                       |
| billing recovered at 13:20                           | figure status (`restStatus`, one use)                                                                              |
| failed total 9 of 197 finished                       | footer fact; the Failed column is per app, another grain                                                           |
| which day broke                                      | the 4 on the all-apps row at Nov 12                                                                                |
| the three quiet days                                 | the empty all-apps cells, named by the x ticks; no footer, no legend note (the legend says what an empty cell is)  |
| web is listed from 10 Nov only                       | legend entry "Past the cap" with its note; the focus reading of those cells reuses the entry's word (`stateLabel`) |
| no deploy for one app on one day                     | legend entry "No deploy"; same focus reading                                                                       |
| jobs not finished: 2 running, 1 queued               | the Unfinished jobs list only (the heat cells carry no in-flight state)                                            |
| landed share per app                                 | Apps table meter (`rg -n landedPct`: one column)                                                                   |
| window: 14 days                                      | page title only; the columns carry the days                                                                        |
| cap: 200 newest jobs                                 | card subtitle; the legend names the cells it cuts                                                                  |
| unit and top colour of the ramp                      | legend title "Jobs per cell, the top colour from 4" and end label "4+"                                             |
| empty sentences                                      | one per part, each with its own cause and step; one Retry for the one failing source                               |

Helper greps run: `rg -n 'reading\(|outcome\(|stateLabel\(|appName|dayName\(|spanOutcome'`: `outcome` reaches the figure status and the announcement (the same counts, the readout and the live region); `appName` is the row label, the focused period and the announcement.

## Pass criteria

1. The figure answers with a verb, a number, an app and a day; the all-apps row names the broken day on the mark.
2. The cap is a state on the cells it cuts, never a zero.
3. Every part has a loading, an empty and an error frame that holds its footprint at 1800 and at 390.
4. A table row and a heat cell are the same app: one focus, both ways, with the keyboard too.
5. Every 390 header, tick and legend swatch fits whole.

## Workarounds (cycle-expression-16)

- At 390 the heat axis names every third day itself (`stepCol`, `STEP_DAYS`): the kit's thinning stepped unevenly once every day was named, and no container-class hook reaches a tick stride, so the viewport class chooses.
- Both DataPanels state a height at 390: the loading box counts phone cards per row even for a `phone: 'columns'` table and counts the header row as a card, so the skeleton ran taller than the loaded list.

## Kit gaps met

- A legend swatch cannot carry a state's glyph, so no state uses one.
- A `DataTable` with `phone: 'columns'` clips a header at 390 unless the identity column is `width: 'content'`.
