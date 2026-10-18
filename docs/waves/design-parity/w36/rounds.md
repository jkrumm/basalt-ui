# Wave 36 — the UX-first procedure, shipped: rounds on S2, S3, S4 and the components

Boards stay local under `.design-parity/w36/r<n>/` (never in git). Each round: build the package and the
playground from `master`, `basalt-ui shot /scenarios/s2-training /scenarios/s3-agents /scenarios/s4-spend /components
--dist apps/playground/dist --out .design-parity/w36/r<n>`, then the two isolated passes the shipped skill now
prescribes: (A) a fresh `basalt-design-reviewer` scores the out dir without reading source; (B) `basalt-ui shot detect`
runs over the same `metrics.json` (P0/P1 fail, P2/P3 noted).

## Round 0 — master before the wave (r0, `b87cf7bb`, 620 ok shots, 0 failed)

No package or playground source changed between Wave 35's r3 (`87e947fa`) and `b87cf7bb` (only the release commit
and docs), so r0 is the r3 render and the r3 verdict stands (`../w35/rounds.md` § Round 3). Detector B, first run
(after #379, over a copy of r0's `metrics.json`): 3 findings, score 55 — P0 `craft-5/contrast` (Disabled button
2.27:1, components), P1 `craft-3/empty-region` (S2 hit-rate 41 %), P1 `craft-2/font-sizes` (components buttons, 4
sizes).

## Round 1 — the procedure PRs on master (r1, `ea4b3dbd`, 622 ok shots, 0 failed)

Landed before r1: #374 router and references, #375 S2–S4 composition, #376 strip `state` and one Retry, #377
reference placement, #379 `shot detect` and the two-pass reviewer, #380 muted Meter and thin BarList defaults
(#378 palette guard landed after r1; no visual change). B: 2 findings (P0 Disabled contrast, P1 four sizes in the
buttons specimen), score 65. A (the reviewer definition loaded at the lead's session start, i.e. the pre-#379 doc):

| Item                                                           | Where                     | Action                                                                           |
| -------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| Strip cells read only `—` in empty and error                   | every S3/S4 strip cell    | #384 adopts the strip `state`                                                    |
| One bar per month / grouped bars per day for a value over time | S2 hit rate, S3 item flow | #384 (`Lines`, a labelled goal line)                                             |
| A card-subject histogram failed against "axis-less"            | S4 distribution           | #383 splits the catalogue row (slot vs card subject)                             |
| € dropped from the cumulative ticks (#375 over-corrected)      | S4 spend over time        | #384                                                                             |
| Rows wrap and the status clips at 390                          | S3 stuck items            | #384 (one-line titles, the blocked reason kept)                                  |
| Four sizes in one anchor; Disabled 2.27:1                      | buttons specimen          | #384 splits the anchor; #381 exempts disabled text (WCAG 1.4.3) from the measure |
| Selected Tabs pill takes the accent; tinted status Badges      | components                | left behind (chrome)                                                             |

Composition (bullet 6): the columns-end-unbalanced void is gone on S2/S3/S4 (#375: S2 stacks goal + mix + load beside
hit rate, 385/386 px; S4 pairs 386/386 and 252/252; S3's list and flow chart take a row each), and the S2 hit-rate
`emptyRatio` P1 from r0 is gone. Thin BarList rows and the muted Meter fill are the defaults (#380); the hosted Meter
no longer restates the headline (#376).

## Round 2 — the round-1 fixes on master (r2, `fd5da9ff`, 616 ok shots, 16 absent, 0 failed)

B: 1 finding (P0 Disabled contrast, fixed by #381 which had not landed), score 75. A (the shipped Assessment-A doc,
read from the package): every S2, S3 and S4 component passes; fails only `buttons-disabled` (Craft 5, P0) and `tabs`
(Craft 4, P1, the accent pill); P2/P3 notes: tinted Badges, bare "Inputs"/"Table" titles on the components page,
the "Goal 28" end label on the line's last segment, a duplicated empty-state line in S2 readiness. Score 57 (the
components page).

The two argo Wave 23 items folded in mid-wave (mother, 2026-10-18): r1/r2 are their before boards.

## Round 3 — everything on master (r3, `bd7dd98f`, 616 ok shots, 16 absent, 0 failed)

Landed since r2: #381 Button section inset on the scale (and disabled text exempt from the contrast measure), #382
Meter zone names under their spans, #383, #384. B: no findings, score 100 (trend 65 → 75 → 100). A: every S2, S3 and
S4 component and every page passes; the components page fails only `tabs` (Craft 4, P1: the selected pill takes the
accent, chrome left behind). Notes: tinted Badges (P2), the S2 zoned Meters show no end ticks and the reading takes its
own row (P2), an unaligned, glyph-less Delta column in the components table (P2, not an anchor), a duplicated readiness
empty line and the "Goal 28" label on the line (P3). Score 76. Zone names sit under their spans on both zoned Meters
(#382 holds); no Button with a section was on the board, so the inset (#381) is pinned only by the layout suite.

## Round 4 — #385's specimens on master (r4, `fc1f8405`, 626 ok shots, 16 absent, 0 failed)

The after-board for the two argo Wave 23 items. B: no findings, score 100. A: S2 zoned Meters name every zone under its
own span with the end ticks (0 / 2.0, 0 / 100) in the label row (#382 holds; the detached "Scale 0–100" caption is
gone); the new `buttons-sections` anchor passes and `metrics.json` lists every section inset as a scale step (#381; P3:
the icon side reads ~8 px tighter than the text side at the largest size). New P1: at 390 the training-load Meter hides
"Overreaching" (narrow span), so that zone reads by colour alone — #387 adds a zone `short` label tried before a name
hides. Still failing: `tabs` (accent pill, chrome). Strip cells (S3/S4, the "before" for #386): no cell exceeds
`emptyRatio` 0.4; the stretched cells are oldest-wait (0.356) and budget (0.372) at 1440.

## Round 5 — #386 and #387 on master (r5, `6236c47e`, 626 ok shots)

B: 3 findings, score 88 — P1 `craft-3/empty-region` S3 `strip-oldest-wait` 46 % at 1440 (36 % in r4: #386's shared
footer track sat it under the fleet legend's 69 px visual track), P3 ×2 `craft-1/off-scale-inset` (#386's first-cell
`stack-md + 1px` = 13 px). Both fixed by #388 (a footer under a visual rides with that visual; hairlines as
box-shadows with a forced-colors border twin). Not scored by A (superseded by r6).

## Round 6 — #388 on master, the 2.21.0 head (r6, `8a04f9a4`, 626 ok shots, 16 absent, 0 failed)

B: no findings, score 100 (trend 75 → 100 → 100 → 88 → 100). A: every S2, S3, S4 and components anchor and every page
passes except `tabs` (Craft 4, P1, the accent pill — chrome, left behind); score 86. Every inset, gap and radius is a
scale step across 132 anchors; `emptyRatio` peaks at 0.374. S2 training load at 390 names every zone (Low, Optimal,
High, Over) with 0 / 2.0 in the label row (#382, #387). **The strip still stretches at 1440:** every S3 cell is the row
height (154 px), so oldest-wait (0.359) and S4 budget (0.374) keep a ~55 px void under their caption — under the 0.4
line, so not a rubric failure, but argo's Wave 25 ask ("cells without a visual stay compact") is only half met: the
value-to-footer void is gone, the cell-bottom void is not. Notes: tinted Badges (P2), readiness "76 of 100 16 Oct"
runs unit and date together (P3), "Good" and "100" nearly touch at 390.
