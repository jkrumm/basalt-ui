# n73 review queue: design notes

## Question

- Who opens it: a learner at the start of a review session.
- The question: how many items are due now, and is the share that slipped to forgotten or shaky still under 20 percent of what was learned?
- Figures that answer: `31` due now (the clause-one number) and `18.6 %` slipped against the 20 % limit (the clause-two number), both in the first row of cards (with the 26 slipped and the limit of 28 as footer pairs); the bars show what the share is made of and the table lists the 31.

## Fixture

- Seeded (mulberry32), no clock: `fixture.ts`. About 500 items: 140 learned, 46 in progress, 314 not started. Only started items carry a due date and an interval (assumption: a not-started item has no schedule). Learned items carry a confidence step 0 to 5 (Unrated, Forgotten, Shaky, Partial, Solid, Fluent).
- Default: Unrated holds no item (the empty step, drawn as a 0 tick); 9 forgotten + 17 shaky = 26 of 140 = 18.6 %, just under the limit; 31 due now; one fluent item on a 180-day interval, due now; 1,300 sessions over the year before the last one, which is 6 days ago (so no due item is more than 5 days late).
- `?fixture=over`: 45 of 140 slipped (32.1 %, past the limit), 52 due. `?fixture=clear`: nothing due, next item 21 Nov (zero cue and the empty cause with its next step).
- `?shot-state=loading|empty|error`: every part draws the same slots; empty is a learner with no items and no sessions; items and sessions are two sources with their own retry.

## Color: meaning

- accent (the brand blue): forgotten or shaky, on the bars (`highlight`), the tint behind them and the dots of the table's Confidence column. Nothing else takes it.
- ink steps: the other bars, the sparkline, the overdue meters.
- status red: the meter's over-limit zone and the pill past the limit, only lit in `over`. No amber: overdue is a footer pair, not a status.

## One view (1800x1200, light)

| part                                      | question it answers                                                                                                     | x,y w x h        | joins                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| Due now, Slipped share (cards, one group) | how many are due (Today and Overdue pairs), is the slipped share under the limit (meter, pill, Slipped and Limit pairs) | 264,72 996x178   | none: figures                                                                                  |
| Last session (card, own group)            | how long since the last session, and how often she usually comes                                                        | 1280,72 496x164  | none: the sparkline is its own series                                                          |
| Confidence by step (ChartCard, bars)      | what the share is made of (counts per step, slipped steps in the accent under the zone label)                           | 264,266 750x660  | one `useChartFocus` over the six steps                                                         |
| Items to review (DataPanel, DataTable)    | which items are due, most overdue first, with confidence and interval                                                   | 1026,266 750x660 | `focusItems.holds` (row.step === step.step): a step lights its due rows, a row lights its step |

The table's priority 1 and 2 columns (Item, Days overdue, Confidence, Interval) all show at the 750 px cell; Due is priority 3 and shows only in the phone cards. No part is full width for four rows, no gap as wide as a card, the page ends at about 925 px.

## Fact count

First run, on the round-0 source: `11 items`, `7 learned`, `5 item`, `4 queue`, `4 overdue`, `4 [learned items]`, `3 [review queue]`, `3 [# items]`, `2 [slipped share]`, `2 [items due]`, `2 [items #]`, `2 [due now]`, `2 [# due]`. Last run (after cutting each): empty print.

Measures and the one word for each: due ("due", "overdue" for days past due); slipped ("slipped" is forgotten or shaky: the cell label, the zone label and the accent); learned (items with a confidence step); limit (20 %, 28 items for 140 learned); session. One name per item: the bar names are the table's Confidence words.

Read-aloud lines, one place each: 31 due (Due now cell; the table lists them); 29 overdue (status of that cell); +2 vs yesterday (its pill); 18.6 % and -1.4 pts vs 20 % (Slipped share cell with its meter); 26 slipped and limit 28 (zone label); 140 learned and 28 % of all 500 (chart figure); 46 in progress and 314 not started (chart footer); 6 days ago, 1,300 sessions, 1 day usual gap (Last session cell).

## Empty sentences (one per part)

- Due now: Nothing is waiting. Add one to start. Slipped share: No share yet. Learn and rate one. Last session: No session is logged. Start one.
- Confidence by step: Nothing to chart. Rate one. Items to review: No items yet. Add some to start (nothing due: names the next due day).

## Kit gaps and workarounds

- ChartCard `legend` on the Bars chart loops the plot measure (React 185), so the accent has no legend entry; the zone label names it.
- The lint does not know StatCell's chart slot (StatCard's is allowed): one waiver.
- No icon library in the playground, so the strip cells carry no icons.

## Round 1

- Cards variant for the three figures (figure in an inset, footer pairs); empty sentences cut to fit one line at 390; the Due now pill (it was the count due today, not a change) is gone and the parts stand as the Today and Overdue pairs; no amber status; meter zone words cut to Under and Over; the chart subtitle is gone.
- Each card of the items source has its own retry function so each shows its own Retry; the sessions card is its own StatGroup so its failure has its own banner. Cost: the Last session card ends 14 px above its neighbours.
- At 390 the chart card is 430 px high, shorter than the viewport.
