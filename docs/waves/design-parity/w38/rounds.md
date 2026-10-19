# Wave 38 — argo's friction III: rounds on S2, S3, S4 and the components

Scored with Wave 37's calibrated setup ([../w37/setup.md](../w37/setup.md)), unchanged, plus one instruction per
SPEC D37: an errored/empty chart body that keeps its loaded height is listed as "D37 (not scored)", not as a void.
Boards: `.design-parity/w38/r<n>/` (gitignored), copied to the MacBook.

## Round 0 — baseline (r0, `fbedae17`, 728 shots, 16 absent, 0 failed)

master after 2.23.0, before any Wave 38 PR. Every route renders pixel-identical to w37/r3; detector B: no findings, 100.

| Route                 | r3 → r0 score | fixed | carried | new | unscored | Keel                                        |
| --------------------- | ------------- | ----- | ------- | --- | -------- | ------------------------------------------- |
| S2 training           | 71 → 70       | 0     | 8       | 0   | 1        | close (goal Meter labelling)                |
| S3 agents             | 80 → 84       | 0     | 6       | 0   | 4        | close (ragged strip under the day meter)    |
| S4 spend + components | 74 → 70       | 0     | 14      | 0   | 4        | close / close (forecast ends; Filled hover) |

The movement is scorer variance on identical pixels (S3 +4, S4 −4 from four newly named items); r0 is the baseline.

Open, basalt: the goal Meter P1 (five captions, "Target 28 sessions" wraps and clips, the reading ~240 px from its fill);
reading captions at the track start elsewhere (S4 budget ~290 px, forecast "Spent" ~140 px, S3 week footer ~790 px);
zone names at 390 (readiness "Good" dropped, "Overreaching" cut to "Over"); fleet part captions wrapping at 390;
Sparkline readout chips covering 55–110 px of the line, the failures chip truncating, an hourly readout naming a day;
the spend-distribution tooltip over its headline; the y unit dropped at 390; the footer meter making the strip ragged
and not following at 390; the delta glyph drift; strip focus crops shifted at 390; a training-load loading skeleton
~55 % short of the loaded card; the Filled Button hover on the sizes anchors; the table error using the empty glyph.

Open, playground: the goal's doubled 28; S3 €5 and "6 items" stated twice; S4 forecast captions and the bare Budget
tick; the unlabelled forecast end and budget crossing; the cumulative title over a daily-rate headline; the fragment
distribution headline; the table error title, a half-empty table card, a badge without a dot, uneven button rows at 390.

D37 (not scored): every chart error/empty body at loaded height; S3 `stuck-items` (a list) keeps the loaded height on
error but collapses on empty, and S4 spend-by-project/top-drivers do the same.

## Round 1 — batch 1 on master (r1, `c75934c9`, #416–#423)

Landed: #416 the playground gated by `check-theme` (local + CI), #417 Section shells at three sizes and the info bubble kept
in its card, #418 the state-copy recipe (`references/states.md`), a neutral section skeleton and D37 in the reviewer,
#419 S2–S4 fixtures state each figure once, #420 strip footers inside their cell and qualifiers that wrap (argo's
body-composition P1), #421 the Meter reading at its fill end and captions that drop before they wrap (D38), #422 Sparkline
readouts above the plot and chart chrome at 390, #423 nested radii on the scale (argo's ViewTabs/Code P1). One harness
flake (S3 `item-flow` light/mobile/focus, "Clipped area … outside the resulting image"); a re-shoot passed, S3 is scored
from `r1-s3-retry`.

| Route       | r0 → r1 score | fixed | carried | new | unscored | Keel                                  |
| ----------- | ------------- | ----- | ------- | --- | -------- | ------------------------------------- |
| S2 training | 70 → 70       | 6     | 1       | 5   | 6        | close (state shells, readout × delta) |
| S3 agents   | 84 → 79       | 8     | 2       | 3   | 1        | close (strip craft)                   |
| S4 spend    | 70 → 87       | 12    | 5       | 4   | 4        | close (Budget tick figure)            |
| components  | (with S4) 94  |       |         |     |          | holds up                              |

The rest states moved (the P1 goal Meter, the zone names, the chips over the line, the footer that left its cell, the
Filled hover, the table error); what fails now is mostly state shells. New, basalt: the hosted readout covers the
StatCard delta line (S2 ×3, P2); list and Meter error/empty bodies keep the loaded height (S3 `stuck-items` P1, S4
spend-by-project/top-drivers, S2 readiness/top-lifts/training-load empty) — D37 covers charts only, so they are scored;
strip footer captions wrap and clip ("of €10 cap", week "€43 of / €50 cap") and the strip is still ~65 px ragged under
the day footer; a short Meter loading skeleton (training-load, goal); strip focus crops take in neighbouring cells.
Playground: summary sentences without a number, the S2 pace caption at the track start, a summary error without Retry,
the table wrapping at 390 and a pp delta written as %, "Subtle" alone at 390, the 1440 distribution headline reading
"median 23", the forecast figure stated twice, the cumulative tooltip copy, the budget empty without an action.

## Round 2 — batch 2 on master (r2, `6cf6fed5`, #424–#431, #433; 2.24.0 and 2.25.0 released between)

Landed: #424 `shot` counts painted placeholders as content, #425 a Section summary at the chart-text step (argo's Strength
shell at three sizes), #426 a one-row compact legend with an explicit `legend: false` kept absolute and the hosted readout
in its reserved line, #427 empty strip cells and null Meters state the gap once, #428 `placeholderHeight="content"` for list
and Meter cards (D44), #429 S2–S4 copy, #430 `shot detect` flags off-scale radii (nested always P1), #431 Bars in a visual
slot (argo's Reading pace tile), #433 the six list/Meter cards adopt `content`. 728 shots, 0 failed; detector 100.

| Route       | r1 → r2 score | fixed | carried | new | unscored | Keel                          |
| ----------- | ------------- | ----- | ------- | --- | -------- | ----------------------------- |
| S2 training | 70 → 91       | 9     | 3       | 1   | 3        | close (loading anatomy)       |
| S3 agents   | 79 → 91       | 3     | 2       | 0   | 4        | close (ragged strip, ~45 px)  |
| S4 spend    | 87 → 96       | 8     | 1       | 0   | 3        | close (error/loading anatomy) |
| components  | 94 → 97       | 4     | 1       | 1   | 1        | holds up                      |

No P1 is left on any route. What remains is state anatomy and copy: loading skeletons short of the loaded shape (strip
cells, the zoned and goal Meters, chart cards that drop the facts row and paint a blank plate), cause lines that restate
the failure and two or three wordings for one gap per page, the forecast caption ~105 px from the forecast fill end, the
390 sibling hero size under a wrapped qualifier, the table loading headers wrapping at 390 (Wave 39), and the S3 strip
~45 px ragged (D35's limit; a caption-only subgrid is future work). Lead rulings this round: the bare "Could not load"
under a titled card stays the house title (W37 #412); the 390 start-figure drop is D38 by design.

## Round 3 — batches 3 and 4 on master (r3, `802bc2ab`, #434–#440)

Landed: #434 one wording per gap and real causes, #435 chart cards load in the loaded shape (a facts skeleton, a plot ghost),
#436 strip and Meter loading in the loaded shape, the forecast caption at the forecast end, one figure size per phone
StatGroup; and argo's Wave 38 rows, three of them 2.24.0 regressions: #437 the Section subtitle at 12 and ChartCard actions
text at the chart step, #438 compact legends keep every series named (references fold, series first), #439 hosted readouts
keep their separator and their line, an opaque dark chip, first-point tooltips inside the card, #440 footer `shotAbsent`
and zone names that borrow free room. 728 shots, 0 failed; detector 100; master CI green.

| Route       | r2 → r3 score | fixed | carried | new | unscored | Keel                     |
| ----------- | ------------- | ----- | ------- | --- | -------- | ------------------------ |
| S2 training | 91 → 58       | 6     | 0       | 6   | 0        | close (state discipline) |
| S3 agents   | 91 → 84       | 2     | 2       | 3   | 0        | close (strip anatomy)    |
| S4 spend    | 96 → 92       | 3     | 1       | 3   | 0        | close (state discipline) |
| components  | 97 → 98       | 2     | 1       | 1   | 0        | holds up                 |

The drop is one regression with one cause: #434 passes `facts` in every state (as a consumer should), and a
`placeholderHeight="content"` card (#428) treats non-ready states as body-owned, so #435's facts gate lets the loaded
headline print above an empty message and over a loading skeleton — S2 goal, training-load, readiness, top-lifts (P1 each),
S3 stuck-items (P1), S4 spend-by-project and top-drivers (P2). Every other S2 item from r2 is fixed (loading shapes, the
390 figure size, one outage wording, the summary error anatomy). Still open: the S3 strip ~45 px ragged (a uniform cell
anatomy or visuals pinned to the cell floor, not equal-height cells, is the fix — the cells already share the row), chart
ghosts that draw bars for a line chart, the S3 day footer stating €10 twice, three remedies for one S4 gap, the components
table name ~540 px from its value, the table loading header at 390 (Wave 39).
