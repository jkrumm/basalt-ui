# Wave 37 — argo's friction II: rounds on S2, S3, S4 and the components

Setup: [setup.md](setup.md) (argo's live re-score setup, used unchanged for every round). Boards stay local under
`.design-parity/w37/r<n>/` (never in git).

## Round 0 — calibration (r0, `3e645a92`, 626 ok shots, 16 absent, 0 failed)

No package or playground source changed since Wave 36's r6 (`8a04f9a4`); the reviewers confirm r0 renders pixel-identical
to r6. Detector B: no findings, score 100. Three fresh reviewers under the argo bar:

| Route                 | W36 r6 verdict (A)                     | r0 verdict (argo bar)                                | Score | carried | unscored | basalt / playground |
| --------------------- | -------------------------------------- | ---------------------------------------------------- | ----- | ------- | -------- | ------------------- |
| S2 training           | every component passes                 | 9 of 10 components fail (summary passes); page fails | 50    | 3       | 20       | 14 / 9              |
| S3 agents             | every component passes                 | 9 of 9 fail; page passes                             | 64    | 1       | 17       | 10 / 8              |
| S4 spend + components | S4 passes; components fail `tabs` only | 7 of 7 S4 fail; 5 of 8 components anchors fail       | 55    | 6       | 20       | 12 / 14             |

Against Keel: S2 close (expression: the goal card has no headline figure, a smoothed hit-rate curve), S3 close (a smoothed
curve for daily counts, names ~900 px from their values), S4 close (€1,369 stated five times, Meter ends without figures),
components does not yet (the accent tab pill, tinted uppercase Badges).

**Where the playground passed what argo fails** (the calibration gap; this wave's added scope). Wave 36 passed components
carrying P2/P3 notes; argo fails any named defect, and reads repetition, distance and voids as defects:

- **A figure stated twice** (the largest class): Meter readings under the marker beside the headline (S2 `1.19`, `76`);
  €1,369 five times on S4; S3 "6 need you" three times, "Today €5" under "€5 today"; a verdict in the qualifier and the
  footer of one cell; a period in a title and its qualifier.
- **A name far from its value at 1440:** every `BarList` (S2 readiness, top lifts; S3 waiting list ~900 px; S4 projects,
  drivers ~460 px) and the strip footer meters (~545 px).
- **Discrete values drawn as a smoothed curve** (S2 monthly hit rate, P1; S3 daily item flow): `Lines` defaults to
  `monotone`.
- **Chart chrome:** three date formats on one card (tooltip `Thu Oct 15 2026`, ticks `04.10`, headline `1–16 Oct`); hover
  readouts with no day; a single-series legend that repeats the unit (`Sessions 27 sessions`) with a square swatch at
  1440 and a circle at 390; a crosshair and point marker over a bar; end labels and a legend naming the same series; y
  ticks that stop below the data's peak at 390.
- **Meter captions away from their mark:** the pace/forecast caption at the track end, ~255 px from its tick; no 0 end,
  no figure on the target; categorical parts captioned as a legend row that wraps at 390; "Good" touching "100" at 390.
- **Stat card states:** in empty/error the footer still captions a dropped sparkline; "Could not load this figure" wraps
  at 390; "month to date" drops to its own row at 390 and misaligns the values; a list's error says "chart".
- **Chrome:** the `tabs` accent pill (P1), tinted uppercase Badges, Disabled in dark with no surface, the icon-side Button
  inset 8 px tighter.
- **Harness:** 390 page shots blank below the fixed bottom nav; a focus crop shifted onto the neighbouring card.
- **Playground composition/copy:** the S3 failures ticks with no axis, the S2 goal card with no headline figure, the
  readiness "76 of 100 16 Oct", the S2 390 KPI orphan, an empty state that never names its window, a tooltip contradicting
  its cell, unbalanced row ends on the components page.

## Round 1 — the nine batch-1 PRs on master (r1, `a646a081`, 626 ok shots, 16 absent, 0 failed)

Landed: #392 playground (each figure once, honest encodings), #393 shell (PageSummary, untitled Section, sync age,
filter pill, phone Select inset), #394 theme (neutral tab pill, dot-and-word Badges, root zero reset, rowHover/rowSelected,
chart focus ring, disabled surface), #395 Meter (`reading={false}`, host tone, `track={false}`, muted zones/segments,
ring target/ticks, `stops`, row-size part captions, captions at their ticks), #396 BarList (label | value | secondary |
track in a wide card), #397 chart cards (`ChartFact` tone/periods, `stale` facts, Sparkline muted/focus/reference label,
BandStrip/Heatmap state glyphs, Heatmap state tones), #398 harness (tall anchors whole, chrome hidden from crops, fast
absent, zero declared states fail, `init` seeds a stock Vite app), #399 strip (compact cells, `action`, tone to the
visual, `hideValue`, StatCard states), #400 chart chrome (tooltip name column, day headers, y gutter, ticks/legend one
step, refLine label position, linear `Lines`, naming switch, StackedArea opacity, BandStrip tooltip below).

Detector B: 1 finding (P1 `craft-7/no-declared-states` on `/components`, the new #398 rule), score 90.

| Route                 | r0 → r1 score | fixed | carried | new | unscored | Keel                                            |
| --------------------- | ------------- | ----- | ------- | --- | -------- | ----------------------------------------------- |
| S2 training           | 50 → 74       | 18    | 5       | 7   | 1        | close (390 truncation, Meter ends)              |
| S3 agents             | 64 → 75       | 13    | 5       | 6   | 12       | close (failures axis, week meter text)          |
| S4 spend + components | 55 → 59       | 17    | 9       | 8   | 7        | close / close (forecast ends; uppercase status) |

Still open, basalt-owned: StatCard title and qualifier both truncate at 390 (P1, a #399 side effect); Sparkline hover
readouts carry no day and overlap the delta period; Meter end captions dropped at 390 and no 0/target figures; the
Pace and Forecast captions away from their marks; strip cells still stretch (S4 budget emptyRatio 0.323, S3 oldest-wait
0.248 at 390); strip empty copy flush on the cell edge; the week footer meter sits under other cells; Bars hover draws a
point marker; the goal label over the last bar; the error state centred in a tall card; three date formats on a card;
an end label across its own line; the BarList status column ragged and overflowing at 390; delta glyph spacing; Filled
Button hover invisible; uppercase status Badges.

## Round 2 — batch 2 on master (r2, `20d15266`, 728 ok shots, 16 absent, 0 failed)

Landed since r1: #401 playground r2 (copy and composition, `/components` declares its states), #402 Meter (end figures
kept at 390, captions at their marks, start/target figures), #403 BarList status/delta columns and sentence-case
status Badges, #404 chart readouts (Sparkline `{ at, value }` points, bar hover without a marker, one locale source for
ticks and headers, top-aligned error, reference label off the last bar), #405 compact strip cells by construction and
the StatCard caption at 390, #406 heading digits from the sans face (Hubot Sans has no `zero` feature; its default
`0` is slashed), #407 shot's desktop context reports a hovering fine pointer and `no-declared-states` is a P2 naming
the anchors, #408 muted Meter zones share one flat fill. Detector B: no findings, score 100.

| Route                 | r1 → r2 score | fixed | carried | new | unscored | Keel                              |
| --------------------- | ------------- | ----- | ------- | --- | -------- | --------------------------------- |
| S2 training           | 74 → 87       | 8     | 5       | 6   | 0        | close (meter annotation)          |
| S3 agents             | 75 → 83       | 19    | 4       | 7   | 2        | close (readout and age precision) |
| S4 spend + components | 59 → 74       | 19    | 5       | 7   | 6        | close / close                     |

Open after r2: the error state keeps the card height with ~50–70 % void under Retry (P2 on every chart card; #404's
choice); the playground has not adopted the new props (dated Sparkline points, `MeterTick.caption`, footer `under`, the
page format locale, so three date formats remain); the strip error says "Failed" where cards say "Could not load"; a
table error shows the empty-state glyph; a Sparkline bar mark still draws a point marker; the Filled Button hover
still reads as rest on the board.
