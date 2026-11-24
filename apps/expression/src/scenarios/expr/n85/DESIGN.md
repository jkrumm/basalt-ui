# Self-improvement loops, 7 and 30 days (expr-n85)

## The three lines

- Who opens it: the factory owner. Question: do the loops pay their way, per loop, over the last 7 and 30 days? Decision: keep, retune or stop a loop.
- Figures that answer, one per clause: Issues opened (cell 1: 40, with the past week's 12), closed with a measured gain (cell 2: 13), dropped as noise (cell 3: 12), still open (cell 4: 6, 3 opened today). Per loop and window: the outcome split (bars), gain and dropped counts and the median hours to close (table).
- Reads from DESIGN.md of the app: none (the playground has no Identity block).

## Surface

Parts: a strip of four cells (one clause each), a stacked bar list of outcomes per loop and window, a table of the counts the bars do not print, and the open Issues. All three lists are one focus: the loop and window rows are the one grain (8 rows), and an open Issue holds every loop-window row that counts it (`focusItems.holds`), so pointing at an Issue lights its loop's 7-day and 30-day rows and the reverse.

At 390 the strip comes first (answers above the fold), then the bars, then the two tables as phone cards (`phone: 'columns'`: loop, gain, dropped; the median is in the row's details).

## One view (1800x1200)

| part                     | question                                       | x,y w×h          | joins                                                                                    |
| ------------------------ | ---------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| Strip, 4 cells           | the three clauses plus what is open            | 264,72 1512×116  | none (totals); pills compare the past week with the 30-day base                          |
| Outcome per loop         | how did each loop's Issues end                 | 264,204 492×452  | focus: loop-window rows                                                                  |
| Counts and time to close | gain, dropped and median hours per row         | 773,204 1003×372 | focus: same rows; priority 1 and 2 columns fit (container 1003 px, over the 800 px tier) |
| Issues to chase          | which open Issues, and which were opened today | 773,592 1003×308 | focusItems: an Issue holds the rows that count it                                        |

Checks: no two parts answer one question; no full-width part of four rows; no card-wide gap in the first 1200 px; every part joins. The lower 300 px of the frame is empty page, not a card band (the bar list takes its rows' height).

## Colour: meaning

- blue (accent): Issues that closed with a measured gain (bar segment and legend only)
- ink, dark: dropped as noise
- ink, mid: closed, figure unmoved
- ink, light mid: closed, not measured (loops with no pass record)
- ink, pale: still open
- no status hue; every pill is neutral (no direction is the page's one status).

accent: closed with a gain (one measure at one grain).

## States

- loading: every slot of the ready frame is held (pill and sub lines passed empty), tables hold 8 and 6 rows.
- empty: no loop has opened an Issue; each part names its cause and step once ("Nothing opened yet. The first finding lands here.", counts, open Issues). Strip shows dashes.
- error: one `retry` for one source (the ledger); the strip draws one Retry, each list its cause line.
- `?fixture=surge`: Lint drift files 161 Issues in 30 days; every scale holds it. `?fixture=idle`: no Issue in either window, real zeros, medians dashed, the open list empty.
- Rest data: one loop (Docs drift) with no Issue in 7 days (zero bar, dashed median), two loops with no pass record (dash in Gain, light-grey segment), Lint drift with 30 Issues and 9 dropped, three Issues opened today.

## Fact count

First run (before cuts): 8 issues, 7 opened, 7 open, 7 loop, 6 gain, 6 [30 day], 5 issue, 4 rate, 4 noise, 4 dropped, 4 days, 4 closed, [filed today], =opened_base, =noise_base, =gain_base and a dozen phrases. Last run, on the final source: empty print.

Measures and their words: Issues opened (Opened, opened, Issues); gain (Measured gain, Closed with a gain, Gain; "gained" only in the announcement); dropped (Dropped as noise, Dropped; "noise" in the announcement); open (Still open, Open, "open" in the announcement); time to close (Median hours to close); age of an open Issue (Age in hours).

## Read aloud (1800 rest frame)

Greps run: `rg -n 'windowLabel|shareSub|todayWord|openedSub|LEGEND|HELD' ExprN85.tsx`; label maps: `LEGEND` (bars and legend only), `WINDOW_LABEL` (fixture; row label, table sub and announcement per row, each a different part).

- Issues opened in 30 days, 40 | cell 1 figure
- Issues opened in the past week, 12 | cell 1 sub (the pill's +29 % is that 12 against its 9.3 a week base)
- Measured gain, 13 | cell 2 figure; its base 33 % in the pill; the week's 3 of 12 in the sub
- Dropped as noise, 12 | cell 3 figure; base 30 % in the pill; the week's 1 of 12 in the sub
- Still open, 6 | cell 4 figure
- Opened today, 3 | cell 4 status; the three rows marked "Today" in the open list name them
- Lint drift, 30 Issues | bar row value; its 9 dropped and 11 gain | table cells
- No pass record | table subtitle; the dash in Gain
- Median hours to close | table column (meter + number)
- Window (7 days, 30 days) | each row's label in the bars, the table's sub line

## Owner self-check

- accent counted: one (gain). No bare border (none written). Hover and focus swept in the shots: the bars, the table row and the open list dim and light together.
- Redraw: no hand-drawn mark; the strip, bars, tables and meters are the kit's.
- Records as table: the bar list's rows are also a table.

## Kit lacks (cycle-expression-17)

- BarList prints only the row total: the gain and dropped counts of a stacked row need the table beside it.
- A BarList or DataPanel stretches to its grid row; a wrapping `div` with `items-start` hugs it.
- StatCell has no way to say "week against month" except `sub` and the pill label; the held slot for a pill must be passed as an empty-valued `Delta`.
