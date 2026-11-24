# expr-n89: factory waits, test steps, clean-ups

## Three lines

- The factory owner opens it to judge the waits the factory adds between Issues on its own, and to see which test steps hold the most memory. The decision: keep, switch off or retune a source of waits, and look at the one step that spikes.
- The figures that answer: 44 % of the added waits judged needed with the queue time the rest cost (clause one); 14.6 GB for the heaviest step against the next one (clause two); 5 days at zero for the clean-up counter.
- `DESIGN.md` of the playground: neutral by default, one accent. `accent: a wait judged not needed`. Every other series sits in an ink step.

## Colour: meaning

- blue accent: a wait judged not needed
- dark ink: needed (waits), highest run (memory)
- mid ink: taken back (waits), released holds
- pale ink: not measured (waits), median run (memory)
- no status hue is spent

## One view (1800x1200)

| part                         | question it answers                      | x,y w x h        | joins                                                                              |
| ---------------------------- | ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Waits the factory adds       | do the waits help or only slow the queue | 264,72 750x539   | its own focus over the four sources (bars, figure period and status, announcement) |
| Heaviest test steps          | which steps hold the most memory         | 1026,72 750x539  | its own focus over the ten steps                                                   |
| Stale holds released per day | did the clean-up run                     | 264,628 1512x323 | its own focus over the 30 days                                                     |

Charts answer three different questions on three different x axes, so they are three cards. Row one ends at one height. Nothing sits under 951 px. Table of five or more records: none, the strip is absent and the sources are four.

## Surface at 390

One column in the order of the question: waits first, then test steps, then clean-ups. The second clause starts at the bottom of the first screen.

## Read aloud

Each fact ends in one slot. Greps run: `rg -n 'lostLine\(|stepLine|signed\(|dayText\(|gb\(|pct\(' n89`.

- 44 % of waits judged needed | the figure
- 120 waits in all | the figure period
- 34 waits slowed the queue by 28 h | the figure status (`lostLine`, rest and focus are one slot)
- which source stopped | footer fact "Stopped"
- which source has no measured wait | footer fact "Untimed"
- per-source counts by verdict | the stacks and the announcement; the stack total on top of each bar
- 14.6 GB, the heaviest step | the figure value (the plot draws the dot; no label repeats the number)
- the heaviest step's name | the figure period
- the gap to the next step, 8.2 GB for ui | the delta pill
- 1 of 41 runs near the top | footer fact
- the heaviest step's median, 2.4 GB | footer fact (the legend names the bar only)
- each step's own peak and median | the focus readout (`stepLine`) and the announcement
- 5 days at zero | the figure
- 16 Nov to 20 Nov | the figure period (the zone caption says only "No clean-up")
- the typical day, 6 | footer fact
- the last run before the gap, 15 Nov | footer fact
- the 40 on the 21 Nov bar | the cap caret's label on the mark (no figure says it)
- the window, 30 days | the page title

Empty: each card says its own cause and step once. Error: each card has its own retry.

## Fact count

First run: 9 `peak`, 7 `waits`, 7 `released`, 6 `test`, 6 `needed`, 6 `memory`, 5 `median`, 5 `holds`, 5 `clean`, 4 `source`, 4 `report`, 4 `[holds released]` and 20 phrases at two or three.
Last run: empty print. Measures and their one word: wait (not "hold" for a wait; a hold is what the clean-up releases), memory (peak and highest never mixed: "highest run" is the legend, "heaviest" the title), median.

## Mono

`periodMono` on the clean-ups period; fact `mono` on the last-run date. Step names, source names and the day ticks are not ids.
