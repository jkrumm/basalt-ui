# Wave 34 — Meter and BarList: rounds on S2, S4 and the chrome specimens

Boards stay local under `.design-parity/w34/r<n>/` (never in git). Each round: build the package and the
playground, `basalt-ui shot /scenarios/s2-training /scenarios/s4-spend /components --dist apps/playground/dist
--out .design-parity/w34/r<n>`, then a fresh `basalt-design-reviewer` scores it without reading source. r1–r3 were
shot from an integration tree (master plus the open fix branches), so each round scores what was about to land.

Wave 34 owns `Meter` (SPEC § 6.3), `BarList` (§ 6.4), the S2 fixture, the light/outline Button ink (§ 6.12, D27),
the status-text derivation (D22) and, by the owner's steer of 2026-10-17, the end of the coloured status edge
(D28). Every other failed item is attributed to its owning wave.

## Round 0 — master before the wave (r0)

Reviewer: forecast, budget, spend-by-project, top-drivers and buttons fail; everything else passes. All five
are Wave 34 targets.

| Item                                                                                  | Where            | Owner         |
| ------------------------------------------------------------------------------------- | ---------------- | ------------- |
| Craft 3, Expression 1 / 4: a bare figure for a committed/forecast split, no target    | forecast         | W34 (Meter)   |
| Expression 1: progress to a cap as two text rows                                      | budget           | W34 (Meter)   |
| Craft 5, Expression 1, Communication 1: six-part donut, near-identical blues, "Value" | spend-by-project | W34 (BarList) |
| Expression 1: a ranked top-6 as a table with a share column                           | top-drivers      | W34 (BarList) |
| Craft 4: accent tint/border on the light and outline Buttons                          | buttons          | W34 (owner)   |
| Expression 1: stacked daily bars for value over time                                  | spend-over-time  | W35           |

Outside the anchors: the active sidebar row carries a blue-tinted fill (accent on a selected row).

## Round 1 — #338, #339, #341, #343 on master; #344 (S2/S4 fixtures) (r1)

Reviewer: month-to-date, the S2 summary, tabs and badges pass. Package defects found, fixed in #345:

| Item                                                                | Where                     | Action                                            |
| ------------------------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| Craft 6: the BarList bar runs under the value text                  | spend-by-project, drivers | #345: the bar lives in the label column (D32)     |
| Expression 1 / 4, Craft 5: categorical segments with no captions    | session-mix               | #345: per-part captions under the track           |
| Craft 1: marker radius 1 px, off the scale                          | training-load, readiness  | #345: `fine`                                      |
| Craft 6: captions clip at 390 ("Forecast €2,65")                    | forecast                  | #345: the caption row wraps, never truncates      |
| Craft 6: a Meter in the StatCard visual slot runs to the card edges | forecast, budget          | #345: the slot sizes to a Meter, inset kept (D31) |
| Craft 2: four font sizes (ring value 15, BarList secondary 12)      | readiness                 | #345: hero and `sm` roles                         |

Fixture items fixed in #344: footers clipping at 390, empty copy without a next step, stale ring copy in the
empty state, contributors unsorted, top-drivers deltas without a trend glyph (now `DeltaBadge`), meter cards
left 40–64 % empty beside a tall neighbour (regrouped), the error placeholder at chart height.

## Round 2 — #344 and #345 (r2)

Reviewer: session-mix, top-drivers, tabs and badges pass; no measured item fails anywhere (insets, radii, ≤ 3
sizes, contrast). Remaining:

| Item                                                                               | Where             | Action                                                        |
| ---------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| Craft 6: the info glyph's focus ring paints over the title's last letter / the dot | 12 cards          | #347: the ring hugs the 11 px glyph                           |
| Craft 5: zone bands differ only by grey shade, no names                            | training-load     | #348: zone names on the band (D30)                            |
| Craft 7: a sparkline hover with no readout                                         | four metric cards | #348: sparklines carry no hover anchor (no tooltip by design) |
| Expression 1: stacked value-over-time; axis-full histogram                         | S4 charts         | W35                                                           |

## Round 3 — #347 and #348 (r3)

Reviewer: session-mix, hit-rate, top-lifts, spend-by-project, top-drivers, badges pass; the info-ring and zone-name
items are gone. Remaining:

| Item                                                                                   | Where                    | Action                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Expression 2: the reading sits under the first zone's name, so it reads as that zone's | training-load, readiness | #349: the reading is anchored at the marker (D30)                                  |
| Craft 6: the visual-slot skeleton starts at the card edge, ends short of the padding   | 6 metric cards, loading  | #349: the skeleton keeps the card inset                                            |
| Communication 2: "Pace 14 by 16 Oct" has no unit                                       | goal                     | #349: "Pace 14 sessions by 16 Oct"                                                 |
| Craft 7: hover crop equals rest                                                        | buttons, tabs            | #349: hover points on a button and a tab (the anchors were hovered on empty space) |
| Expression 5: histogram ticks name a bin's lower edge at its centre                    | spend-distribution       | W35                                                                                |

## Round 4 — #349 (r4)

Reviewer: every Wave 34 component passes in both schemes at 1440 and 390, in rest, hover, focus, empty, loading and
error: the S2 metric cards, goal, session-mix, hit-rate ring, training-load and readiness zone bands, top-lifts, and
S4's forecast, budget, spend-by-project and top-drivers. No measured item fails anywhere. Two items remain, neither
a Wave 34 target:

- Communication 3 on S4 month-to-date: the sparkline names no window. Fixture copy, folded into #349's last round.
- Craft 7 on tabs: in dark, the hovered tab is identical to rest (light shows a grey fill). A theme item from the
  Wave 33 chrome, left for Wave 35 (it touches no Wave 34 file).
