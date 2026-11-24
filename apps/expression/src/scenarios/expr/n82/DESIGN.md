# Planning poker usage: n82

## Three lines

- **Who and decision.** The owner of a small planning-poker site reads the morning digest and decides to leave it or to look into a day.
- **Question.** Was the site used in the last 24 hours, and is anything unusual?
- **Figures that answer.** Clause one: each of the five counts for the last 24 hours with its signed difference to the typical day (the median of the 30 days before), in five cards or in a table of the same five records. Clause two: "3 unusual days" on the chart card and the days that broke a rule in the Rule breaks table. The rule sits on the finding itself: votes over 10 times typical, no activity (all five at zero), users above views.

## Surface

- Section "Last 24 hours" (left, top) with a Cards or Table switch: the five records once, as figure cards or as a table (Measure, Now, Typical, Change). The table joins the five panes through `focusSeries`.
- Rule breaks table (left, below): one column, the day and its finding; each row holds its day through `focusItems`.
- Daily counts chart card (right, 3 of 5 columns): five panes on one x, every pane on the one `useChartFocus`; the dashed line is the typical day and stops before the last bar; the accent bar is the last 24 hours; flagged days carry their value; the 500 votes and the 148 page views are clamped by `y.domain` and keep their true values beside the caret.
- At 390 the order is figures, chart, Rule breaks: both clauses are in the first screen, and the chart's first pane (590 to 683 px) sits fully inside the 844 px fold, so a focus never scrolls the page (checked: host top 590.8 before and after two arrow presses, for the default, quiet and spike fixtures).

## One view (1800x1200)

| Part                                 | Question                            | x,y w x h       | Joins                                 |
| ------------------------------------ | ----------------------------------- | --------------- | ------------------------------------- |
| Section with five cards or the table | Was it used, against a typical day? | 264,72 595x364  | the five panes by series (table view) |
| Rule breaks                          | Which days broke a rule?            | 264,452 595x276 | the day focus, both ways              |
| Daily counts                         | Where in 30 days is it unusual?     | 875,72 901x656  | the one focus, all five panes         |

The lower 470 px of the frame is empty: the question has no other part. All three parts end at y 728 in every phase.

## Colour: meaning

- accent (brand): the last 24 hours bar and its legend entry. Nothing else.
- ink step (mid grey): every other day.
- ink step (dark): the typical-day line and the divider before the last bar.
- no status hue: no state here needs a hand.

## Fact count

First run: `7 counts`, `5 typical`, `4 days`, `4 [typical day]`, `2 [until counts]`, `2 [counts arrive]`. Cut: a second "until counts arrive" sentence, the table headers and aria labels that said "typical day", "days" and "counts" again. Last run: empty print.

Measures and the words for each: votes (Votes, the key `votes` in the readout), estimations, rooms, unique users (Unique users, users), page views (Page views, views), the typical day (Typical day, Typical, "typical" in the spike finding), the window (page title says nothing; section title "Last 24 hours"; the bar is "Now" in tick, legend, row and readout).

## Read aloud

| Fact                             | Every slot that says it                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The window is the last 24 hours  | section title only; the bar is named "Now" in its tick, legend entry, table row and readout, a name and not a restated window |
| Votes in the last 24 hours (4)   | Votes card figure, or the Measures row in the table view; never both at once                                                  |
| The base is the 30-day median    | section summary only; the dashed line is its geometry, the Typical column its number in the table view                        |
| Three days broke a rule          | figure "3 unusual days"; the table lists them                                                                                 |
| Spike (500 votes)                | caret label on the Votes pane; the row names the rule only                                                                    |
| Zero day                         | "0" on the bars; row "No activity"                                                                                            |
| Users above views (14 against 9) | bar labels on two panes; the row names the relation                                                                           |
| Days in use (29)                 | footer only                                                                                                                   |
| A measure's name                 | card or table row, and the pane's y title: two parts, one source (`m.label`)                                                  |

Helpers and maps grepped: `rg -n 'labelOf\(|FINDING|x\.label|MEASURES|countsOf' ExprN82.tsx`. `countsOf` reaches the announcement and the focus readout only (the live region and the figure's period, both on focus). The pane y title repeating the card label is the one repeat the kit forces: a pane has no header of its own.

## Empty, loading, error

| Part           | Empty (cause, step)                                                                   |
| -------------- | ------------------------------------------------------------------------------------- |
| Chart card     | "No counts yet. The counter reports once a day, so look again after its next report." |
| Rule breaks    | "No day to check yet. Findings show up here after the first report."                  |
| Measures table | "No figure yet, so nothing to compare."                                               |
| Cards          | dashes with the pill row held, the sentence stays on the chart card                   |

Loading holds every slot; the frame ends at the same y as ready. Two sources, two retries: the last 24 hours (cards or table) and the daily history (chart and Rule breaks, one Retry drawn once).

## Checks ticked

- Keyboard frame: `basalt-ui shot /scenarios/expr-n82` shot `keys`, two arrows read ("23 Oct: votes 3, estimations 3, rooms 1, users 3, views 16" on one line, the other bars recede, a dot marks the day on every pane's typical line), no page error.
- The figure's readout slot is reserved at rest ("in 30 days, then now"), so the figure region keeps its height on focus.
- Accent counted: one. No bare border. No hand-drawn marks and no hand-drawn svg.
- Light and dark at 1800 and 390 for rest, loading, empty, error, quiet, spike and table.

## Pass criteria

1. The Votes card reads the last 24 hours and its signed difference to the typical day at rest.
2. The chart card says the number of unusual days at rest.
3. The 500 spike and the 148 page views read true at rest.
4. A zero day draws a tick; the last bar's zero is not struck by the typical line.
5. Pointing at a Rule breaks row dims every pane to that day.
6. Focusing the chart at 390 does not scroll the page.
