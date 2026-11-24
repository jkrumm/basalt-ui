# Daily activity (expr-n93)

## Three lines

- Who: an athlete returning to training, checking day-by-day movement. Question: how many vigorous and moderate minutes and steps did each day carry, and which days have no reading at all? Decision: sync the watch or trust the days that are there.
- Figures: 3 of 90 days missing (22 Oct to 24 Oct); the median vigorous day (19 min) as a rule on the minutes pane; peak day 8 Oct, 238 min; median 7,372 steps.
- Identity: the shipped console card; neutral ink steps, one accent (the brand tint) spent on the gap.

## Colour: meaning

- brand tint: days with no reading (a zone on both panes).
- dark ink: vigorous minutes. pale ink: moderate minutes. mid ink: steps and the median rule.

## Datasets

- Watch export, one row per day: vigorous min, moderate min, steps, score. A null field is a reading never taken. Form: grouped `Bars` (vigorous beside moderate) over a steps pane in a two-pane `ChartCard`, the list as `DataTable` on the one focus.

## Read aloud

| fact                    | every slot that says it                            |
| ----------------------- | -------------------------------------------------- |
| days missing            | figure value and unit                              |
| which days they are     | figure period (at rest)                            |
| no reading              | the zone caption on the minutes pane only          |
| median vigorous minutes | the dashed rule label on the minutes pane          |
| median steps            | the dashed rule label on the steps pane            |
| peak vigorous day       | footer pair                                        |
| a day's three numbers   | figure period on focus, live region, table row     |
| a day with no score     | footer pair, the "No score" note in the Day column |

## One view

| part                   | question it answers                             | x,y w×h         | what it joins               |
| ---------------------- | ----------------------------------------------- | --------------- | --------------------------- |
| Minutes and steps card | how much each day carried, which days are blank | 264,72 750×800  | one focus with the table    |
| Days table             | the same days as numbers                        | 1026,72 750×800 | the card's focus, both ways |

## Fixtures

- `?fixture=short` is a fortnight with every day present: zero gap days, one real zero (0 vigorous), one day with steps and no score.
- The default is 90 days: a 3-day device reset (null, not zero), one day with steps and minutes and no score, one 238-minute vigorous day against a median near 19.

## Pass criteria

1. The figure counts the blank days and names them at rest.
2. The blank days are a labelled zone on both panes, not a zero bar.
3. The 238-minute day is capped on the minutes pane and read true in the footer.
4. Chart and table share one focus; arrow keys step days and the period reads the day.
5. Loading, empty and error keep both cards at their ready height.
