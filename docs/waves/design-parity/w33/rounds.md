# Wave 33 — the metric card and chart-in-card: rounds on S1, S4 and the chrome specimens

Boards stay local under `.design-parity/w33/r<n>/` (never in git). Each round: build the package and the
playground, `basalt-ui shot /scenarios/s1-ops /scenarios/s4-spend /components --dist apps/playground/dist --out
.design-parity/w33/r<n>`, then a fresh `basalt-design-reviewer` scores it without reading source. `/components`
carries three chrome anchors from #331 (`buttons`, `tabs`, `badges`) so the theme-default changes are shot too.

Wave 33 owns the metric card (SPEC § 6.1), chart-in-card (§ 6.2), the status chip (§ 6.10), the chrome leaks
(§ 6.12) and the metric card's and charts' states (§ 6.11). Every other failed item is attributed to its owning
wave: Wave 34 (forecast/budget meters, the spend-by-project donut), Wave 35 (axis-less histograms, value-over-time
recipe), Wave 36 (outages/top-drivers at 390, table delta cells).

## Round 0 — master before the wave (r0, r0-chrome)

Reviewer: all 14 scenario components fail; buttons, tabs, badges fail; pages pass.

| Item                                                                                 | Where                      | Owner         |
| ------------------------------------------------------------------------------------ | -------------------------- | ------------- |
| Craft 4 / 5, Expression 3: filled delta badge, 4.43 / 3.59 contrast                  | latency-now, month-to-date | W33           |
| Craft 2: four sizes in a metric card (9.6 glyph, 12, 13, 22)                         | latency-now, month-to-date | W33           |
| Craft 6: info bubble cut off and painted over by the neighbouring card on focus      | every card, 1440 and 390   | W33           |
| Craft 7: no `role="tooltip"` on any chart hover readout                              | all 8 charts               | W33           |
| Craft 6: availability hover header clipped at the card top                           | availability               | W33           |
| Communication 6: bare "—" empty state                                                | 6 stat cards               | W33           |
| Expression 5: "10 Oct, 00" ticks collide at 390                                      | availability               | W33 (row 137) |
| Expression 1 / 4: packet-loss and download have hourly history but show bare numbers | packet-loss, download      | fixture       |
| Craft 4: accent underline on the active tab; accent label on the subtle button       | tabs, buttons              | W33           |
| Craft 4: filled badges, the default one accent-filled                                | badges                     | W33           |

## Round 1 — #332 date ticks, #333 chrome, #334 metric card merged (r1)

Measured against r0 (`metrics.json`): every metric card renders three sizes (11 micro, 13 sm, 22 hero; 16 hero on
mobile), down from four; `contrast.failures` on the delta cards 3 → 0 in both schemes; cards in one row share a
height (S1 177.8, S4 129.5 at 1440). Reviewer: packet-loss, throughput, spend-over-time and tabs pass; the filled
delta, the 9.6 px glyph, the bare "—", the info-bubble clip and the hover-header clip are gone.

| Item                                                                              | Verdict                                                                                                       | Action                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Craft 7: no tooltip on latency-distribution, spend-distribution, spend-by-project | shot picked another chart's hidden 0×0 readout; Donut bypassed the role stamp; the donut's centre is its hole | round 2 (#335)                     |
| Expression 5: availability ticks still "10 Oct, 00"                               | the fixture's own `formatX`, not the default                                                                  | round 2: fixture uses the default  |
| Craft 6: qualifier truncated at 390 (download, forecast)                          | W33: SPEC § 7 says it drops under the caption                                                                 | round 2                            |
| Craft 4: the default badge is accent-tinted                                       | W33: accent discipline                                                                                        | round 2: neutral default (D21)     |
| Expression 3: a red "▲0.2%" delta                                                 | the shipped reviewer said "a delta is neutral text", contradicting SPEC § 6.1                                 | round 2: reviewer calibrated (D24) |
| Expression 3: the budget remainder in green                                       | fixture: a remaining amount is not a verdict                                                                  | round 2                            |

## Round 2 — `fix/w33-tooltip-role` after its round-1 fixes (r2)

`shot` reports 0 failed (was 6). Reviewer: the round-1 W33 items are cleared. Newly visible once the tooltips
render, all in the fixtures: chart error copy says "Retry" with no control; histogram readouts head a bin with a
bare "36"; S4's "▲0.1%" contradicts top-drivers' +9–14% (a percent passed as a fraction, latency too); "250 Mbit/s"
breaks at the space; specimen filler ("Overview panel content."). All fixed in #335 before its second review.

## Round 3 — #335 as merged (r3)

Scored with the recalibrated reviewer lines (D24; the session's subagent loads its definition from master, so the
two corrected lines were handed to it). Every metric card passes (latency-now, packet-loss, download, month-to-date),
and both chart-in-card W33 surfaces pass (availability, throughput). **No failed item is a Wave 33 target.**

| Remaining item                                                                                                                               | Owner                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Expression 1: budget as text rows; spend-by-project donut (+ Craft 5 near-identical blues, Communication 1 "Value")                          | W34 (Meter `segments`)                                    |
| Craft 3: forecast empty lower 40 %                                                                                                           | W34 (Meter with target)                                   |
| Expression 1: full-axis histograms; stacked bars for value over time                                                                         | W35 (recipes)                                             |
| Craft 3: outages / top-drivers wrap at 390; Expression 3: table deltas without a glyph                                                       | W36                                                       |
| Craft 4: `light` / `outline` Buttons carry the accent                                                                                        | owner decision (not in SPEC § 6.12; Wave 39 candidate)    |
| Craft 3 / 7, Communication 2 / 4 on the specimens: empty band, the shot hovers the group not a control, category titles, the bare "12" count | specimen page, not a shipped pattern; recorded, not fixed |
