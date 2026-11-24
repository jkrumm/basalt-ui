# Model router picks (expr-n64)

## Question

- Who opens it: the owner checking the model router.
- The one question: which target took the picks each day, how many were refused, and why.
- The figures that answer it: refused total with its base (card 1 figure), the leader at rest (status), the top reason (footer), the day that was refused most (footer), and the cache-hit share per caller (card 2).

## One view (1800x1200, light)

| part                                            | question it answers                                         | x,y w×h          | what it joins                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Picks by day (stacked bars, card 1)             | which target took the picks each day, how many refused, why | 264,72 750×539   | one day focus with the table; its figure period and status follow it                                                              |
| Targets and refusals (DataPanel table, 15 rows) | the leader and the refusal reasons of each day by name      | 1026,72 750×563  | the same day focus (`DataTable focus`); priority 1 and 2 columns sum to about 430 px (Day 72, Leader 72, Refused 120, Reason 168) |
| Cache hits by caller (heatmap, card 2)          | did a caller stop hitting the cache                         | 264,648 1512×545 | its own cell focus; its figure period and status follow it                                                                        |

No part answers another part's question; every part is inside the 1200 px fold. Cards 1 and the table end 24 px apart (539 and 563 px), the kit gives the chart card no way to match a panel's height. At 390 the order is bars, heatmap, table, so the answer and the cache finding come before the 14 day cards.

## Colour: meaning

- ink steps (dark, mid, pale): the target that took the picks (iu, me, iu-api)
- blue (the accent): a day another target than iu led, painted on that target's segment
- status red, three steps: refused, split by reason (quota strongest, policy, model down palest); the heatmap's red state is the one caller at 0 %
- ink ramp (heatmap): cache-hit share, darker is more

## Measures and their words

- picks: the requests the router decided (never "requests"); refused: a pick no target took (never "denied" or "rejected"); led: the target with most picks on a day; hit: a pick answered from cache; not logged: a day or a cell with no pick (the cause, the gateway being down, is said once on the bars).

## Fact count

First run (before cuts): picks 14, caller 9, label 6, share 5, cache 5, refused 4, gateway 4, down 4, days 4, {x} 4, and phrases [share cached], [router logs], [most picks], [model down], [gateway down], [first week], [cache hits] at 2 each.
Last run: empty.

## Where each fact stands

- Refused total: the card 1 figure. Its base: the delta pill (first week against second week).
- The leader of a day: the table's Leader column, the blue segment on a day iu did not lead, and the rest status on focus.
- Why a pick was refused: the stack's red steps, the table's Reason column, the Top reason footer fact (the total only).
- The gateway being down: the zone label on the bars once; the table shows a dash for that day and the heatmap column reads Not logged.
- The caller at 0 %: the card 2 status, the red cells, and the Days at 0 % footer count.

## Fixtures

- default: the fortnight with its quota refusals, the day with no picks and the caller whose hits fell to zero.
- extreme: one day of a retry loop (2,400 picks, most refused for quota); the bars take the kit's y clamp.
- calm: no refusal at all; the figure is a measured 0 and its delta is neutral.
