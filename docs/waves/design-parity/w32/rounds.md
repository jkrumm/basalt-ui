# Wave 32 — Scales: rounds on S1 and S4

Boards stay local under `.design-parity/w32/r<n>/` (never in git). Each round: build the package and the
playground, `basalt-ui shot /scenarios/s1-ops /scenarios/s4-spend --dist apps/playground/dist --out
.design-parity/w32/r<n>`, then a fresh `basalt-design-reviewer` scores it without reading source.

Wave 32 owns the scale items only: Craft 1 (nested radius step), Craft 2 where a type role causes it, Craft 3
(dense-row wrap), Craft 5 (small-label ink contrast) and the measured insets/gaps. Every other failed item is
attributed to the wave that owns it (Wave 33: delta fill, empty "—", info-bubble clip, chart `role="tooltip"`;
Wave 34: meter/segmented bar instead of number boxes and donut; Wave 35: axis-less distribution recipe;
Wave 36: table wrap at 390).

## Round 0 — master before the scales (r0)

Reviewer: all 14 components fail; both pages pass.

| Item                                                                      | Where                                                     | Owner                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Craft 1: badge/legend radius 6 in card 7 (1 px step)                      | every card with a delta badge or legend                   | **W32**                                                 |
| Craft 1: legend `_dot` radius 50 "off scale"                              | chart legends, mobile                                     | reviewer false positive (a circle); recorded, not fixed |
| Craft 2: four font sizes (10, 12.5, 13.5, 24) in a metric card            | latency-now, month-to-date                                | W32 (type roles) + W33 (card anatomy)                   |
| Craft 5: 11 px axis ticks / legend values at 4.06:1 in light              | availability, throughput, latency-distribution, spend-*   | **W32**                                                 |
| Craft 3: dense rows wrap at 390                                           | outages, top-drivers                                      | W32 (row text `sm` 13) + W36                            |
| Craft 4 / Expression 3 / Craft 5: filled delta badge, 4.43/3.59 contrast  | latency-now, month-to-date                                | W33                                                     |
| Craft 6: info bubble clipped or covered at 390 and on focus               | every card                                                | W33                                                     |
| Craft 7: no `role="tooltip"` on chart hover                               | every chart                                               | W33                                                     |
| Communication 6: bare "—" empty state                                     | stat cards                                                | W33                                                     |
| Expression 1/4: number boxes and a donut where a meter/segmented bar fits | packet-loss, download, forecast, budget, spend-by-project | W34                                                     |
| Expression 1/5: full-axis histogram, repeated unit ticks                  | latency-distribution, spend-distribution                  | W35                                                     |
| Communication 2/4: no unit in hover readout, no time scope in title       | throughput, latency-distribution                          | fixture copy (S1)                                       |

## Round 1 — `feat/w32-scales` as first briefed (r1)

Measured against r0 (`metrics.json`, 56 anchors): the light `#7b7b7e` on `#fafafd` axis/legend ink failures go
from 117 to 0 (the axis ink is now the `faint` ink, ≥ 4.5:1 on every text surface in both schemes); the card
radius is 10 against the control/badge 6 (a 4 px step); the card inset reads 12/16 (12/12 on mobile); the metric
card's sizes are 12 / 13 / 22 (were 12.5 / 13.5 / 24).

Reviewer: all 14 components still fail and both pages pass, but every W32-owned item is cleared except:

| Item                                                   | Verdict                                                      | Action                                        |
| ------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------- |
| Craft 1: legend `_dot` radius 50 not a step            | false positive: `shot` reads a `50%` circle as 50 px         | `shot` reports a full round as such (round 2) |
| Craft 2: four sizes in a metric card (9.6, 12, 13, 22) | 9.6 is the delta glyph at 0.8 em; the rest are the new roles | W33 (delta anatomy)                           |
| Craft 3: table rows wrap at 390                        | row text is 13 now; the columns still don't fit 390          | W36 (responsive tables)                       |
| Communication 2: throughput hover with no unit         | fixture                                                      | round 2                                       |
| Expression 5: "ms" on all 13 histogram ticks           | fixture (round-1 review moved the unit into the labels)      | round 2: unit once, in the title              |

Everything else is unchanged from r0 and stays with its owning wave (table above).

## Round 2 — after review round 1 and the board fixes (r2)

`shot` now reports a fully rounded corner as `full` (16 legend dots), so nested radii read 10 (card), 6 (control,
badge), 2 (marks) and `full`; the axis-ink failures stay at 0. Reviewer: no Craft 1 or Craft 5-ink finding on any
component; both pages pass. The expanded gutter (24 at 1440) is kept: the content frames evenly against the sidebar
seam and no page or component cites detachment (D7 trial passes).

| Item                                                                                                            | Verdict                                     | Action                               |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Craft 3: outages / top-drivers wrap at 390                                                                      | the columns, not the row text, overflow 390 | W36 (fold, then pin-and-scroll)      |
| Communication 4: "Throughput per hour (Mbit/s)" has no time scope                                               | fixture                                     | round 3                              |
| Craft 6: availability hover header clipped at the card top                                                      | chart tooltip placement                     | W33                                  |
| (lead) the sparkline `StatCard` is shorter than its row siblings (S1 latency-now, S4 month-to-date; also in r0) | not a scale change                          | W33/W35 (card footprint, stat strip) |

Everything else is unchanged and stays with its owning wave.

## Round 3 — the merged state of `feat/w32-scales` (r3)

Measured: no axis-ink contrast failure (the only `contrast.failures` left are the filled delta badge, W33); nested
radii 10 / 6 / 2 / `full`; card inset 12/16 desktop, 12/12 compact. Reviewer: both pages pass; every component
still fails, and **no failed item is a Wave 32 scale item**. Communication 4 (throughput time scope) is cleared.

| Remaining item                                                                                            | Owner                                         |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Craft 3: outages / top-drivers columns overflow 390                                                       | W36                                           |
| Craft 2 (9.6 px delta glyph), Craft 4 / Expression 3 / Craft 5 (filled delta), Communication 6 (bare "—") | W33                                           |
| Craft 6 (info bubble clipped; availability hover header), Craft 7 (chart `role="tooltip"`)                | W33                                           |
| Expression 5: date and bin ticks collide at 390                                                           | W33 (span-aware tick formatter, row 137)      |
| Expression 1 / 4: donut, stacked bars, number boxes, full-axis histograms                                 | W34 / W35                                     |
| Craft 5: Search/Evals same-hue neighbours (S4)                                                            | W34 (categorical ramp, with `Meter` segments) |

Targets kept after three rounds: every SPEC § 5 _target_ for Wave 32 (grid, inset, radius, type roles, dense
tier, expanded gutter). None was reverted.
