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
