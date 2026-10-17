# Wave 35 — argo's friction: rounds on S2, S3, S4 and the chrome specimens

Boards stay local under `.design-parity/w35/r<n>/` (never in git). Each round: build the package and the
playground from `master`, `basalt-ui shot /scenarios/s2-training /scenarios/s3-agents /scenarios/s4-spend /components
--dist apps/playground/dist --out .design-parity/w35/r<n>`, then a fresh `basalt-design-reviewer` scores it without
reading source. S3 (agent work) did not exist before this wave; #362 built it, so r0 has no S3.

## Round 0 — master before the wave (r0, `477592f7`, 404 shots)

| Item                                                                                                     | Where                | Owner        |
| -------------------------------------------------------------------------------------------------------- | -------------------- | ------------ |
| Mono hero values, units, Meter readings, BarList values, DeltaBadge, count chips; slashed zero in titles | everywhere           | #355         |
| Value over time as 90 stacked columns, budget line occluded                                              | spend-over-time      | #353         |
| Ticks name a bin's lower edge at its centre, gapped bars read as categories                              | spend-distribution   | #353         |
| Dark Tabs hover equals rest                                                                              | tabs                 | #367         |
| Accent tint on the active sidebar row                                                                    | every page           | #367         |
| Red-tinted filled error panel                                                                            | every StatCard error | #367         |
| A ring for a rate with a history                                                                         | hit-rate             | left behind  |
| Tinted status pills, "12" without a noun                                                                 | badges               | out of scope |

## Round 1 — batch A and the S3 fixture on master (r1, 600 shots, 16 failed)

Landed before r1: #352 ref-line labels, #353 S4 re-encoding, #355 typography law, #356 Sparkline reference and
readout, #357 locale, #358 strip, #359 ChartCard facts, #361 card inset, #362 S3 + strips on S2/S4, #363 status
exports, #364 DeltaBadge period, #365 BarList props, #366 Meter props.

| Item                                                                   | Where                                                  | Action                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Craft 2: four font sizes in a facts card or a strip cell with a Meter  | session-mix, training-load, readiness, fleet, forecast | #369 (the visually hidden Meter summary took the body size) |
| Strip caption wraps and orphans the info glyph at 390                  | dispatch-spend, forecast                               | #369                                                        |
| Lowercase qualifiers and axis ticks in mono                            | strips, StatCards, charts                              | #369 (`--basalt-chart-font`)                                |
| Facts above a skeleton                                                 | spend-over-time, spend-distribution                    | #369 (facts at rest only)                                   |
| No sparkline readout in a StatCard slot or strip cell                  | S2, S4                                                 | #369 (the shot hovered the card centre; `data-shot-hover`)  |
| Meter caption orphan "d"                                               | oldest-wait                                            | #369                                                        |
| Footer anchors absent in empty/error (16 errors)                       | S3 footer                                              | #368                                                        |
| Empty cell, stretched cards, truncated item names, unnamed budget line | S3, S4, components                                     | #368                                                        |
| Tabs, sidebar, error panel                                             | chrome                                                 | #367 (landed after r1)                                      |

## Round 2 — everything above on master (r2, 616 shots, 0 failed)

Pass: the strip anatomy, the reference label, insets, the dark Tabs hover, the neutral sidebar row, the StatCard
error. Remaining:

| Item                                                                                                              | Where                            | Action                                                  |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------- |
| Sparkline readout on the line, the end dot or a bar                                                               | sessions, volume, failures       | #371 (a reserved readout line above the plot)           |
| ChartCard error: a different anatomy, Retry clipped at 390                                                        | goal, session-mix, training-load | #371 (one error anatomy; the box grows)                 |
| Ticks drop to 10 px at 390 (four sizes)                                                                           | spend-over-time, Heatmap         | #371                                                    |
| Caption orphans at 390                                                                                            | oldest-wait, forecast            | #371 (`text-wrap: balance`, glue)                       |
| Thin BarList titles cut to six characters; mono status word                                                       | stuck-items                      | #371 (two-line label; `StatusVerdict` word in the sans) |
| Duplicate overage line, weak error copy, top-drivers off the shared state idiom, stretched cells, unlabeled ticks | S2, S3, S4, components           | #370                                                    |

## Round 3 — #370 and #371 on master (r3, `87e947fa`, 620 shots, 0 failed)

Pass: every S2 card except hit-rate, every S3 strip cell except failures, every S4 component except spend-over-time's
y-axis copy, all pages. Targets 3 (facts, ≤ 3 sizes), 4 (readout clear of marks and hero), 5 (on-plot labels), 7
(thin rows) and 9 (insets) pass; the chrome items pass except the Retry styling. Remaining, all left behind:

| Item                                                                                            | Where                       | Owner                                                     |
| ----------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| Strip empty and error read the same (`—` + a footer note, no dot, no Retry)                     | every strip cell            | Wave 36: a strip `state`                                  |
| ChartCard Retry is the consumer's action (borderless in the fixture), StatCard's is outlined    | goal, top-drivers           | Wave 36: one Retry in the shared error anatomy            |
| Default Meter fill is full ink in dark                                                          | budget, goal, footer meters | Wave 36: decide `tone="muted"` as the non-verdict default |
| "budget" orphan in a fixture-composed footer at 390; end captions crowd                         | forecast                    | fixture, Wave 36                                          |
| Failures marks have no time scale; hit-rate ring hides the months; "(€)" plus "€" on every tick | S3, S2, S4                  | fixture, Wave 36                                          |
| Selected Tabs pill takes the accent; Disabled button contrast 2.27; tinted status Badges        | components                  | out of Wave 35 scope (W33 chrome)                         |
