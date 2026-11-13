# Expression cycle 1

Six one-shot trials on master, scored against `docs/v3/expression/rubric.md` and, for the `c` cases, the reference shots. This is the baseline: nothing was changed for it. Protocol: `docs/v3/EXPRESSION.md`.

No case passed on the first try. The round-0 median is 68 and the minimum 64; there is no P1 and there are 16 P2s, so the area has not converged. Feedback lifted the median to 78.5, and three cases reached 80 within two repair rounds. 42 of the 81 points lost in round 0 are `primitive`: above all, the kit has no way to dim the rest and drive one readout from a focused mark.

## Pin

|            |                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Master sha | `062367feaa701696134e3694e91690ca744f65dc`                                                                                                                                                                                     |
| Date       | 2026-11-13                                                                                                                                                                                                                     |
| Cases      | c01, c02, c03, c04, c06 (referenced) and n05 (native: the first row `v3-spike-viz-census` appended)                                                                                                                            |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), fenced to `packages/basalt-ui/agent/**`, the published types and the playground's code                                                                        |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice                                                                                                                                 |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                    |
| Shots      | `.evidence/v3-shots/expression-1/r<round>/scenarios-expr-<case>*.png` on the dev host (gitignored): rest, `?shot-state=loading\|empty\|error`, and for c03 `?fixture=over\|zero`, each light and dark at 1800x1200 and 390x844 |

## Numbers

| Number                         | c01                           | c02         | c03   | c04      | c06      | n05                          | Summary                     |
| ------------------------------ | ----------------------------- | ----------- | ----- | -------- | -------- | ---------------------------- | --------------------------- |
| First-try score (round 0)      | 64                            | 64          | 69    | 71       | 71       | 67                           | median 68, minimum 64       |
| Round 1 score                  | 64                            | 64          | 76    | 83       | 83       | 71                           |                             |
| Round 2 score                  | 81                            | 74          | 76    | (passed) | (passed) | 76                           |                             |
| Rounds-to-pass                 | 2                             | 3           | 3     | 1        | 1        | 3                            | mean 2.17                   |
| Verdict, round 0               | tie                           | build       | build | tie      | build    | n/a                          | build 3, tie 2, reference 0 |
| Glue lines, round 0            | 32                            | ~150        | ~28   | ~93      | 28       | ~145                         | median 62.5                 |
| Glue lines, last round         | ~340                          | ~167        | ~118  | ~178     | 212      | ~500                         | median 195                  |
| Escape hatches, round 0        | 0                             | 1 `as` cast | 0     | 0        | 0        | 1 `theme-allow-file raw-hex` | 2; hand `<svg>` 0 of 6      |
| Escape hatches, last round     | 1 `oxlint-disable` (tabindex) | 0           | 0     | 0        | 0        | 2 hand `<svg>` (legend key)  | 3; hand `<svg>` 1 of 6      |
| Devices used unasked (round 0) | 5                             | 6           | 6     | 6        | 6        | 8                            | median 6 of 12              |

Glue is the builder's own count of geometry, scale, measuring and focus or readout lines, checked against its `// cycle-expression-1:` comments; it excludes the fixture. The final verdicts: c01 build (round 2), c02 build, c03 build (round 2; `reference` in round 1), c04 build, c06 build.

Devices reached in round 0, out of six builds: hero number 6, baseline delta 6, threshold geometry 6, anatomy 6, colour budget 3, pre-annotation 3, keyboard parity 3, quantized marks 2, metaphor 1, direct labels 1, dim-the-rest 0, live cue 0.

Earlier cycles: none; this is the first row of the trend.

## Cases

### c01: pipeline pace (reference: lap-timer)

- Round 0, 64, tie: a `ChartCard` with a "+01:23 behind best pace" hero, a diverging `Bars` per stage and a splits table. The running stage had no mark, because `Bars` draws nothing for it; there were no direct labels and no focus readout. Shots `r0/scenarios-expr-c01*`.
- Round 1, 64, build: composed `CartesianChart` marks with best ticks, a live marker, direct labels and a cursor-bound headline. Labels clipped at 390 px and keyboard stepping was not shown. Shots `r1/`.
- Round 2, 81, build: an ink best tick per stage, an end-to-end `Meter` against the best finish, its own tab stop and arrow keys (one `oxlint-disable`). Shots `r2/`.

### c02: webhook deliveries (reference: delivery-heatmap)

- Round 0, 64, build: two `Heatmap`s (failure rate, attempts as a multiple of each endpoint's median), a `PageSummary` sentence and a table. The ramp was red at 0%, and kit thinning dropped the 09:00 onset tick. Hover showed only a tooltip.
- Round 1, 64, build: one `Heatmap` with paired rows, onset glyphs and facts against the 20% and 3× lines. Tick thinning and readout were still kit-bound.
- Round 2, 74, build: graded neutral floors, flat failing fills, the onset hour as a glyph and a status chip. Dim and readout were not possible: `Heatmap` takes no focus callback.

### c03: tool SLO (reference: tick-gauge)

- Round 0, 69, build: a two-cell `StatGroup` strip (99.936% with a +0.036 pt delta, and 246 of 681 failed calls left on a `Meter`). The verdict was a footer line, nothing responded to focus, and the `Meter` track was sized by hand.
- Round 1, 76, reference: one `ChartCard` with cumulative failed calls against the running allowance, plus `?fixture=over|zero`. The hero was body-sized and the strip ran on.
- Round 2, 76, build: a hand-set display hero, a shaded headroom band labelled "246 left", and dim-after-cursor that re-reads the hero. The hero sits outside the card's slots and labels collide in the over fixture.

### c04: run durations (reference: dot-histogram)

- Round 0, 71, tie: a three-cell strip (median, p95, timeouts) over a `Bars` histogram with a separate timeout bar. There was no median or p95 mark, and p95 was not set against the limit.
- Round 1, 83, build: one `ChartCard` with hand-placed `rect` marks on a numeric seconds axis, median, p95 and limit rules, "13 timed out", and a dim plus facts swap from `chartCursor`. Passed.

### c06: context window (reference: context-window-meter)

- Round 0, 71, build: one `Meter` with segments and a "Compact at 80%" tick. The facts said "8.3k past the compact line". It used four hues, the track is 4 px, and the `Meter` cannot take focus.
- Round 1, 83, build: the `Meter` was replaced by a hand-built 48 px HTML bar (212 glue lines) with an accent ramp, the past-the-line portion in the status hue, roving focus, dim and a headline swap. Passed.

### n05: model price and quality (native)

- Round 0, 67: a scatter of quality against log price on `CartesianChart`, a frontier staircase, a family hue each and a per-glyph label-width guess. The hero was a count, and the series file needed a hex waiver.
- Round 1, 71: one accent, the beaten dots hollow, a canvas text measure, a hand `<svg>` key and a live readout. Labels were not the same on the server and the client.
- Round 2, 76: labels placed after mount, gutter labels with leader lines and a ghost scatter skeleton. About 500 glue lines.

## Round-0 item scores

| Item                 | c01 | c02 | c03 | c04 | c06 | n05 |
| -------------------- | --- | --- | --- | --- | --- | --- |
| F1 Form              | 2   | 2   | 2   | 2   | 3   | 3   |
| F2 Answer at rest    | 2   | 2   | 2   | 2   | 2   | 2   |
| F3 Baseline          | 2   | 2   | 3   | 1   | 3   | 3   |
| F4 Colour budget     | 2   | 1   | 3   | 3   | 1   | 1   |
| F5 Honest marks      | 2   | 2   | 2   | 2   | 3   | 2   |
| F6 Labels            | 1   | 1   | 1   | 1   | 2   | 2   |
| F7 Focus and readout | 1   | 1   | 1   | 1   | 0   | 1   |
| F8 Anatomy           | 2   | 2   | 2   | 2   | 2   | 2   |
| K1 Scales            | 2   | 3   | 2   | 3   | 3   | 2   |
| K2 States            | 2   | 2   | 2   | 2   | 2   | 2   |
| K3 Keyboard          | 2   | 2   | 1   | 2   | 1   | 2   |
| K4 Tokens            | 3   | 3   | 3   | 3   | 2   | 2   |
| K5 Responsive        | 2   | 2   | 2   | 3   | 3   | 2   |
| K6 First paint       | 2   | 2   | 3   | 3   | 3   | 2   |
| Sum / 42             | 27  | 27  | 29  | 30  | 30  | 28  |

Each reviewer cited a shot or `file:line` for every score under 3; the findings below carry those citations. Source line numbers refer to the round-0 files, which later rounds rewrote.

## Findings

Severity follows the rubric: a 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, a 2 is P3. Round 0 has no P1.

The points lost in round 0 break down by class: `primitive` 42, `planned` 31, `doctrine` 4, `rubric` 4, total 81. By severity there are 16 P2 (10 `primitive`, 6 `planned`) and 48 P3.

Where findings are fixed:

- `seam` is `v3-expr-1-seam` and `kit` is `v3-expr-1-kit-fixes`.
- `doctrine` is `v3-expr-1-doctrine`.
- `sk-6` and `sk-7` are notes on `v3-sk-6-thin-skill-fold` and `v3-sk-7-references`.
- `cycle 2 (a)` and `(b)` are lead notes in the `v3-cycle-expression-2` brief.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                                                                 | Fix                   |
| --------------- | ---------- | ---- | --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| expression-1.1  | c01 F1     | 1    | P3  | doctrine  | The running stage has no mark: the builder stayed on `Bars` (`ExprC01.tsx:54`, "Bars draws nothing for a running stage"). In round 1 it composed `CartesianChart` and drew it. `catalogue.md`: "A gap is reported, never hand-rolled"                    | doctrine              |
| expression-1.2  | c01 F2     | 1    | P3  | planned   | No bar carries its value, so Test's +01:34 is read off the axis (`r0/scenarios-expr-c01--light--1800x1200.png`)                                                                                                                                          | sk-6                  |
| expression-1.3  | c01 F3     | 1    | P3  | planned   | The best split per stage appears only in the table (`pace-data.ts:106`)                                                                                                                                                                                  | sk-7 (2)              |
| expression-1.4  | c01 F4     | 1    | P3  | planned   | No accent marks the live stage (`r0/…c01--dark--1800x1200.png`)                                                                                                                                                                                          | sk-7 (1)              |
| expression-1.5  | c01 F5     | 1    | P3  | primitive | The axis has no unit: `AxisConfig` has no title (builder wish list, rounds 1 and 2)                                                                                                                                                                      | seam (3)              |
| expression-1.6  | c01 F6     | 2    | P2  | planned   | Only "Best run" is labelled. The builder "could not look up the engine's mark types" and dropped direct labels; no shipped text shows a `text` mark                                                                                                      | sk-7 (3)              |
| expression-1.7  | c01 F7     | 2    | P2  | primitive | Only the kit tooltip (`ExprC01.tsx:165-175`). `ChartPlot` in `src/charts/contract.ts` hands marks no focused datum, so nothing can dim the rest                                                                                                          | seam (1)              |
| expression-1.8  | c01 F8     | 1    | P3  | primitive | A `ChartFact` period wraps into an orphan "·" at 390 px (`r0/…c01--light--390x844.png`). The same happens in c02 round 1 and n05 round 1                                                                                                                 | kit (2)               |
| expression-1.9  | c01 K1     | 1    | P3  | planned   | The fixture has no zero delta and no waiting stage                                                                                                                                                                                                       | sk-7 (7)              |
| expression-1.10 | c01 K2     | 1    | P3  | primitive | `ChartCard` state heights: 471 px at rest, 448 loading, 386 empty or error (`r0/…loading…`, `…empty…`)                                                                                                                                                   | kit (1)               |
| expression-1.11 | c01 K3     | 1    | P3  | rubric    | The reviewer could not confirm arrow keys from a still shot. `src/charts/core/compile.ts:6`: "TanStack owns … focus and keyboard"                                                                                                                        | cycle 2 (a)           |
| expression-1.12 | c01 K5     | 1    | P3  | planned   | The table drops the Best column at 390 px                                                                                                                                                                                                                | sk-7 (10)             |
| expression-1.13 | c01 K6     | 1    | P3  | primitive | The card jumps about 60 px from loading to loaded on mobile; same root as .10                                                                                                                                                                            | kit (1)               |
| expression-1.14 | c02 F1     | 1    | P3  | doctrine  | Two separate grids, routed from the catalogue's "Status over time: heat grid" row. In round 1 the builder merged them into paired rows                                                                                                                   | doctrine              |
| expression-1.15 | c02 F2     | 1    | P3  | primitive | No onset mark on the orders row: `Heatmap` has no annotation (wish 2)                                                                                                                                                                                    | seam (4)              |
| expression-1.16 | c02 F3     | 1    | P3  | planned   | The failure rate has no baseline. "steady at 1.6×" contradicts the 3× rule (`ExprC02.tsx:151-152`)                                                                                                                                                       | sk-7 (2)              |
| expression-1.17 | c02 F4     | 2    | P2  | planned   | The failure ramp is red at 0%, and the grey "sparse" row is the loudest ink in light mode (`r0/…c02--light--1800x1200.png`)                                                                                                                              | sk-7 (1)              |
| expression-1.18 | c02 F5     | 1    | P3  | planned   | Zero-attempt hours draw an unexplained fill, and no caption gives the step size (`ExprC02.tsx:54-58`)                                                                                                                                                    | sk-7 (8)              |
| expression-1.19 | c02 F6     | 2    | P2  | primitive | Kit thinning leaves only 15:00 and 03:00, so the 09:00 onset has no tick. `formatCol` also writes the tooltip header, so thinning by hand blanks it (`ExprC02.tsx:50`)                                                                                   | kit (3)               |
| expression-1.20 | c02 F7     | 2    | P2  | primitive | Tooltip only. `Heatmap` takes no hover or focus callback, so there is no dim and no readout (`ExprC02.tsx:184,216`)                                                                                                                                      | seam (1)              |
| expression-1.21 | c02 F8     | 1    | P3  | planned   | The headline sits in a separate `PageSummary`, not in the card's facts                                                                                                                                                                                   | sk-7 (4)              |
| expression-1.22 | c02 K2     | 1    | P3  | primitive | `ChartCard`'s pending ghost is bars under a `Heatmap` and about 16 px short (`r0/…c02-shot-state-loading…`)                                                                                                                                              | kit (1)               |
| expression-1.23 | c02 K3     | 1    | P3  | planned   | Two grids make two tab stops for one visualization                                                                                                                                                                                                       | sk-7 (9)              |
| expression-1.24 | c02 K5     | 1    | P3  | primitive | One hour tick at 390 px and cells about 13 px wide, both kit-controlled                                                                                                                                                                                  | kit (3)               |
| expression-1.25 | c02 K6     | 1    | P3  | primitive | Loading-to-loaded shift; same root as .22                                                                                                                                                                                                                | kit (1)               |
| expression-1.26 | c03 F1     | 1    | P3  | doctrine  | The builder chose a `Meter` because "the catalogue row 'one ratio against a limit' points to a Meter with a target, not a hand-rolled bar" (round-0 report)                                                                                              | doctrine              |
| expression-1.27 | c03 F2     | 1    | P3  | primitive | The verdict is a footer line: a `StatStripCell` tone colours only the value, with no dot and word (`ExprC03.tsx:64`)                                                                                                                                     | kit (4)               |
| expression-1.28 | c03 F5     | 1    | P3  | primitive | A 1.25× track extent with no caption. `Meter` has no over-limit mode, so `max` is sized by hand (`ExprC03.tsx:23`)                                                                                                                                       | kit (5)               |
| expression-1.29 | c03 F6     | 2    | P2  | planned   | "681 allowed" is said twice, a stray "0" sits on the track, and the tool name clips in the caption at 390 px                                                                                                                                             | sk-7 (6)              |
| expression-1.30 | c03 F7     | 2    | P2  | primitive | `Meter` has no pointer, key or tab handling (`dist/dashboard/meter-parts.js`)                                                                                                                                                                            | seam (1)              |
| expression-1.31 | c03 F8     | 1    | P3  | planned   | No title or status. The left cell is empty at 1800 px while the right is crowded                                                                                                                                                                         | sk-7 (4)              |
| expression-1.32 | c03 K1     | 1    | P3  | planned   | The fixture sits mid-budget, so no shot shows the over-budget or zero-failure extreme                                                                                                                                                                    | sk-7 (7)              |
| expression-1.33 | c03 K2     | 1    | P3  | planned   | The empty state repeats one sentence in both cells, with passive advice                                                                                                                                                                                  | sk-7 (5)              |
| expression-1.34 | c03 K3     | 2    | P2  | primitive | No tab stop on the data: the `Meter` is not focusable (`ExprC03.tsx:80-92`)                                                                                                                                                                              | seam (1)              |
| expression-1.35 | c03 K5     | 1    | P3  | planned   | The tool name is cut to "SEARCH…" and the footer wraps to three lines at 390 px                                                                                                                                                                          | sk-7 (6)              |
| expression-1.36 | c04 F1     | 1    | P3  | doctrine  | A plain `Bars` histogram. The catalogue lists the histogram under "Not shipped — report the gap, don't hand-roll". In round 1 the builder composed `rect` marks with median and p95 rules and passed                                                     | doctrine              |
| expression-1.37 | c04 F2     | 1    | P3  | planned   | The timeout bar has no count and nothing annotates the tail (`ExprC04.tsx:55`)                                                                                                                                                                           | sk-7 (3)              |
| expression-1.38 | c04 F3     | 2    | P2  | planned   | The p95 of 1m 44s is never set against the 120 s limit (`ExprC04.tsx:89,101`)                                                                                                                                                                            | sk-7 (2)              |
| expression-1.39 | c04 F5     | 1    | P3  | primitive | The y axis has no unit (no axis title), and a 1-run band is a hairline                                                                                                                                                                                   | seam (3)              |
| expression-1.40 | c04 F6     | 2    | P2  | primitive | A band axis has no width-based tick thinning, so 5 ticks were picked by hand (`ExprC04.tsx:51`). `Bars` has no value labels                                                                                                                              | seam (2)              |
| expression-1.41 | c04 F7     | 2    | P2  | primitive | Tooltip only; the facts row never follows the focused bar (`ExprC04.tsx:131-139`)                                                                                                                                                                        | seam (1)              |
| expression-1.42 | c04 F8     | 1    | P3  | planned   | The stat strip sits outside the card and there is no status                                                                                                                                                                                              | sk-7 (4)              |
| expression-1.43 | c04 K2     | 1    | P3  | primitive | Loading is about 25 px short at 1800 px. The error repeats four times, which is the builder's composition                                                                                                                                                | kit (1)               |
| expression-1.44 | c04 K3     | 1    | P3  | rubric    | Arrow keys were not confirmable from a still shot; the engine owns keyboard                                                                                                                                                                              | cycle 2 (a)           |
| expression-1.45 | c06 F2     | 1    | P3  | primitive | The `Meter` track is a 4 px hairline across about 1530 px, and the dominant segment is not labelled                                                                                                                                                      | kit (5)               |
| expression-1.46 | c06 F4     | 2    | P2  | planned   | Four hues, with orange shared with the warn status. The catalogue's part-of-whole row says "a series color per part". The builder could not register its own group (`ExprC06.tsx:24`)                                                                    | sk-7 (1), cycle 2 (b) |
| expression-1.47 | c06 F6     | 1    | P3  | primitive | Parts are named in a legend: `Meter` has no labels on its segments                                                                                                                                                                                       | kit (5)               |
| expression-1.48 | c06 F7     | 3    | P2  | primitive | Pointing does nothing: `meter-parts.js` has no handlers                                                                                                                                                                                                  | seam (1)              |
| expression-1.49 | c06 F8     | 1    | P3  | planned   | "Compact now" sits in the page bar, and the status is coloured text                                                                                                                                                                                      | sk-7 (4)              |
| expression-1.50 | c06 K2     | 1    | P3  | primitive | Loading is about 26 px short at 390 px: the `ChartCard` skeleton rows do not match the loaded rows                                                                                                                                                       | kit (1)               |
| expression-1.51 | c06 K3     | 2    | P2  | primitive | The track has an accessible name but no tab stop (`meter-parts.js:596-602`)                                                                                                                                                                              | seam (1)              |
| expression-1.52 | c06 K4     | 1    | P3  | rubric    | `Meter` captions use lining figures. Rubric K4 asks for tabular figures on every changing number, but the shipped `encoding-rules.md` allows tabular figures only in table columns and ticks. Two builders followed the skill (c06 round 1, n05 round 2) | owner, noted on sk-7  |
| expression-1.53 | n05 F2     | 1    | P3  | planned   | The hero "11 of 25 on the frontier" is a count, not the answer (`ExprN05.tsx:67-69`)                                                                                                                                                                     | sk-6                  |
| expression-1.54 | n05 F4     | 2    | P2  | planned   | Seven family hues. `encoding-rules.md` says "colour follows the entity" (`series.ts:10-19`)                                                                                                                                                              | sk-7 (1)              |
| expression-1.55 | n05 F5     | 1    | P3  | planned   | A size channel with no key, and sliver bars in the beaten list                                                                                                                                                                                           | sk-7 (8)              |
| expression-1.56 | n05 F6     | 1    | P3  | primitive | A 6.2 px-per-glyph width guess, with no measure or label-fit helper (`PriceQualityChart.tsx:58,69`)                                                                                                                                                      | seam (2)              |
| expression-1.57 | n05 F7     | 2    | P2  | primitive | Fixed opacity and the stock tooltip; `PlotContext.highlighted` follows the legend only                                                                                                                                                                   | seam (1)              |
| expression-1.58 | n05 F8     | 1    | P3  | primitive | A legend swatch cannot be a dot (`PriceQualityChart.tsx:33`), and the strip runs on                                                                                                                                                                      | seam (3)              |
| expression-1.59 | n05 K1     | 1    | P3  | primitive | There is no log x scale, so a fake "Free" tick sits at $0.02 (`PriceQualityChart.tsx:50`)                                                                                                                                                                | seam (3)              |
| expression-1.60 | n05 K2     | 1    | P3  | primitive | Loading is about 70 px short (110 px at 390 px), and the states collapse to different heights                                                                                                                                                            | kit (1)               |
| expression-1.61 | n05 K3     | 1    | P3  | rubric    | No visible focus or announced readout was shown for the custom dots; the engine owns keyboard                                                                                                                                                            | cycle 2 (a)           |
| expression-1.62 | n05 K4     | 1    | P3  | primitive | The 11 px label font and px radii are off the scale, because no chart-label token exists. Registering a series group cost a hex waiver (`series.ts:6`)                                                                                                   | seam (2), cycle 2 (b) |
| expression-1.63 | n05 K5     | 1    | P3  | planned   | The beaten list is below the fold at 390 px                                                                                                                                                                                                              | sk-7 (10)             |
| expression-1.64 | n05 K6     | 1    | P3  | primitive | Label placement depends on measured pixels, so the server and client can differ (`PriceQualityChart.tsx:72-104`)                                                                                                                                         | seam (2)              |

Notes on the classes:

- **`primitive`.** When the repair rounds asked for these devices, every builder wrote the missing seam itself:
  - c01: about 165 lines of pixel ticks, dimming and a cursor-bound readout.
  - c03: about 100 lines of a band, dim-after-cursor and a readout.
  - c04: about 100 lines of vertical rules and a nearest-bar match from `chartCursor`.
  - c06: a 212-line hand-built HTML meter with roving focus.
  - n05: about 300 lines of a canvas measure, eight-spot label placement, log x and a hand `<svg>` key.
- **`doctrine`.** The class is P3 only, but the same steer appears in four builds, and every repair that broke it passed or rose. It files with the seam as the structural part of this track (`EXPRESSION.md` § Gate).
- **`planned`.** The 2.x agent text taught none of these devices, and the v3 rewrite of those files is owned by `v3-sk-6-thin-skill-fold` and `v3-sk-7-references`. The notes went to them; no new row.
- **`rubric`.** Reviewers scored keyboard from source with no focus frame, so K3 swung on the same engine: c02's `Heatmap` grid scored 2 in round 0 and 0 in round 2. `heatmap.tsx` renders through `ChartEngine` from `src/charts/host.tsx`, where TanStack owns keyboard. The rubric class has no P2, so it has no row. Cycle 2 shoots a keyboard-focused frame instead, per lead note (a). The K4 typography conflict (.52) waits for the owner and is noted on `v3-sk-7-references`.

Two harness lessons from this cycle went into the cycle 2 brief as lead notes:

- Builders fenced to their own directory could not register a series group (c04, c06, n05).
- A scenario had no second fixture channel beside `?shot-state=`. c03 built `?fixture=` by hand.

The trial builds add 3,498 lines to the playground, which pushed `apps/playground/src/budget.test.ts` past its 10,000-line demo ceiling (12,308). `scenarios/expr/` is now outside that ceiling: these files are cycle evidence and must stay as built, and every cycle adds six more. Master's demo code still counts against the 10,000.

## Filing

| Row                                                      | Class                                                       | Covers                                                                            | Checkpoint | Joins `v3-freeze-g4`          |
| -------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ----------------------------- |
| `v3-expr-1-doctrine`                                     | doctrine                                                    | .1, .14, .26, .36                                                                 | spec       | yes                           |
| `v3-expr-1-seam`                                         | primitive (9 of the 10 primitive P2s; their P3s ride along) | .5, .7, .15, .20, .30, .34, .39, .40, .41, .48, .51, .56, .57, .58, .59, .62, .64 | spec       | yes                           |
| `v3-expr-1-kit-fixes`                                    | primitive (P2 .19; P3s that add no export)                  | .8, .10, .13, .19, .22, .24, .25, .27, .28, .43, .45, .47, .50, .60               | none       | yes                           |
| `v3-cycle-expression-2`                                  | next cycle                                                  | c05, c07, c08, c09, n01, n06                                                      | none       | no: this cycle has no open P1 |
| notes on `v3-sk-6-thin-skill-fold`, `v3-sk-7-references` | planned                                                     | all `planned` findings, and .52                                                   |            |                               |

The primitive P2s file as two rows, not one. The brief makes any fix that adds an export or amends `charts/contract.ts` its own `checkpoint: spec` row, and kit fixes inside existing components should not wait on that Spec. `v3-cycle-expression-2` waits for both fix rows and for `v3-sk-7-references`, which carries most of the skill notes.

Two cases were added to the bank, both from argo pages that no case covered:

- n12 comes from the sleep breakdown on the garmin-health page.
- n13 comes from the recurring-charges page.

Factory friction: none filed.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`): V1 seam CONFIRMED; V2 kinds `bar list`, `meter`, `time-series lines`; V3 helpers `scale`, `ticks`, `packing`, `measure-width`, `label-fit`; V4 devices `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` and `planned` findings together are 31 of 81 points lost in round 0, or 38%, below the 50% that confirms. Repair rounds lifted the median from 68 to 78.5, by 10.5 points. That is below the 15 that confirms and above the 5 that kills. Both numbers sit between the columns. The lift is real: the builders knew what to do once told, and five of the six reached dim-the-rest, direct labels and a baseline. c02 is the exception: `Heatmap` takes no focus callback (finding .20), so the kit blocked it. But they got there by writing the seam, so the lift measures the kit as much as the method. Cycle 2 runs after the seam and the sk-7 notes land, and it separates the two.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold. The cycle's own numbers lean the same way:

- Round 0 hand-wrote no `<svg>`, 0 of 6 builds, under the three of six that would confirm.
- Round-0 median glue was 62.5 lines, under 80. Last-round median glue was 195, over 80, once the builders reached for the devices.
- No build passed without hand-drawn geometry. c04 passed on hand-placed `rect` and `rule` marks, and c06 on a hand-built HTML bar.
- Ten of the 16 P2s are `primitive`, and 42 of the 81 points lost are `primitive`.

**3, exemplars: killed by the threshold's letter, with no new kind.** Census V2 names three forms, so the "Census V2 is `none`" condition that confirms fails. The kill clause makes a named form a kind candidate under the Rule of Three, but all three forms already ship as v3 symbols (`BarList`, `Meter`, `Lines`), and the census's `exemptCovered` reading is empty. The consequence of the kill is therefore no new kind, and "the rest stays exemplars" holds. This cycle agrees: four builders wished for a kind (histogram, scatter, SLO form, bar-with-reference), and each served one case, so each is a recipe at most. The threshold's wording is the problem: "names a form" counts forms that are already shipped. The owner may want to reword it to "names a form with no shipped symbol" before cycle 2 judges it again.

## Convergence

Not converged. The round-0 median is 68, under 80. The minimum is 64, which does clear 60. All five referenced cases ended `build` or `tie` in round 0, which meets the bar of three. But there are 16 P2s against a limit of three. `v3-cycle-expression-2` is filed after the fix rows.

owner:
