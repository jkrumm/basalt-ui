# Training readiness this morning (expr-n63)

## The three lines

- Who and which question: an athlete checking the morning asks whether today is a day to push or to rest, and how stress and body battery moved through the last night and day. The decision is one verb: push, train easy or rest.
- The figures that answer it: today's recovery score (78 of 100) with its verdict, and the body battery now (91 %) with the hours of stress over 75 beside it. Each clause of the question has a number at rest: the score and its verdict answer the first, the battery and the `3 h over 75` status answer the second.
- From `DESIGN.md` of the app: neutral surfaces, one accent, one status hue.

## Surface

- Parts: a 30-day recovery card (the score, with HRV, sleep and resting heart rate under it on one x) and a 24-hour card (stress over body battery on one x). Charts that share an x share one card.
- Both cards sit side by side at `@wide` and stack at a narrow container; each card is a fixed-height wrapper because the kit's chart box clips and the panes have fixed heights.
- Shared: each card has one `useChartFocus`, one cursor group and one gutter. The top pane of each card is the card's one tab stop; arrow keys step the other panes' crosshair and axis pins.
- No table: the 30 days are the chart's own items, drawn at the day, and a table of them would repeat the panes.

## Datasets

- `fixture.ts`, seeded, two shapes: 30 daily rows (recovery, HRV, sleep, resting heart rate; one night with no sleep recorded) and 480 samples at 3 minutes (stress 0 to 100, body battery 5 to 100; one run of 60 samples, 3 h, over 75). Form: lines and bars on a time axis in a `ChartCard`.
- `?fixture=` names: `rest` (today scores 0, the night short, battery recharged to 37), `nosleep` (no sleep last night: today is not scored, the battery never recharges and stays at 5), `calm` (stress never over 75). Anything else is the push morning.

## One view at 1800x1200

| part                                      | question it answers                       | x,y w x h        | what it joins                                  |
| ----------------------------------------- | ----------------------------------------- | ---------------- | ---------------------------------------------- |
| Recovery card header and figure           | is today a push day                       | 264,72 748x116   | the card's focus (status and period follow it) |
| Recovery pane                             | where does today sit against 40 and 70    | 264,188 748x250  | focus and cursor group `n63-days`              |
| HRV, sleep and resting heart rate panes   | what moved with the score                 | 264,438 748x460  | the same focus and cursor                      |
| Recovery footer                           | how many push and rest days               | 264,932 748x40   | nothing; counts against the two rules          |
| Stress and battery card header and figure | how much battery is left, was stress high | 1028,72 748x116  | the card's focus                               |
| Stress pane                               | when was stress over 75                   | 1028,188 748x420 | focus and cursor group `n63-day`               |
| Battery pane                              | how did the night recharge                | 1028,608 748x300 | the same focus and cursor                      |
| Stress card footer                        | the peak and the low as times             | 1028,932 748x40  | nothing; times for the two marks               |

No two parts answer one question; no table, so no 480 px column sum; no gap as wide as a card in the first 1200 px (the cards end at 972).

## Color: meaning

- accent (blue): the recovery score, its line, today's dot and the push-day verdict
- ink steps: HRV, sleep, resting heart rate, stress, body battery, the 25, 50, 75 rules and the 40 and 70 rules
- grey tint: a night with no sleep logged (recovery card), the night asleep (stress card)
- status red: stress over 75 (zone, status dot) and a rest day (verdict, delta)

Accent count: one class (the score). The same red marks the two states that need action.

## Fact count

First run, before the cuts: `battery` 13, `stress` 12, `sleep` 10, `last` 10, `recovery` 9, `days` 7, `body` 7, `body battery` 7, `score` 6, `recovery score` 6, `heart rate` 6, `30 days` 5, `24 hours` 4, `sleep logged` 4, and a dozen more. Last run: empty. Each measure has one name, read from a constant of its file: recovery score, HRV, sleep, resting heart rate, stress, battery. Titles and the footer write the longer forms once.

Read aloud, one place per fact: the verdict (status), 30-day base (delta label), push and rest day counts (footer), no sleep logged (zone label, and the period only when today is the missing night), asleep hours (zone label), hours over 75 (status, with the zone label on the mark as the first place), battery now (figure), the low and the peak (a mark label and the footer time). Times in the period slot and the footer are mono.

## States

- Loading: both cards keep title, subtitle, figure row, footer labels with empty values.
- Empty: each card states its own cause and next step: the score card asks for one night with the band, the stress card asks for a sync.
- Error: one Retry for both cards (they share one retry), cause in one line.
