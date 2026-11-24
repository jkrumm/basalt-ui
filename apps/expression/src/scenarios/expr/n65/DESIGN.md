# n65: the factory week

## The three lines

- Who: the factory owner, reviewing the week. Question: which friction reason grew the most, and is the loop ending in done work or in dropped work. Decision: where to spend the next week, on the friction that is rising or on why work is dropped.
- The answers: the fastest riser (Review wait, +9 against W46) and the share of ended Issues that are done (65 %, with 25 % dropped).
- Reads from the repo `DESIGN.md`: Identity only; this file narrows nothing.

## Surface

Parts: two answer cards, two charts on the weeks (outcomes, fix commits), the friction table, and the idle hours by day.

| part                                                                 | question it answers                                                     | x,y w×h at 1800x1200 | what it joins                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| Fastest riser (StatCard)                                             | which reason grew most                                                  | 264,72 750×172       | reason focus (sub reads the focused row)                 |
| Done share (StatCard)                                                | done or dropped, as a share                                             | 1026,72 750×172      | week focus (sub reads the focused week)                  |
| Issues by outcome (ChartCard, stacked bars)                          | how each week's Issues ended, the zero week                             | 264,256 750×324      | week focus, one cursor with the commits                  |
| Fix commits by finding class (ChartCard, lines)                      | which finding class drives the fixes                                    | 1026,256 750×324     | week focus, beside the outcomes                          |
| Friction reasons (DataPanel, DataTable; a Meter cell draws the rise) | the twelve reasons against the week before                              | 264,592 750×500      | reason focus, by id                                      |
| Idle capacity per day (ChartCard, 56 daily bars, weekends paler)     | is capacity idle while work is dropped; the most-dropped week is tinted | 1026,592 750×500     | its own day focus (no chart-to-chart join across grains) |

The reasons table has no chart to join, so it keeps its own focus over its rows; the day chart cannot join the week items, so a tinted week ties it to the dropped work instead.

At 390 the order is the two answer cards, the outcomes, the commits, the friction table as twelve labelled cards, the idle bars.

## Datasets

- Friction reasons, 12 rows with the count a week before and now: DataTable (more than seven classes); a new reason carries "New"; the rise is a bar in the accent for the fastest riser.
- Issue outcomes, 8 weeks, four classes: stacked bars; W43 ends no Issue done, drawn as a zone with its label.
- Fix commits per finding class and week: four lines named at their own ends, the zero line end lifted off the baseline.
- Idle capacity, hours for each of 56 days: bars, weekends paler; the 21.5 h and 0 h days are named, the most-dropped week is tinted.
- Fixture names: none for the rest state; `?fixture=surge` puts Gate flake at 142 reports and one week at 58 dropped.

## Color: meaning

- accent (blue): the fastest riser's bar, and nothing else.
- status red: dropped Issues (segments, the share's status dot).
- dark ink: done Issues, the leading finding class; paler ink steps: cancelled, open, the other classes, idle hours.

## Fact count

- First run (round 0): week 16, done 11, idle 7, ended 7, reports 6, reason 5, issues 5, issue 5, hours 5, dropped 5 and more.
- Last run (round 2): empty.
- Measures and their words: Issues ended (ended); friction (reports, reasons); idle (idle, capacity, hours); fix commits (commits, class).
- Facts and places: the twelve once (the footer "7 of 12"); 20 ended once (the outcomes figure); 65 % done and 25 % dropped (Done share card; the last bar names 13 and 5); 21.5 h (the dot label); the zero week (the zone label); the new reason (its table cell and the footer).

## Pass criteria

1. The Fastest riser card names the reason and its change against W46; the table lists it first with the longest bar.
2. The Done share card carries done and dropped as shares; the last bar carries both counts.
3. W43 is marked on the bars as a week with no done Issue.
4. A focused week reads in each card's status with its own week id; the figures stay W47's.
5. Loading holds every slot; empty and error say what to do and which part failed.
6. A keyboard step on a weekly chart focuses a week and the other weekly chart follows; the day chart steps days.
7. Error shows one Refresh at the page top, no retry on the cards; empty on the answer cards offers Reload.
