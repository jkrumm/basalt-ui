# Expression cycle 2

Six one-shot trials on master after the geometry seam, the kit fixes and the v3 design references landed, scored against `docs/v3/expression/rubric.md` and, for the `c` cases, the reference shots. Protocol: `docs/v3/EXPRESSION.md`.

One case passed on the first try: n06 at 88. The round-0 median fell to 66.5 from cycle 1's 68, and the minimum to 48. There is no P1 and there are 17 P2s, so the area has not converged. Repair rounds lifted the median to 78.5, the same final median as cycle 1, and two more cases reached 80. The seam did its job: no build hand-wrote an `<svg>`, every hand-drawn form wired focus through `useChartFocus`, and last-round glue fell from a median of 195 lines to 67.5. 47 of the 84 points lost in round 0 are `skill`: the builders knew the devices from the references and still left them out. 14 more trace to the 2.x layer that master still ships next to v3.

## Pin

|            |                                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Master sha | `ac6acc90c9cd0c3e708f1be691ce561f7666077f`                                                                                                                                                                                                                                           |
| Date       | 2026-11-14                                                                                                                                                                                                                                                                           |
| Cases      | c05, c07, c08, c09 (referenced) and n01, n06 (native)                                                                                                                                                                                                                                |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), fenced to `packages/basalt-ui/agent/**`, `llms.txt`, the published types and docs, and the playground's own code, minus every other `scenarios/expr/` directory                                                     |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice                                                                                                                                                                                       |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                          |
| Shots      | `.evidence/v3-shots/expression-2/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored): rest, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, and a keyboard frame `--focus--`, each light and dark at 1800x1200 and 390x844 |

The keyboard frame answers cycle 1's lead note (a). A lead script (`.evidence/v3-shots/expression-2/focus-shots.ts`, not in git) focuses the first tabbable data element in `<main>`, presses ArrowRight twice and shoots. It logs the focused element and the text of every `aria-live` region, and each reviewer got that log. Rounds 0 and 1 shot two frames after the key press. From round 2 the script waits 500 ms, because c07 and c08 put `transition-opacity` on their marks and the round-1 frames caught the dim mid-fade. That timing touched only the F7 scores of c07 and c08 in round 1, never round 0.

## Numbers

| Number                         | c05                                       | c07                     | c08             | c09               | n01                       | n06               | Summary                     |
| ------------------------------ | ----------------------------------------- | ----------------------- | --------------- | ----------------- | ------------------------- | ----------------- | --------------------------- |
| First-try score (round 0)      | 60                                        | 48                      | 69              | 69                | 64                        | 88                | median 66.5, minimum 48     |
| Round 1 score                  | 69                                        | 74                      | 79              | 71                | 69                        | (passed)          |                             |
| Round 2 score                  | 71                                        | 71                      | 85              | 81                | 76                        | (passed)          | last-round median 78.5      |
| Rounds-to-pass                 | 3                                         | 3                       | 2               | 2                 | 3                         | 0                 | mean 2.17                   |
| Verdict, round 0               | build                                     | tie                     | build           | build             | n/a                       | n/a               | build 3, tie 1, reference 0 |
| Glue lines, round 0            | ~45 (+~90 CSS)                            | ~8                      | ~60             | ~55               | ~15                       | ~70               | median 50                   |
| Glue lines, last round         | ~65                                       | ~55                     | ~100            | ~135              | ~50                       | ~70               | median 67.5                 |
| Escape hatches, round 0        | 5 `theme-allow` + CSS waivers, `@mantine` | 1 `as` cast             | 3 `theme-allow` | 0                 | 1 `as` cast               | 0                 | hand `<svg>` 0 of 6         |
| Escape hatches, last round     | 13 `theme-allow`                          | 2 `theme-allow`, 1 `as` | 4 `theme-allow` | `@mantine` layout | 1 `as`, `@mantine` layout | `@mantine` layout | hand `<svg>` 0 of 6         |
| Devices used unasked (round 0) | 6                                         | 5                       | 7               | 7                 | 4                         | 8                 | median 6.5 of 12            |

Glue is the builder's own count of geometry, tick, label placement, measuring and focus or readout lines, checked against its `// cycle-expression-2:` comments. It excludes the fixture, and so do the escape-hatch counts (c09's `fixture.ts` holds one `as Version`). No build used a lint disable or a deep import. Five of six read `?fixture=` from the raw location string, because the scenario route's `validateShotSearch` drops every key but `shot-state`. `@mantine` layout means `Stack`, `SimpleGrid` or `Box` copied from the playground's 2.x code. c08 appended one series group (`traceColors`) to `apps/playground/src/demo/series.ts` under lead note (b) and stopped using it in round 2. No other builder registered a group. The final verdicts are all `build`: c05 and c07 after round 2, c08 and c09 passing in round 2.

Devices reached in round 0, out of six builds: hero number 6, anatomy 6, colour budget 5, keyboard parity 5, direct labels 4, pre-annotation 3, threshold geometry 3, baseline delta 2, dim-the-rest 2, live cue 1, quantized marks 0, metaphor 0. Cycle 1 reached keyboard parity 3 and dim-the-rest 0. The seam moved both.

### Trend

| Cycle | Sha        | First-try median | Minimum | Last-round median | Rounds-to-pass, mean | Verdicts (build, tie, reference) | P1  | P2  | Glue median, round 0 to last | Hand `<svg>`, last round |
| ----- | ---------- | ---------------- | ------- | ----------------- | -------------------- | -------------------------------- | --- | --- | ---------------------------- | ------------------------ |
| 1     | `062367fe` | 68               | 64      | 78.5              | 2.17                 | 3, 2, 0                          | 0   | 16  | 62.5 to 195                  | 1 of 6                   |
| 2     | `ac6acc90` | 66.5             | 48      | 78.5              | 2.17                 | 3, 1, 0                          | 0   | 17  | 50 to 67.5                   | 0 of 6                   |

## Cases

### c05: contract renewals (reference: renewal-rings)

- **Round 0, 60, build.** A notice ladder: one HTML row per contract on a 12-month track, a notice dot and a renewal square, dim and readout through `useChartFocus`. The 60-day limit was only a colour switch. The euro rounding read €1.24M as "€1m". A passed notice was clamped onto today. In light the notice text was nearly invisible. Shots `r0/scenarios-expr-c05*`.
- **Round 1, 69, build.** A dashed 60 d rule, a pre-annotated largest auto-renewal, a hollow ring for a closed notice and a sticky caption. The axis labels painted nothing, and the sticky caption did not hold inside the card.
- **Round 2, 71, build.** Axis labels, a 30-day past window, five legend swatches. The sticky caption now covered the card's own title and legend.

### c07: eval run against its baseline (reference: eval-results)

- **Round 0, 48, tie.** A `PageSummary` sentence, a `StatCard` with a pp delta, four count cells and a `DataTable` of all 60 cases. Nothing marked a case, so focus dimmed nothing and read nothing. Shots `r0/scenarios-expr-c07*`.
- **Round 1, 74, build.** One square per case, regressed and fixed first, a "5 regressed, 12 fixed" bracket, a unit caption, focus with a readout of input, expected and actual. In light the flips were paler than the held squares.
- **Round 2, 71, build.** Glyphs on the flips, the delta as text, a swatch legend in place of the stat strip. Light mode still inverted the hierarchy, and the caption clipped at the frame's edge.

### c08: one slow agent run (reference: run-trace)

- **Round 0, 69, build.** A waterfall in `ChartCard`, indented by depth on a 0–8 s axis, tinted by kind, with dim and readout. Durations sat in a column up to 1,100 px from short bars. The ticks were hard-coded and stopped short of the 8.12 s run. Shots `r0/scenarios-expr-c08*`.
- **Round 1, 79, build.** The failed bar in the status fill, labels at the bar ends, gridlines, data-driven ticks and a 12-row ghost. Gridlines cut the labels, and the rows did not visibly dim in the frame.
- **Round 2, 85, build.** Neutral bars with one accent for the slowest and the status fill for the failed step, single-line rows and no gridlines. Passed.

### c09: deployed versions and quality (reference: deploy-timeline)

- **Round 0, 69, build.** `Lines` with a red band for the rolled-back version, a green band for the live one, deploy rules, a 98 % target rule and a deploy log. Version labels overprinted at 390 px, and nothing dimmed. Shots `r0/scenarios-expr-c09*`.
- **Round 1, 71, build.** Signed deltas against the target, swatches on the facts, bands that dim by version and PageUp/PageDown by version. The fact strip collapsed from two facts to one on focus, so the page jumped 70 px at 390.
- **Round 2, 81, build.** Moved from `Lines` to `CartesianChart` custom marks to get a version lane above the plot and a labelled trough. Passed. `VX.bad` as text was illegible in light.

### n01: home internet line (native)

- **Round 0, 64.** A three-cell strip (drops, time down, median download against 250 Mbit/s), downtime per day as `Bars`, an outage `EventList` and a 720-point speed `Lines` with a below-90 % zone. No headline had a baseline. Focus moved the readout but marked nothing. Shots `r0/scenarios-expr-n01*`.
- **Round 1, 69.** Deltas against the prior 30 days and the contract, labelled rules on the long outage and the degraded stretch, a `BarList` of outages and dimmed bars. The rule labels sat on the lines, and the status tones were inverted.
- **Round 2, 76.** One status hue, a "75 % of hours hold" hero over daily medians, and an "Up all 30 days" cue. The daily median hid the hourly dips the hero counts.

### n06: usage window (native)

- **Round 0, 88, passed.** A cumulative `Lines` chart from window start to reset, with a dashed 100 % cap, a dashed projection at the window's pace and an "Out" rule where it meets the cap. The hero is the run-out time "13:52", with "8 min before the 14:00 reset". It has four fixtures: runout, safe, exhausted and zero. It lost a verb on the hero, a label collision at 390 and the 2.x card's legend-row and lining-figure defects. Shots `r0/scenarios-expr-n06*`.

## Round-0 item scores

| Item                 | c05   | c07   | c08   | c09   | n01   | n06   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 3     | 1     | 3     | 3     | 2     | 3     |
| F2 Answer at rest    | 2     | 2     | 2     | 2     | 2     | 2     |
| F3 Baseline          | 1     | 2     | n/a   | 2     | 1     | 3     |
| F4 Colour budget     | 2     | 2     | 2     | 2     | 2     | 3     |
| F5 Honest marks      | 1     | 1     | 3     | 3     | 2     | 3     |
| F6 Labels            | 1     | 1     | 1     | 1     | 1     | 2     |
| F7 Focus and readout | 2     | 0     | 2     | 2     | 1     | 2     |
| F8 Anatomy           | 2     | 2     | 2     | 2     | 2     | 3     |
| K1 Scales            | 2     | 2     | 2     | 2     | 2     | 3     |
| K2 States            | 2     | 1     | 1     | 2     | 2     | 2     |
| K3 Keyboard          | 2     | 1     | 2     | 2     | 2     | 3     |
| K4 Tokens            | 1     | 2     | 3     | 2     | 3     | 2     |
| K5 Responsive        | 2     | 1     | 2     | 2     | 3     | 3     |
| K6 First paint       | 2     | 2     | 2     | 2     | 2     | 3     |
| Sum / max            | 25/42 | 20/42 | 27/39 | 29/42 | 27/42 | 37/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 files, which later rounds rewrote. The n06 reviewer labelled two of its 2s "P1". The lead applied the rubric's rule instead: a 2 is P3.

## Findings

Severity follows the rubric: a 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, and a 2 is P3. Round 0 has no P1. c07 F7 is a 0, but F7 is not a P1 item.

Points lost in round 0 by class: `skill` 47, `primitive` 23, `planned` 14, total 84. By severity: 17 P2 (8 `skill`, 6 `primitive`, 3 `planned`) and 49 P3. No point is `doctrine`, `rubric` or `case`.

Two facts about master decide the `planned` class. Both came from the builders' wish lists and were checked by the lead:

- **Two ChartCards.** `basalt-ui/charts` exports the 2.x `ChartCard` (`src/charts/ChartCard.tsx`: `facts`, `state`, children, lining figures). The generated docs and the shipped references describe the v3 part (`src/charts/parts/chart-card.tsx`: `figure` with `status`, a fixed box, tabular figures), which no subpath exports yet. Four of six builders reported the mismatch and followed `dist`. `v3-teardown-views` deletes the 2.x files and their barrel lines.
- **Two `--vx-bad`.** v3 `tokens.css` sets `--vx-bad: #af3b39` in light. In the playground the 2.x provider's palette overrides it at runtime with `color-mix(in srgb, #b5403d 18%, transparent)` (`--vx-good` 18 %, `--vx-warn` 8 %), measured on `/scenarios/expr-c07`. So every v3 status fill, the `Status` dot, the `StatCard` delta and `VX.bad` text render as pale tints in light. `v3-teardown-runtime` deletes `src/provider`.

Where findings are fixed:

- `skill (n)` is item n of `v3-expr-2-skill`.
- `kit (n)` is item n of `v3-expr-2-kit-fixes`.
- `seam (n)` is item n of `v3-expr-2-seam-tracks`.
- `views` and `runtime` are notes on `v3-teardown-views` and `v3-teardown-runtime`.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                                           | Fix       |
| --------------- | ---------- | ---- | --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| expression-2.1  | c05 F2     | 1    | P3  | skill     | The hero says "4 notices due within 60 d", but no mark annotates Helix (largest value, auto-renews, notice in 12 d). The closed, auto-renewing Northwind row is not counted (`r0/…c05--dark--1800x1200.png`)                       | skill (1) |
| expression-2.2  | c05 F3     | 2    | P2  | skill     | "Within 60 d" exists only as a colour switch (`ExprC05.tsx:42-46`). Neither figure has a delta or target (`:163-176`). `references/charts.md` § "A headline value has a baseline" teaches it                                       | skill (2) |
| expression-2.3  | c05 F4     | 1    | P3  | skill     | Two status hues plus an amber-tinted hero                                                                                                                                                                                          | skill (3) |
| expression-2.4  | c05 F5     | 2    | P2  | skill     | `eur()` rounds €1.24M to "€1m" and the total to "€2m" (`:25`). `pct()` clamps a notice closed 14 d ago onto today (`:32-33`). No threshold geometry                                                                                | skill (6) |
| expression-2.5  | c05 F6     | 2    | P2  | planned   | In light the notice text is nearly invisible: `--vx-warn` as text resolves to an 8 % tint at runtime. It is also status-as-text, which the rule forbids (`ExprC05.module.css:90-98`). Renewal copy clips at 1800 (`:72-77`)        | runtime   |
| expression-2.6  | c05 F7     | 1    | P3  | primitive | Dim and readout work at 1800. At 390 the readout in the card header scrolls away when a lower row takes focus (`r0/…c05--focus--light--390x844.png`). c08 round 1 hit the same                                                     | seam (4)  |
| expression-2.7  | c05 F8     | 1    | P3  | primitive | The legend is a hand-built row in the body and the figures have no swatches (`:65-82`). No legend part takes a seam-drawn mark                                                                                                     | seam (3)  |
| expression-2.8  | c05 K1     | 1    | P3  | skill     | The clamp and the rounding misreport the extreme value (as .4)                                                                                                                                                                     | skill (6) |
| expression-2.9  | c05 K2     | 1    | P3  | planned   | Loading is 35 px short at 1800, with 52 against 55 px rows. The 2.x card takes the body's height, while the v3 card's fixed box keeps every phase at the loaded height                                                             | views     |
| expression-2.10 | c05 K3     | 1    | P3  | skill     | The focus ring wraps the whole list and no row is marked as focused. At 390 the ring is a thin edge                                                                                                                                | skill (5) |
| expression-2.11 | c05 K4     | 2    | P2  | skill     | No `tabular-nums`. Status colour as text in a CSS module, where `status-fill-as-text` does not reach. Off-scale px under waivers. `Skeleton` from `@mantine/core` (`:8`)                                                           | skill (5) |
| expression-2.12 | c05 K5     | 1    | P3  | skill     | A 240 px header at 390 leaves 7 of 12 rows on the first screen                                                                                                                                                                     | skill (7) |
| expression-2.13 | c05 K6     | 1    | P3  | skill     | The row opacity transition has no reduced-motion guard (`ExprC05.module.css:41`). c08 does the same                                                                                                                                | skill (5) |
| expression-2.14 | c07 F1     | 2    | P2  | skill     | A stat card, four counts and a text table, with no mark per case (`ExprC07.tsx:145-166`). `references/encoding.md`: "Many rows with several attributes is a DataTable". In round 1 one square per case raised F1 to 3              | skill (4) |
| expression-2.15 | c07 F2     | 1    | P3  | skill     | Three flipped cases sit below the 14-row cut (`:165`)                                                                                                                                                                              | skill (1) |
| expression-2.16 | c07 F3     | 1    | P3  | planned   | The "+11.7 pp vs baseline" chip is nearly invisible in light: the `StatCard` delta reads the tinted status token                                                                                                                   | runtime   |
| expression-2.17 | c07 F4     | 1    | P3  | skill     | Red and green on both the Change and the This-run columns (`:35-47`)                                                                                                                                                               | skill (3) |
| expression-2.18 | c07 F5     | 2    | P2  | planned   | In light the status dots and the delta are near-invisible, with the same tint as .16. The missing per-case mark is .14                                                                                                             | runtime   |
| expression-2.19 | c07 F6     | 2    | P2  | primitive | The id and input run together ("eval-005Sort ascending…"), still in round 1 through the entity cell's `sub`. At 390 the Case column prints over Change and Baseline (`r0/…c07--dark--390x844.png`)                                 | kit (2)   |
| expression-2.20 | c07 F7     | 3    | P2  | skill     | No dim and no readout: the focus frame shows a ring on a table row (`r0/…c07--focus--dark--1800x1200.png`). The seam was available, and round 1 wired `useChartFocus` on the squares                                               | skill (4) |
| expression-2.21 | c07 F8     | 1    | P3  | skill     | The pass-rate card is taller than the strip beside it (`items-start`, `:145`), and the sentence sits flush under the bar                                                                                                           | skill (8) |
| expression-2.22 | c07 K1     | 1    | P3  | primitive | The id and input glue, as .19                                                                                                                                                                                                      | kit (2)   |
| expression-2.23 | c07 K2     | 2    | P2  | primitive | The table skeleton is 6 rows where 14 load. `useDataTable` has no skeleton-row option (2.x `BasaltDataTable` had `skeletonRows`)                                                                                                   | kit (2)   |
| expression-2.24 | c07 K3     | 2    | P2  | skill     | Focus lands on a nameless `tr` at 1800 and on the count strip at 390, and nothing is announced (focus log)                                                                                                                         | skill (4) |
| expression-2.25 | c07 K4     | 1    | P3  | skill     | An arbitrary grid template (`:145`)                                                                                                                                                                                                | skill (5) |
| expression-2.26 | c07 K5     | 2    | P2  | primitive | At 390 `StatGroup` `cards` becomes a snap row that hides two cells, and the table text overlaps                                                                                                                                    | kit (2)   |
| expression-2.27 | c07 K6     | 1    | P3  | primitive | The page height changes from loading to loaded, from the same root as .23                                                                                                                                                          | kit (2)   |
| expression-2.28 | c08 F2     | 1    | P3  | skill     | The slowest bar carries no annotation, and the answer sits in a 12 px subtitle (`ExprC08.tsx:149-157`)                                                                                                                             | skill (1) |
| expression-2.29 | c08 F4     | 1    | P3  | skill     | The failed bar keeps its kind hue with a thin ring (`:151`)                                                                                                                                                                        | skill (3) |
| expression-2.30 | c08 F6     | 2    | P2  | primitive | Durations sit up to 1,100 px from their bars. There are no gridlines, and "8 s" wraps at 390 (`:108-114`). `chartLabels` places only inside a `CartesianChart` plot, and no tick or gridline part serves an HTML track (wish list) | seam (1)  |
| expression-2.31 | c08 F7     | 1    | P3  | skill     | The readout omits share and end time, and in dark the focused row barely differs from the dimmed rows                                                                                                                              | skill (5) |
| expression-2.32 | c08 F8     | 1    | P3  | primitive | A hand-built legend `ul` (`:79-90`). `ChartLegend` is not exported, and no legend part takes a seam-drawn mark                                                                                                                     | seam (3)  |
| expression-2.33 | c08 K1     | 1    | P3  | primitive | Ticks are hard-coded to 8,000 ms while the run is 8,120 (`:16`). There is no tick helper; census V3 names `scale` and `ticks`                                                                                                      | seam (1)  |
| expression-2.34 | c08 K2     | 2    | P2  | planned   | A generic column skeleton at a guessed 440 px (`:63`), jumping about 170 px at 390. The v3 card's fixed box holds the loaded height                                                                                                | views     |
| expression-2.35 | c08 K3     | 1    | P3  | skill     | The group ring at zero inset clips row text                                                                                                                                                                                        | skill (5) |
| expression-2.36 | c08 K5     | 1    | P3  | primitive | The "8 s" end tick wraps at 390                                                                                                                                                                                                    | seam (1)  |
| expression-2.37 | c08 K6     | 1    | P3  | skill     | `transition-opacity` with no reduced-motion guard (`:127`)                                                                                                                                                                         | skill (5) |
| expression-2.38 | c09 F2     | 1    | P3  | skill     | No words on the marks: the answer is only in the hero text (`ExprC09.tsx:140-161`)                                                                                                                                                 | skill (1) |
| expression-2.39 | c09 F3     | 1    | P3  | skill     | No signed delta against the 98 % target (`:77`)                                                                                                                                                                                    | skill (2) |
| expression-2.40 | c09 F4     | 1    | P3  | skill     | The status green is spent on the target rule and on the live band                                                                                                                                                                  | skill (3) |
| expression-2.41 | c09 F6     | 2    | P2  | primitive | At 390 the version labels overprint ("v2.9.10"). In the outage fixture "Target 98 %" overprints a version label. Reference-line labels skip the collision pass                                                                     | kit (1)   |
| expression-2.42 | c09 F7     | 1    | P3  | skill     | Nothing dims. `Lines` takes no marks, but `CartesianChart` could, and round 2 moved to it                                                                                                                                          | skill (4) |
| expression-2.43 | c09 F8     | 1    | P3  | planned   | The 2.x facts take no status dot or swatch, while the v3 `figure` has `status`                                                                                                                                                     | views     |
| expression-2.44 | c09 K1     | 1    | P3  | primitive | Label overlap at the 0 % extreme, as .41                                                                                                                                                                                           | kit (1)   |
| expression-2.45 | c09 K2     | 1    | P3  | skill     | The Deploys skeleton is 65 px against 340 loaded, and the empty state has no next step (`:211`)                                                                                                                                    | skill (6) |
| expression-2.46 | c09 K3     | 1    | P3  | primitive | The dip is about 30 presses away. `useChartFocus` has no group step, and round 1 wrote PageUp/PageDown by hand                                                                                                                     | seam (5)  |
| expression-2.47 | c09 K4     | 1    | P3  | planned   | The 2.x fact value is `lining-nums` (`src/charts/chart-card.module.css:80`). The v3 figure is `tabular-nums` (`parts/chart-card.tsx:48`)                                                                                           | views     |
| expression-2.48 | c09 K5     | 1    | P3  | primitive | One x tick at 390 ("8 Nov") on the default time axis                                                                                                                                                                               | kit (3)   |
| expression-2.49 | c09 K6     | 1    | P3  | skill     | The Deploys skeleton jump, as .45                                                                                                                                                                                                  | skill (6) |
| expression-2.50 | n01 F1     | 1    | P3  | skill     | A strip, generic per-day bars, an event list and a 720-point line. The references have no row for intervals on a time axis (wish list)                                                                                             | skill (4) |
| expression-2.51 | n01 F2     | 1    | P3  | skill     | No annotation on the 6 h 40 min outage or the degraded stretch, and the list's fade hides the longest outage                                                                                                                       | skill (1) |
| expression-2.52 | n01 F3     | 2    | P2  | skill     | Drops, downtime and 98.65 % have no target or prior period, and "247 of 250" has no delta (`ExprN01.tsx:64-104`)                                                                                                                   | skill (2) |
| expression-2.53 | n01 F4     | 1    | P3  | skill     | Two status hues and an accent, and the zone tints 80 % of the plot. The clean fixture shows amber "Watch" at 249 of 250                                                                                                            | skill (3) |
| expression-2.54 | n01 F5     | 1    | P3  | skill     | The bars have no unit caption (`:130-148`)                                                                                                                                                                                         | skill (6) |
| expression-2.55 | n01 F6     | 2    | P2  | primitive | "Contracted rate" sits on both lines. "0" and "15 Oct" touch, because the y gutter is documented but not applied (builder wish list)                                                                                               | kit (1)   |
| expression-2.56 | n01 F7     | 2    | P2  | skill     | Focus moves the readout but dims nothing, and a zero day shows no mark. `Bars` dims through `barOpacity`, as round 1 did                                                                                                           | skill (4) |
| expression-2.57 | n01 F8     | 1    | P3  | skill     | The Outages card has a filler subtitle and no facts (`:158-163`), and the downtime hero repeats the strip                                                                                                                          | skill (8) |
| expression-2.58 | n01 K1     | 1    | P3  | skill     | The clean fixture draws an empty 1 h axis with no "up all 30 days" cue                                                                                                                                                             | skill (6) |
| expression-2.59 | n01 K2     | 1    | P3  | planned   | The speed card loads 24 px short: the 2.x card's skeleton has no legend row (n06 too). The same empty sentence repeats seven times                                                                                                 | views     |
| expression-2.60 | n01 K3     | 1    | P3  | skill     | A focused zero-value day has no visible mark, and the ring covers the "4 h" label                                                                                                                                                  | skill (5) |
| expression-2.61 | n01 K6     | 1    | P3  | planned   | The 24 px shift of .59                                                                                                                                                                                                             | views     |
| expression-2.62 | n06 F2     | 1    | P3  | skill     | The hero "13:52" has no verb. "Runs out" lives only in the `ariaLabel` (`ExprN06.tsx:94,173`)                                                                                                                                      | skill (1) |
| expression-2.63 | n06 F6     | 1    | P3  | primitive | The "Out" and "Cap" labels collide at 390 (`:145,181`)                                                                                                                                                                             | kit (1)   |
| expression-2.64 | n06 F7     | 1    | P3  | skill     | Focus moves the ring and the readout, but nothing dims (`Lines`)                                                                                                                                                                   | skill (4) |
| expression-2.65 | n06 K2     | 1    | P3  | planned   | Loading is 23 px short: the 2.x skeleton has no legend row                                                                                                                                                                         | views     |
| expression-2.66 | n06 K4     | 1    | P3  | planned   | The 2.x fact value is `lining-nums`, as .47                                                                                                                                                                                        | views     |

Notes on the classes:

- **`skill`.** The v3 references (`fca6840e`) already teach most of what the builders missed:
  - the baseline;
  - the colour budget;
  - annotating the mark that matters;
  - one tab stop;
  - reduced motion;
  - say it once.

  So the gap is not missing text. The builders do not check their page against that text before they stop. Step 5 of `basalt-design` says to read the page at 1800 and 390 before stopping. The trial fence forbade the build and dev server, so no builder could look. Several `skill` losses can only be seen on screen: label overlap, light-mode contrast and a header that pushes rows below the fold. The fix row turns the step into a named device checklist, and cycle 3 lets builders shoot their own route (lead note (d)). Two text gaps are real:
  - `encoding.md` sends many rows to a `DataTable` (.14);
  - nothing tells a builder that `Lines` cannot dim and `CartesianChart` marks can (.42, .64).

- **`primitive`.** The seam covers plot marks. Forms on an HTML track still own their axis, ticks, label placement, legend and readout visibility: c08 spent about 100 lines on them and c05 about 65. Reference-line labels inside `CartesianChart` skip the collision pass, which costs c09, n01 and n06. The `DataTable` entity cell and the 390 column priority cost c07.
- **`planned`.** The two facts above. The barrel swap fixes the card. Deleting the 2.x provider fixes the tints. Both rows are open, and cycle 3 waits for them, so its builders meet one `ChartCard` and one `--vx-bad`.

Harness lessons go to the cycle 3 brief as lead notes:

- Builders fenced from building could not look at their page.
- The route drops `?fixture=`.
- `scenario-info.ts` needs an entry per scenario, or `scenarios.test.ts` fails. c07's builder added its own, and the lead added the other five.
- Builders copy `@mantine/core` layout from the playground's 2.x code.
- Focus frames need a wait for transitions.
- Builders ran typecheck, oxlint and oxfmt but not `check-theme`, because the lead's brief left it out. c05's round-2 CSS failed it with 12 findings. Nine were `--vx-*` names basalt does not emit, which resolved to nothing in the scored shots. After scoring, the c05 builder made a gate-only fix:
  - local line-height and radius variables built from emitted tokens;
  - a named `basalt-card` container at 479.9 px in place of 40 rem;
  - `theme-allow` on two data-driven spans.

  The visible change is the row-stacking breakpoint, which moved from 640 to 480 px. The shots are in `r2-gate/`. The score stays the round-2 score. Cycle 3 builders run the repo's own gate.

The trial builds add 2,978 lines under `apps/playground/src/scenarios/expr/`, outside the demo line ceiling of `budget.test.ts`.

## Filing

| Row                                                 | Class                                                       | Covers                                                                                                              | Checkpoint | Joins `v3-freeze-g4`          |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------- |
| `v3-expr-2-skill`                                   | skill (all 8 skill P2s; their P3s ride along)               | .1–.4, .8, .10–.15, .17, .20, .21, .24, .25, .28, .29, .31, .35, .37–.40, .42, .45, .49–.54, .56–.58, .60, .62, .64 | none       | no: skill ships in a minor    |
| `v3-expr-2-kit-fixes`                               | primitive (P2s .19, .23, .26, .41, .55; no export)          | .19, .22, .23, .26, .27, .41, .44, .48, .55, .63                                                                    | none       | yes                           |
| `v3-expr-2-seam-tracks`                             | primitive (P2 .30; adds exports or changes `useChartFocus`) | .6, .7, .30, .32, .33, .36, .46                                                                                     | spec       | yes                           |
| `v3-cycle-expression-3`                             | next cycle                                                  | c10, c11, c12, c13, n02, n12                                                                                        | none       | no: this cycle has no open P1 |
| notes on `v3-teardown-views`, `v3-teardown-runtime` | planned                                                     | views: .9, .34, .43, .47, .59, .61, .65, .66; runtime: .5, .16, .18                                                 |            |                               |

The primitive P2s file as two rows, as in cycle 1. The brief makes a fix that adds an export or touches `useChartFocus`'s API its own `checkpoint: spec` row, and component fixes should not wait on that Spec. `v3-cycle-expression-3` waits for the three fix rows and for `v3-teardown-runtime`, which runs after `v3-teardown-views`.

Two cases were added to the bank, both from argo pages that no case covered:

- n14 comes from the net-worth page.
- n15 comes from the walking-pad page.

Factory friction: one signal. The agent token is refused `GET /projects`, and `issue list` covers recent Issues only, so a lead cannot read which plan rows are open when it classes a finding `planned`. The lead read master's history and the briefs instead.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`): V1 seam CONFIRMED; V2 kinds `bar list`, `meter`, `time-series lines`; V3 helpers `scale`, `ticks`, `packing`, `measure-width`, `label-fit`; V4 devices `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` findings are 47 of the 84 points lost in round 0, 56 %. That meets the first half of the confirm column (half or more). No `planned` point belongs to a skill row: all 14 are teardown rows. Repair rounds lifted the median from 66.5 to 78.5, by 12 points. That is under the 15 that confirms and over the 5 that kills, so the hypothesis stays open on the lift. The direction is clearer than in cycle 1. The share of `skill` rose from 38 % to 56 % once the seam took over the `primitive` share. Every builder reached the devices when told, mostly without new glue: c07 went from a table to a square per case in one round. The references the method needs already ship. What failed is applying them before stopping, and this cycle's fence took away the one step that checks it. Cycle 3 separates the two by letting builders look.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers sit on the other side of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>`, under the three that would confirm.
- Round-0 median glue was 50 lines, under 80.

They fall there because the seam shipped. Last-round median glue dropped from 195 in cycle 1 to 67.5, and dim-the-rest in round 0 rose from 0 builds to 2. What remains is the seam's second cut for HTML tracks (`v3-expr-2-seam-tracks`), where c08 still wrote about 100 lines.

**3, exemplars: confirmed.** Under the reworded threshold (2026-11-13), Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. The builders agree. Five wished for a kind: a waterfall (c08), contract lanes (c05), a waffle and a transition matrix (c07), an interval strip (n01), a forecast series (n06). Each served one case, so each is a recipe at most, and the Rule of Three stands.

## Convergence

Not converged:

- The round-0 median is 66.5, under 80.
- The minimum is 48, under 60.
- All four referenced cases ended `build` or `tie` in round 0, which meets the bar of three.
- There are 17 P2s against a limit of three.

`v3-cycle-expression-3` is filed after the fix rows and the two teardown rows.

owner:

## Owner calibration

The owner looked at four builds in the running playground on 2026-11-14, each as its builder left it after the last round. The reviewers' scores are beside his verdict. Every point he raised is one the rubric could not take off, so the scores stand and the rubric gains the X items (`docs/v3/expression/rubric.md` § Experience).

| Case | Score | Owner's verdict                             | What he named                                                                                                              | Class                    | Goes to                                                      |
| ---- | ----- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| n06  | 88    | Quite ok, a beautiful chart                 | The card title is small and the values are large; values are not monospace; too much prose describes the change            | planned, rubric          | The barrel swap (the build drew the 2.x `ChartCard`); X1, X5 |
| c08  | 85    | Quite good                                  | The dim on hover is too strong; the focused row flickers when the pointer crosses the gap between two rows; prose as n06   | primitive, rubric        | `v3-expr-2-seam-tracks`; X1, X4                              |
| c09  | 81    | A beautiful chart, not the next level of UX | The timeline is plain; it should scroll in its own region beside the chart, and hovering either one should focus the other | skill, primitive, rubric | `v3-expr-2-skill`, `v3-expr-2-seam-tracks`; X2, X3           |
| c07  | 71    | All over the place                          | Too large, too much space, the parts are not one joined view                                                               | skill, rubric            | `v3-expr-2-skill`; X2                                        |

All four: the cards and charts do not follow the console look the owner chose for v3 (`docs/v3/verdicts/statcard.md`). Three of the four import `ChartCard` from `basalt-ui/charts`, which still resolves to the 2.x card (§ Findings, "Two ChartCards"): flush, no inset, a small title over free text. The v3 part has the inset and the figure. This cycle scored that as P3 `planned` points on F8, K2 and K4. X5 makes it a P2 from cycle 3.

What the code shows for the two `primitive` points:

- **Flicker.** `focus.item(i)` clears the focus on `pointerleave` of each item (`src/charts/focus.tsx:217`). Rows with a gap between them drop to the unfocused state and dim again on the next row. The clear belongs on the container, `focus.target`.
- **Dim strength.** The kit ships no dim for a seam-drawn mark, so c08 chose `data-dimmed:opacity-25` itself (`ExprC08.tsx:197`). The kit's own marks dim through `--vx`. One shipped value for both removes the choice.

What the owner's verdicts say about the method: the builds answer the chart's question and stop. None was planned as a surface with a list beside the chart, one focus across both and a footprint sized to the question. The twelve devices are all devices of one chart. Linked parts and one view are missing from the vocabulary, and the skill row takes them.
