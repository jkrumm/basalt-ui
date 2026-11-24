# Course catalogue fetch (expr-n76)

## The three lines

- **Who and what.** The owner watches a scraper bank a course catalogue and opens this page to ask: is the fetch still moving, when will it finish, and if it stopped, why? The decision is one verb: resume, wait or fix.
- **Figures that answer.** The pages in the latest hour (0 means stopped), the state word, the pause reason on the span where the bars hit zero, and the finish time. Three clauses, three numbers: rate (figure), why (zone label), when (footer fact).
- **From DESIGN.md.** Identity only; no Direction was supplied, so the stock identity applies.

## Surface

- Left: one chart card, the fetch rate by hour with the pause drawn as a zone and the answer on its own bar.
- Right: the items split by type and state, then the failed items under it. A type row focuses the failed items of that type (`DataTable focusItems`); the hour chart has its own focus and nothing of that grain lies in the table.
- 390: one column in the same order, the answer (rate, state, finish time) in the first screen.

## One view (1800x1200)

| part                     | question                             | x,y w×h          | joins                                                                                      |
| ------------------------ | ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| Fetch rate (ChartCard)   | still moving, why stopped, when done | 264,72 750×720   | hour focus: figure period, bars                                                            |
| Items by type (BarList)  | how far along, per type and state    | 1026,72 750×272  | type focus: failed items                                                                   |
| Failed items (DataPanel) | which items failed, what to do       | 1026,356 750×436 | type focus; priority 1 and 2 columns sum 464 px (item 23 ch, reason 17 ch, next step 9 ch) |

No gap wider than 12 px; both columns end at one height.

## Color: meaning

- accent (blue): now, the latest hour and the items being fetched
- status red: needs a hand, a failure to retry or a pause with no reason recorded
- ink steps: done darkest, then queued, paused and dead links; earlier hours in a mid ink step

## Fixtures

`?fixture=` names: throttle (rest), breaker, recycle, no-reason, moving, spike, finished.

## Fact count

First run, before any cut: `6 pages, 5 items, 5 failed, 4 hours, 4 done, 4 dead, 3 [last 24], 3 [24 hours], 3 [# done], 2 [failed items], 2 [dead link]`.
Last run, on the final source: empty print.

Measures and their words: pace is "rate" and "pages/h"; the pause is "paused" for the fetch and "Paused" for items held; the end is "finish"; items a fetch has banked are "done" everywhere; a failure is "failure" or "Failed".

## Read aloud

| fact                                       | every slot that says it                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| the latest hour's pages                    | figure value; the highlighted bar's label                                                                                   |
| the fetch state (moving, paused, finished) | figure status; one slot                                                                                                     |
| why it stopped                             | zone label on the paused hours (`pauseWord`, one caller); no reason recorded reads in the zone and turns the status dot red |
| when it ends                               | footer fact (`stamp`, one caller)                                                                                           |
| how far along                              | footer fact "Done 375 of 498"; per-type "n done" on each row                                                                |
| pace baseline                              | delta pill, against the 24 h median                                                                                         |
| failures and dead links apart              | table subtitle counts; red and grey status dots; legend segments                                                            |
| window and zone                            | subtitle "Last 24 hours, UTC", once                                                                                         |
| empty sentence                             | one per card, three causes                                                                                                  |
