# Expression cycle 10

Six one-shot trials on master after the cycle 9 fix rows landed. The cases are n39, n40, n41, n42, n43 and n44, all native: TuffUI published no component after `f31ea2b`, so none has a reference. They are scored against `docs/v3/expression/rubric.md`. Protocol: `docs/v3/EXPRESSION.md`.

Round 0 is the best first try of the ten cycles. On all items the median is 81.5 and the minimum 75; on the F and K items the median is 85.5 and the minimum 74. Four cases passed at once (n39 81, n42 82, n43 88, n44 86), and the other two passed in round 1 (n40 84, n41 84), so no case needed round 2. There is no P1 and there is one P2, n41's X3: a `BarList` whose rows are request kinds cannot join an hourly chart whose series are models.

This is the first cycle that meets every convergence clause it can measure: median 80 or more, nothing under 60, no P1, at most three P2s. The fourth clause, three of four referenced cases ending `build` or `tie`, cannot be met, because no referenced case exists to run. So the area has not converged in full, and `v3-cycle-expression-11` is filed (§ Convergence).

The lost points split evenly between what the builder did not know and what the kit could not do: `skill` 30 of 63, `primitive` 31 and `rubric` 2. In cycle 9 `skill` held 63 %. Repair rounds lifted the median by 2.5, under the 5 that kills hypothesis 1, for the second cycle running; the two repaired cases each rose 7 to 9 points, but four of six had nothing to repair (§ Hypotheses).

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `0b5e3facdcf8912af8f6c4265a177c80078fbd75`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Date       | 2026-11-17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Cases      | n39, n40, n41, n42, n43 and n44 (native)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel, fenced as in cycle 9. The prompt is cycle 9's with the paths bumped and its two kit gaps replaced by the two the lead's probe found on this pin                                                                                                                                                                                                                                                                              |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                                                                                                                                      |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                                                                                                                                                                                                                                                    |
| Shots      | `.evidence/v3-shots/expression-10/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored), with the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, `--focus--`, `--list--` and `--sweep-gap--` frames, each light and dark at 1800x1200 and 390x844, and `r<round>/shoot-log.txt`. Source snapshots in `src-r<round>/`, builder reports in `builder-reports/`, reviews in `reports/`, the lead's log in `lead-state.md`, probes in `probe/` |

### Before round 0

- **TuffUI.** The newest commit is still `f31ea2b` (2026-11-16; `gh api repos/yurigdesigner/tuffui/commits`), so there is no `c` case and there are no verdicts.
- **(a) The cycle 9 kit fixes**, probed on a build of the pinned master (`probe/`, `probe/heights.log`, `probe/lead.log`):
  - n34 and n35 at 390 end loading and rest at one height (377 and 377, 407 and 407). n38 at 390 does not: its rest card is 359 px and its loading card 377, 18 px taller now where cycle 9 found it 19 px shorter. At 1800 all three match.
  - n38's top-item label 'Decision 2018, 71 h' is drawn whole at 390 and 1800.
  - n34's two rule labels are drawn clear of the lines at 390, light and dark.
  - n38 `?fixture=extreme` shows 41 beside the clamped dot; at 1800 the '41' crowds the item's own label.
  - n37's focused bar reads among the grey bars (subtle in light, clear in dark), and n38's dimmed accent dots stay visible in dark.
  - n36's phone cards label every value.
  - n33 `?shot-state=empty` and `error` still show no header row: its tables render inside a `DataPanel` body, and the frame's own message replaces the body in those phases. The kit fix holds for a bare `DataTable` and not for a framed one.
  - Builders were told the two gaps that remain: a framed table's header in empty and error, and a loading card's height at 390.
- **(b) The contract row** `v3-expr-9-contract` shipped on a `looks_good` Spec: `DataTable` `focusItems` (a row that holds a run of a chart's items focuses them as one held span, drawn as one x band; a row that holds an item's children marks each), and `useDataTable` `bodyRows` for a table that mounts in loading. The reviewer prompt names both.
- **(c) The rubric row** landed: rubric.md gives X3 and X4 one reading on a page with no chart. Reviewers read it from rubric.md, and the prompt points them to it.
- **(d) The repo's gate.** `make check-fast` ran on the round-0 tree after every builder had returned and before any round-1 message went out: rc=0 (`.check-r0.log`).
- **(e) Reviewer notes.** The prompt keeps cycle 9's lines on the two sanctioned colour forms, the 61 px band, the LIST approach and the shipped series-row, mono, stacked `BarList`, `Sparkline` readout and bar value fields. No reviewer marked down a colour form or the band.
- **(f) The keyboard frame.** The builder prompt still names no keys state. **6 of 6** builders shot `basalt-ui shot --states keys` unasked in round 0, as in cycle 9. Five of them found the tool's `focus` state failing at 1800 ('never reached the anchor in 80 Tab presses'): the playground's shell nav holds more stops than the tool's budget (kit (12)).
- **(g) The shared series file.** Four builders appended a group (n39 `FROST_SERIES`, n40 `TASK_SERIES`, n41 `SERVED_SERIES`, n42 `ROUTER_SERIES`); n43 appended one and removed it again. Each check before a shoot found the diff against master to be insertions only (+38, then +37 after n41's round 1). Every builder ran `bun test` on its own.
- **(k) Pages with no chart.** Every case this cycle drew a chart, so the rubric's no-chart readings of X3 and X4 were not exercised. Reviewers scored three table-to-chart joins under X3 (n39, n42, n43, all through `focusItems`) and one list-to-chart join that failed (n41).

### The shoot

- **The lead tool** (`lead-shots.ts`, `shoot-round.sh`, not in git) is cycle 9's with the paths bumped. Rounds 0 and 1 wrote 220 and 72 frames.
- **List frames (lead note j).** In round 0 the list frame linked on n39 (the nights table, 4 of 5 dimmed), n40 (the task table, 43 dimmed), n42 (the events table) and n43 (the project `BarList`, which focused the row and its 4 documents, 22 dimmed). On n41 it hovered the `BarList` of request kinds, which dimmed only its own rows and none of the 180 hourly bars; the reviewer was told. n44 has no list. In round 1 n41's list frame showed 2 focused elements and no opacity dim, since its round-1 join dims the chart by colour; the reviewer was told to read the frame.
- **Sweeps.** n39's sweep moved between its seven shaded night bands, 125 px apart, not between line marks; n42's and n43's moved between table and list rows that carry `data-chart-mark`; n41's and n44's between bars that dim by colour, which the counters do not see. Each reviewer was told what its sweep hovered.

### After the rounds

`make check-fast` ran again on the final tree after every builder was done, on the pinned base: rc=0. That covers the static gate, the unit suite and the quality matrix in host slots, the playground build, coverage and agent-doc drift. The layout step picked no file, because none of the 30 changed files reaches a layout test, so CI runs the full suite.

## Numbers

| Number                         | n39                     | n40                                    | n41                             | n42        | n43                     | n44                     | Summary                   |
| ------------------------------ | ----------------------- | -------------------------------------- | ------------------------------- | ---------- | ----------------------- | ----------------------- | ------------------------- |
| First-try score (round 0)      | 81                      | 75                                     | 77                              | 82         | 88                      | 86                      | median 81.5, minimum 75   |
| First-try score, F and K only  | 83                      | 74                                     | 81                              | 88         | 90                      | 90                      | median 85.5, minimum 74   |
| Round 1, all items (F and K)   | passed                  | 84 (88)                                | 84 (86)                         | passed     | passed                  | passed                  | median 84 (88)            |
| Round 2                        | not run                 | not run                                | not run                         | not run    | not run                 | not run                 | every case passed by 1    |
| Rounds-to-pass, all (F and K)  | 0 (0)                   | 1 (1)                                  | 1 (0)                           | 0 (0)      | 0 (0)                   | 0 (0)                   | mean 0.33 (0.17)          |
| Verdict                        | n/a                     | n/a                                    | n/a                             | n/a        | n/a                     | n/a                     | none (no referenced case) |
| Glue lines, round 0            | ~143                    | ~84                                    | ~70                             | ~67        | ~32                     | ~47                     | median 68.5               |
| Glue lines, last round         | ~143                    | ~105                                   | ~72                             | ~67        | ~32                     | ~47                     | median 69.5               |
| Escape hatches, round 0        | 1 `as const`, 5 markers | 1 `as const`, 1 `satisfies`, 8 markers | 2 `as const`, 4 markers         | 6 markers  | 4 `as const`, 3 markers | 5 `as const`, 8 markers | hand `<svg>` 0 of 6       |
| Escape hatches, last round     | as round 0              | 10 markers, otherwise as round 0       | 7 markers, otherwise as round 0 | as round 0 | as round 0              | as round 0              | hand `<svg>` 0 of 6       |
| Devices used unasked (round 0) | 10                      | 10                                     | 9                               | 9          | 9                       | 10                      | median 9.5 of 12          |

A case that passed carries its passing score into later rows. The pass mark is 80 on all items. Rounds-to-pass in brackets is the first round whose F and K score reached 80: n41 did in round 0 without passing on all items.

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines; it excludes fixtures and the app's own derivations. n39's ~143 is mostly figure readouts and announcements (about 105 lines): a hero, a pill, a status and a period that follow the focus for three models and a held night, where `focus.readout` reads only the first item of a held span. n40's round 1 adds about 30 lines that place the late-task labels by hand through `chartLabels.place`; n41's adds a `ListFocus` adapter of about 25 lines that joins its `BarList` to the chart's series, the gap contract (a) takes.

No build used a type cast other than `as const`, a lint disable, `theme-allow`, a deep import or a hand-written `<svg>`. n40's one `satisfies` checks its empty sentences. Markers (`// cycle-expression-10:`) name what the kit lacked:

- n39: a frame that grows with its table (it built `Card`, `CardBand` and `Inset` around a bare `DataTable`), a true minus, a held span's readout, the night-tick lookup, the held figure slots;
- n40: stacked dots for items on one day, a skeleton without the period row, a panel that follows its sibling's height, regular date ticks, a delta without an arrow, end labels clear of the lines (round 1);
- n41: a true minus, `values` that label only the answer, a `y.domain` that reads the stack total, the `BarList` dark half; round 1 the list-to-series adapter, the outage and peak rules, a focus rule on a zero hour;
- n42: a duration in days and hours, a panel body sized for phone cards, an end label clear of the plot top, a null guard the `data-primitive` lint asked for, a typed delta readout;
- n43: the `BarList` dark half, a status dot that takes a series colour, the panel's row count;
- n44: string keys for a band-axis zone, a mark for a missing step, a viewer marker and compass labels on `Heatmap`, a series pair for `Heatmap`, a Retry with nothing to refetch.

Devices reached in round 0, partials counted, out of six builds: hero number 6, colour budget 6, keyboard parity 6, anatomy 6, dim-the-rest 6, direct labels 6, pre-annotation 6, threshold geometry 6, baseline delta 5, quantized marks 2, live cue 1, metaphor 1. The median is 9.5, against 8.5 in cycle 9. n44's map with its 'You' cell is the metaphor.

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The rows of cycles 3 to 10 give both, with F and K first.

| Cycle | Sha        | First-try median      | Minimum     | Last-round median     | Rounds-to-pass, mean  | Verdicts (build, tie, reference) | P1  | P2  | Glue median, round 0 to last      | Hand `<svg>`, last round |
| ----- | ---------- | --------------------- | ----------- | --------------------- | --------------------- | -------------------------------- | --- | --- | --------------------------------- | ------------------------ |
| 1     | `062367fe` | 68                    | 64          | 78.5                  | 2.17                  | 3, 2, 0                          | 0   | 16  | 62.5 to 195                       | 1 of 6                   |
| 2     | `ac6acc90` | 66.5                  | 48          | 78.5                  | 2.17                  | 3, 1, 0                          | 0   | 17  | 50 to 67.5                        | 0 of 6                   |
| 3     | `2ad50570` | 65.5 (all items 62)   | 57 (all 54) | 72.5 (all items 71)   | 2.83 (all items 3)    | 4, 0, 0                          | 0   | 28  | 18.5 to 34                        | 1 of 6                   |
| 4     | `4c991fd8` | 65.5 (all items 65)   | 62 (all 59) | 77.5 (all items 76.5) | 2.17 (all items 2.33) | 1, 1, 0 (two referenced)         | 0   | 16  | 37.5 to 65                        | 0 of 6                   |
| 5     | `e03eddea` | 75 (all items 72.5)   | 60 (all 52) | 83 (all items 81.5)   | 1.5 (all items 1.5)   | none (no referenced case)        | 1   | 18  | 26.5 to 27.5                      | 0 of 6                   |
| 6     | `349bc69f` | 75 (all items 71)     | 62 (all 67) | 82 (all items 80.5)   | 1.17 (all items 1.33) | 1, 0, 0 (one referenced)         | 0   | 12  | 40 to 47.5 (25.5 without spreads) | 0 of 6                   |
| 7     | `e8fdaefd` | 71.5 (all items 69.5) | 67 (all 63) | 81 (all items 79)     | 1.83 (all items 2.5)  | none (no referenced case)        | 0   | 14  | 25 to 47.5                        | 0 of 6                   |
| 8     | `996f76c1` | 80 (all items 75.5)   | 71 (all 70) | 87 (all items 85)     | 1.0 (all items 1.17)  | none (no referenced case)        | 0   | 9   | 35 to 45                          | 0 of 6                   |
| 9     | `325a50fb` | 83.5 (all items 79)   | 71 (all 67) | 82 (all items 81)     | 1.0 (all items 1.5)   | none (no referenced case)        | 0   | 10  | 37.5 to 47.5                      | 0 of 6                   |
| 10    | `0b5e3fac` | 85.5 (all items 81.5) | 74 (all 75) | 88 (all items 84)     | 0.17 (all items 0.33) | none (no referenced case)        | 0   | 1   | 68.5 to 69.5                      | 0 of 6                   |

Round 0 improved again, and the repair rounds had little left to do:

- The first-try median rose 2 to 85.5 on the F and K items and 2.5 to 81.5 on all items, both the best of ten cycles, and for the first time over 80 on all items.
- The minimum rose from 71 to 74 on the F and K items and from 67 to 75 on all items.
- The last-round median rose from 82 to 88 on the F and K items and from 81 to 84 on all items. Every case passed by round 1, against two that never passed in cycle 9.
- The P2 count fell from 10 to 1.
- The glue median rose from 37.5 to 68.5, still under the seam's 80; n39's readout lines carry most of the rise.

## Cases

### n39: whether the next five nights freeze, for how long, and whether the models agree (native)

- **Round 0, 81, passed.** Three models' hourly temperatures on one axis, the warm outlier GFS in the accent, the nights shaded, the median's frost runs drawn under a 0 °C rule and labelled '5 h' and '10 h', and a nights table joined to the chart through `focusItems` (a row holds its night as a band). The hero reads '2 of 5 nights freeze'. Its points went to model agreement not shown at rest (a one-model frost on Friday draws nothing), run labels dropped at 390, a 130 px plot at 390, the frost hours said three times, and two reviewers' readings of an x focus on a line chart. Shots `r0/scenarios-expr-n39*`.

### n40: which tasks are overdue, how much is due today, and which list keeps growing (native)

- **Round 0, 75.** One dot per open task on a due-date axis, stacked by day, with an overdue zone ending at a Today rule, a 60-row task table joined to the dots, a backlog line per list and a done-per-day bar chart. The hero reads '16 overdue'. Its points went to the three month-late tasks not marked on the dots, a duration drawn as a delta, one accent with two meanings, its own y cap clipping a 15 bar, end labels on the lines, a hand-matched panel height, and the stat cards' bare error. Shots `r0/scenarios-expr-n40*`.
- **Round 1, 84, passed.** The late tasks labelled '47 d', '41 d' and '38 d', the cap removed, the accent kept for today, a cursor group per chart, the panel sized by rows, a context line and mono dates.

### n41: which model served each kind of request, and how often a request fell back (native)

- **Round 0, 77.** Hourly bars of the fallback share, stacked by the model tried first, with the outage as a zone, a `BarList` of request kinds stacked by the model that served them, and a table of models. The hero reads '3.0% fell back, +1.2 pts'. The list and the chart share no focus, the list paints light halves in dark, and the zone ends mid-bar. Shots `r0/scenarios-expr-n41*`.
- **Round 1, 84, passed.** A hand adapter that maps each list row to the chart's series, `light-dark()` pairs in its series group so list and chart match in dark, the outage as two rules on band edges, a focus rule on zero hours, models in ink steps.

### n42: whether the router is healthy, and whether its load rose before the last drop (native)

- **Round 0, 82, passed.** A status strip (Healthy, CPU, memory, uptime with the firmware), minute lines of memory and CPU with an 80 % limit, drop rules and an hour-before zone on the last drop, and a line-events table joined through `focusItems`. The hero reads 'Yes, +36 pts'. Its points went to strip cells with no baseline, the CPU end label on its line, the CPU column behind a scroll at 390, three stacked cards, and the kit's grey entity-column band. Shots `r0/scenarios-expr-n42*`.

### n43: which Specs and Reports came in per project, and which wait for a verdict (native)

- **Round 0, 88, passed.** A waiting `StatCard` with 'Default in 5 hours', a new-documents card with a sparkline, a `BarList` per project stacked by verdict with waiting first, and a document table whose wait is a `c.meter` that fills at the 24 h default. One focus joins the list, the table (through `focusItems`) and both figures. Its points went to a table cut mid-row by the panel's row count, the first card's bare error, long phone cards, repeats, and the list's names outside mono. Shots `r0/scenarios-expr-n43*`.

### n44: whether rain reaches my spot in the next two hours, when, and how heavy (native)

- **Round 0, 86, passed.** Five-minute rain bars at the viewer's spot with moderate and heavy rules, the missing steps as grey zones, and a 40 by 40 km map of the same step that follows the chart's focus, with the viewer as a 'You' cell. The hero reads 'Rain by 14:40', 'Heavy at peak'. Its points went to clamped cloudburst bars with no value, a value label lost in a dimmed bar, map rows that collapse at 390, a map that joins nothing back, and repeats. Shots `r0/scenarios-expr-n44*`.

## Round-0 item scores

| Item                 | n39   | n40   | n41   | n42   | n43   | n44   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 3     | 3     | 2     | 3     | 3     | 3     |
| F2 Answer at rest    | 2     | 2     | 3     | 3     | 3     | 3     |
| F3 Baseline          | 2     | 2     | 2     | 2     | 3     | 3     |
| F4 Colour budget     | 3     | 2     | 2     | 3     | 3     | 3     |
| F5 Honest marks      | 2     | 2     | 2     | 3     | 2     | 3     |
| F6 Labels            | 2     | 2     | 2     | 2     | 2     | 2     |
| F7 Focus and readout | 2     | 2     | 2     | 3     | 3     | 3     |
| F8 Anatomy           | 3     | 2     | 2     | 3     | 3     | 3     |
| K1 Scales            | 3     | 2     | 3     | 2     | 3     | 2     |
| K2 States            | 2     | 2     | 3     | 2     | 2     | 2     |
| K3 Keyboard          | 3     | 3     | 2     | 3     | 3     | 3     |
| K4 Tokens            | 3     | 2     | 3     | 3     | 3     | 3     |
| K5 Responsive        | 2     | 2     | 3     | 2     | 2     | 2     |
| K6 First paint       | 3     | 3     | 3     | 3     | 3     | 3     |
| X1 Word economy      | 2     | 2     | 2     | 2     | 2     | 2     |
| X2 One view          | 2     | 2     | 2     | 2     | 2     | 2     |
| X3 Linked parts      | 2     | 3     | 1     | 2     | 3     | 2     |
| X4 Calm interaction  | 2     | 3     | 2     | 2     | 3     | 2     |
| X5 Console anatomy   | 3     | 2     | 3     | 2     | 2     | 3     |
| Sum / max            | 46/57 | 43/57 | 44/57 | 47/57 | 50/57 | 49/57 |
| F and K sum / max    | 35/42 | 31/42 | 34/42 | 37/42 | 38/42 | 38/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`. F6, X1 and X2 held one value across all six: each lost a point everywhere, and K6 stayed at 3. No item is `n/a`.

## Findings

Severity follows the rubric: a 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, and a 2 is P3. An X item counts like an F item. No item scored 0, so there is no P1.

Points lost in round 0 by class: `skill` 30, `primitive` 31 and `rubric` 2, for a total of 63. No point is `doctrine`, `case` or `planned`. By severity there is 1 P2 (`primitive`) and 61 P3s. The one plan row open at the pin was this cycle's own, so no finding is `planned`.

Two classing calls rest on evidence beyond the reviews:

- n41's `BarList` in dark (.28, .32): the swatch is `dark:bg-(--swatch-dark)` (`bar-list.tsx:321`), and the kit's `dark` variant matches `[data-theme='dark']` only (`tailwind.css:7`), while the tokens also switch on a dark system scheme. So under `auto` the list paints light halves. n43's builder hit the same and worked round it with `BASALT` token pairs.
- n39's F7 and X4 (.5, .11): the focus frames of n39 and n42 show the same x focus on a line chart, a guide and a marker per series with nothing dimmed. n42's reviewer scored F7 3, n39's scored it 2 and charged X4 as well. That is one behaviour read two ways, so both points are `rubric`.

Where findings are fixed:

- `contract (x)` is change (x) of `v3-expr-10-contract`.
- `kit (n)` is change (n) of `v3-expr-10-kit-fixes`.
- `skill (n)` is change (n) of `v3-expr-10-skill`.
- `rubric (n)` is change (n) of `v3-expr-10-rubric`.

| Id               | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                                                                                                   | Fix                                    |
| ---------------- | ---------- | ---- | --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| expression-10.1  | n39 F2     | 1    | P3  | skill     | Model agreement is not at rest: the pill says '+3.1 °C GFS' and the 2-of-3 counts live in the table; Fri night, where ECMWF alone dips under 0 °C for 3 h, has no mark (`r0/…n39--light--1800x1200`)                                                                                       | skill (3)                              |
| expression-10.2  | n39 F3     | 1    | P3  | skill     | The hero count has no margin to 0 °C, and the pill names no base; its builder cut `delta.label` to 'GFS' for 390 (`figure.ts`)                                                                                                                                                             | skill (4)                              |
| expression-10.3  | n39 F5     | 1    | P3  | skill     | Frost zones come from the median only (`ExprN39.tsx:141-150`, `frost.ts:90`), so a one-model frost draws nothing and its meter reads 0                                                                                                                                                     | skill (3)                              |
| expression-10.4  | n39 F6     | 1    | P3  | primitive | The '5 h' and '10 h' run labels drop at 390 (`r0/…n39--light--390x844`); the models are named only in a legend                                                                                                                                                                             | kit (1)                                |
| expression-10.5  | n39 F7     | 1    | P3  | rubric    | A guide and one marker per model at the focused hour, nothing dims (`r0/…n39--focus--light--1800x1200`); n42's reviewer scored the same x focus on `Lines` 3                                                                                                                               | rubric (1)                             |
| expression-10.6  | n39 K2     | 1    | P3  | primitive | The empty frame keeps 'Coldest hour' and 'Dew point then' with no value, where error prints dashes (`r0/…n39-shot-state-empty--light--1800x1200`)                                                                                                                                          | kit (3)                                |
| expression-10.7  | n39 K5     | 1    | P3  | primitive | At 390 the plot is about 130 px for 120 hours: `ChartCard` heights are `fill`, `auto` and `short`, half the card width with a 192 px floor (builder report); the nights become seven-line cards                                                                                            | contract (d), kit (6)                  |
| expression-10.8  | n39 X1     | 1    | P3  | skill     | The frost hours stated three times: zone label, table meter and number, status 'Longest Thu, 10 h'                                                                                                                                                                                         | skill (1)                              |
| expression-10.9  | n39 X2     | 1    | P3  | skill     | Two stacked cards with a full-width table of wide gaps; at 390 a tap on a row changes a readout off screen                                                                                                                                                                                 | skill (2)                              |
| expression-10.10 | n39 X3     | 1    | P3  | primitive | The held night band ends at 07:00 where the night and its frost run end at 08:00; no frame shows the chart-to-table direction, because the keys and the sweep land on daytime hours no row holds                                                                                           | kit (11); lead tool                    |
| expression-10.11 | n39 X4     | 1    | P3  | rubric    | 'The dimmed rest is not readable in any frame' on a line chart where nothing dims at an x focus (as .5)                                                                                                                                                                                    | rubric (1)                             |
| expression-10.12 | n40 F2     | 1    | P3  | skill     | The three tasks over a month late are a chip, not marked on the dots; round 1 labelled them with `chartLabels.place`                                                                                                                                                                       | skill (3)                              |
| expression-10.13 | n40 F3     | 1    | P3  | skill     | The Overdue pill is an unsigned duration drawn with the delta arrow (`ExprN40.tsx:208-212`); round 1 moved the duration to the footer                                                                                                                                                      | skill (4)                              |
| expression-10.14 | n40 F4     | 1    | P3  | skill     | One blue means both 'today' and 'the list that grows'; a green pill beside the red                                                                                                                                                                                                         | skill (5)                              |
| expression-10.15 | n40 F5     | 1    | P3  | skill     | The builder's own y cap at 10 draws the 15 bar at 10 (`ExprN40.tsx:389`)                                                                                                                                                                                                                   | skill (7)                              |
| expression-10.16 | n40 F6     | 1    | P3  | primitive | `Lines` end labels 'Errands', 'Home' and 'Reading' sit on the lines (`r0/…n40--light--1800x1200`); round 1 widened the x axis 12 days to clear them (marked)                                                                                                                               | kit (2)                                |
| expression-10.17 | n40 F7     | 1    | P3  | skill     | The Backlog card draws a guide while its readout stays at the total; round 1 fixed it with a cursor group per chart                                                                                                                                                                        | skill (8)                              |
| expression-10.18 | n40 F8     | 1    | P3  | skill     | The Due dates card has no context line (`ExprN40.tsx:241-242`)                                                                                                                                                                                                                             | skill (6)                              |
| expression-10.19 | n40 K1     | 1    | P3  | skill     | The clipped 15 bar is the one broken scale (as .15)                                                                                                                                                                                                                                        | skill (7)                              |
| expression-10.20 | n40 K2     | 1    | P3  | primitive | Both stat cards say only 'Could not load this.' in error: `StatCell`'s error arm shows the cause only as a tooltip (`stat-cell.tsx:395-401`); the empty sentence in four cards                                                                                                             | kit (3)                                |
| expression-10.21 | n40 K4     | 1    | P3  | primitive | `bodySize={{ height: 437 }}` hand-matches the table panel to the chart card at one width (`ExprN40.tsx:319-320`): `DataPanel` cannot follow its row                                                                                                                                        | kit (6)                                |
| expression-10.22 | n40 K5     | 1    | P3  | primitive | At 390 the 'Today' rule label drops, the date ticks run irregular and the dots merge; round 1 hand-set the ticks and the label still drops                                                                                                                                                 | kit (1)                                |
| expression-10.23 | n40 X1     | 1    | P3  | skill     | 'Overdue' as title, zone, legend, 16 cells, chip and focus chip; one empty sentence four times                                                                                                                                                                                             | skill (1)                              |
| expression-10.24 | n40 X2     | 1    | P3  | skill     | Backlog and Done form a second row that joins nothing above                                                                                                                                                                                                                                | skill (2)                              |
| expression-10.25 | n40 X5     | 1    | P3  | skill     | Due dates in the sub line in the body face; no context line on the Due dates card                                                                                                                                                                                                          | skill (6)                              |
| expression-10.26 | n41 F1     | 1    | P3  | skill     | Atlas Large blue means 'tried first' in the chart and 'served' in the list (`ExprN41.tsx:133-141, 209-213`)                                                                                                                                                                                | skill (5)                              |
| expression-10.27 | n41 F3     | 1    | P3  | skill     | The medians and the Rate column carry no baseline (`ExprN41.tsx:168-171`)                                                                                                                                                                                                                  | skill (4)                              |
| expression-10.28 | n41 F4     | 1    | P3  | primitive | In dark the `BarList` paints each series' light half: its swatch is `dark:bg-(--swatch-dark)` and the kit's `dark` variant is `[data-theme=dark]` only, so under `auto` on a dark system it stays light (`bar-list.tsx:321`, `tailwind.css:7`; `r0/…n41--dark--1800x1200`)                 | kit (4)                                |
| expression-10.29 | n41 F5     | 1    | P3  | primitive | The outage zone on the band axis ends at bar centres; its builder subtracted an hour to stop it overrunning (`ExprN41.tsx:126`), and n44's builder found a Date key draws no zone at all                                                                                                   | kit (7)                                |
| expression-10.30 | n41 F6     | 1    | P3  | primitive | The '51%' value label drops at 390 where a rule runs through the bar; legend order reversed against the list                                                                                                                                                                               | kit (1)                                |
| expression-10.31 | n41 F7     | 1    | P3  | primitive | Focus on a zero-height hour lights nothing (`r0/…n41--focus--light--1800x1200`, Mon 01:00, 0 of 12): a stack of zeros keeps no baseline tick                                                                                                                                               | kit (8)                                |
| expression-10.32 | n41 F8     | 1    | P3  | primitive | The strip's swatches differ from the chart's in dark (as .28)                                                                                                                                                                                                                              | kit (4)                                |
| expression-10.33 | n41 K3     | 1    | P3  | primitive | A zero hour shows no position marker under the keys (as .31)                                                                                                                                                                                                                               | kit (8)                                |
| expression-10.34 | n41 X1     | 1    | P3  | skill     | Two legends; the empty sentence three times (`ExprN41.tsx:36-39`)                                                                                                                                                                                                                          | skill (1)                              |
| expression-10.35 | n41 X2     | 1    | P3  | skill     | Three stacked cards; the detail is not beside the mark it explains                                                                                                                                                                                                                         | skill (2)                              |
| expression-10.36 | n41 X3     | 2    | P2  | primitive | The `BarList` of request kinds dims its own rows and none of the 180 hourly bars (`LIST` faded 3/184): its rows are kinds and the chart's series are models, and `BarList` takes only a same-grain `focus`. Round 1 joined them with a hand `ListFocus` adapter of about 25 lines (marked) | contract (a)                           |
| expression-10.37 | n41 X4     | 1    | P3  | primitive | At 390 the gap lands on a zero hour and the whole plot goes slate (`r0/…n41--sweep-gap--light--390x844`; as .31)                                                                                                                                                                           | kit (8)                                |
| expression-10.38 | n42 F3     | 1    | P3  | skill     | The strip's CPU and Memory have no baseline; on `pegged` the pill signs noise as '+1 pts CPU' (`ExprN42.tsx:107-118`)                                                                                                                                                                      | skill (4)                              |
| expression-10.39 | n42 F6     | 1    | P3  | primitive | The 'CPU' end label sits on its line at 1800; the zone label drops at 390                                                                                                                                                                                                                  | kit (1), kit (2)                       |
| expression-10.40 | n42 K1     | 1    | P3  | skill     | At 390 on `pegged` the status cell loses 'Overloaded' and its label runs into CPU '100 %'; the skill says a strip cell fits one line at 390                                                                                                                                                | skill (9)                              |
| expression-10.41 | n42 K2     | 1    | P3  | primitive | Empty strip footers are blank where error prints '–' (`ExprN42.tsx:127-130`); the empty cause names no action                                                                                                                                                                              | kit (3)                                |
| expression-10.42 | n42 K5     | 1    | P3  | skill     | At 390 the CPU column, the evidence for the load question, is behind a sideways scroll (`phone: 'scroll'`, `ExprN42.tsx:36-37,102`)                                                                                                                                                        | skill (9)                              |
| expression-10.43 | n42 X1     | 1    | P3  | skill     | The hero sentence and the zone label say the same; 'Line drop' beside the chart's 'Drop'                                                                                                                                                                                                   | skill (1)                              |
| expression-10.44 | n42 X2     | 1    | P3  | skill     | Three full-width stacked cards; four event rows across 1500 px and about 90 px of dead body                                                                                                                                                                                                | skill (2)                              |
| expression-10.45 | n42 X3     | 1    | P3  | skill     | Chart to table lights a row only when the focused minute equals an event's minute (`ExprN42.tsx:262`): `focusItems.holds` could take the hour before                                                                                                                                       | skill (8)                              |
| expression-10.46 | n42 X4     | 1    | P3  | primitive | At 390 the row-to-row sweep drops to `data-dimmed 0` at +60 ms between two phone cards, a flash of the unfocused state                                                                                                                                                                     | kit (10)                               |
| expression-10.47 | n42 X5     | 1    | P3  | primitive | In light the Event column paints a grey band to x 1520 that the number columns lack: the pinned entity column's surface (`r0/…n42--focus--light--1800x1200`; n39's Night column the same)                                                                                                  | kit (5)                                |
| expression-10.48 | n43 F5     | 1    | P3  | skill     | The count bars carry no unit caption                                                                                                                                                                                                                                                       | skill (6)                              |
| expression-10.49 | n43 F6     | 1    | P3  | primitive | `bodySize={{ rows: 12 }}` shows 14.5 rows and cuts the last through its text and meter (`ExprN43.tsx:175`; marked: the panel cannot take its height from the table)                                                                                                                        | kit (6)                                |
| expression-10.50 | n43 K2     | 1    | P3  | primitive | The first `StatCard` in error says only 'Could not load this.' (as .20); three Retry buttons for one failure                                                                                                                                                                               | kit (3)                                |
| expression-10.51 | n43 K5     | 1    | P3  | primitive | At 390 each document is a card of about 190 px with 'Project:' on its own line: a labelled line per value since v3-expr-9-kit-fixes, and n39's builder found `card: 'detail'` did not shorten it                                                                                           | kit (6)                                |
| expression-10.52 | n43 X1     | 1    | P3  | skill     | 'Nothing waits' on five rows, 'Nothing submitted' beside 0, the sort said twice                                                                                                                                                                                                            | skill (1)                              |
| expression-10.53 | n43 X2     | 1    | P3  | skill     | Four cards; a 240 px card for a 14-day sparkline; six columns across 1500 px                                                                                                                                                                                                               | skill (2)                              |
| expression-10.54 | n43 X5     | 1    | P3  | primitive | `BarList` project names in the body face where the table sets them mono: `BarList` has no `mono` on a label (cycle 9's n38 wished for it, expression-9.64)                                                                                                                                 | contract (c)                           |
| expression-10.55 | n44 F6     | 1    | P3  | primitive | The white '7.5' label inside its bar vanishes when the bar dims (`r0/…n44--focus--light--1800x1200`); map ticks carry no km unit                                                                                                                                                           | not filed (one case)                   |
| expression-10.56 | n44 K1     | 1    | P3  | primitive | In `cloudburst` the three bars clamped at 20 carry a caret and no value (`r0/…n44-fixture-cloudburst--light--1800x1200`): the true value beside the caret landed for dots and stack totals, not for a bar                                                                                  | kit (9)                                |
| expression-10.57 | n44 K2     | 1    | P3  | primitive | The empty frame keeps the footer labels with blank values (as .6)                                                                                                                                                                                                                          | kit (3)                                |
| expression-10.58 | n44 K5     | 1    | P3  | primitive | At 390 the 20 map rows collapse to hairlines (`Heatmap` sizes rows to the plot, no square cells) and the '9.0' peak label drops                                                                                                                                                            | kit (1); map rows not filed (one case) |
| expression-10.59 | n44 X1     | 1    | P3  | skill     | 'next 2 h' three times, the 9.0 peak twice, 'now / at arrival' per card                                                                                                                                                                                                                    | skill (1)                              |
| expression-10.60 | n44 X2     | 1    | P3  | skill     | Two side-by-side cards with their own figure and footer read as two cards                                                                                                                                                                                                                  | skill (2)                              |
| expression-10.61 | n44 X3     | 1    | P3  | primitive | The chart drives the map, the map drives nothing back: `Heatmap` takes no `focus` (`ExprN44.tsx:268-287`)                                                                                                                                                                                  | contract (b)                           |
| expression-10.62 | n44 X4     | 1    | P3  | primitive | The dimmed rest loses its '7.5' label (as .55)                                                                                                                                                                                                                                             | not filed (one case)                   |

## Filing

| Row                      | Class                                                | Covers                                                                                                                   | Checkpoint | Gate |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | ---- |
| `v3-expr-10-contract`    | primitive (P2 .36; P3s that need a field ride along) | .7, .36, .54, .61                                                                                                        | spec       | none |
| `v3-expr-10-kit-fixes`   | primitive (P3s only; no export, no contract change)  | .4, .6, .7, .10, .16, .20, .21, .22, .28, .29, .30, .31, .32, .33, .37, .39, .41, .46, .47, .49, .50, .51, .56, .57, .58 | none       | none |
| `v3-expr-10-skill`       | skill (P3s only)                                     | every `skill` finding                                                                                                    | none       | none |
| `v3-expr-10-rubric`      | rubric (P3s only)                                    | .5, .11                                                                                                                  | none       | none |
| `v3-cycle-expression-11` | next cycle                                           | n45, n46, n47, n48, n49, n50                                                                                             | none       | none |
| not filed                | primitive, one case                                  | .55, .62 (a value label inside a dimmed bar, n44 only), the map rows at 390 in .58 (`Heatmap`, n44 only)                 |            |      |

There is no P1, so no row of its own. The one P2 is `primitive` and needs a contract field, so it takes a Spec row with `checkpoint: spec` and seat opus high, as the cycle brief requires. The other changes that need a field ride along in it:

- (a) a `BarList` row that joins a chart's focus across grains, as `DataTable` `focusItems` and `focusSeries` do (n41 .36, whose round 1 wrote the join by hand);
- (b) a `Heatmap` that takes the page's focus, so a part beside a chart joins it both ways (n44 .61);
- (c) `mono` on a `BarList` label, for ids and project names (n43 .54, cycle 9's n38 .64);
- (d) a `ChartCard` plot that keeps the height its axis needs at 390, where today's heights are `fill`, `auto` and `short` (n39 .7, cycle 9's n38 .58).

The kit row holds the behaviours that need no field, each serving two cases or more from this cycle or the bank: (1) labels that name the answer kept at 390 (n39, n40, n41, n42, n44); (2) `Lines` end labels clear of the lines (n40, n42); (3) states: an empty frame's footer and a `StatCell` error that names its cause (n39, n40, n42, n43, n44); (4) the `dark` variant under `auto` (n41, n43); (5) the pinned entity column's surface in light (n42, n39); (6) `DataPanel` sizing and phone-card length (n39, n40, n43); (7) a zone on a band axis that covers whole bands (n41, n44); (8) a focused zero stack that keeps a position (n41 and cycle 8's zero-bar tick); (9) a clamped bar's true value (n44 and cycle 9's n38); (10) a phone card list that holds its focus across the gap between cards (n42, n43); (11) a held span drawn to its last item's end, with a readout of the span (n39 and cycle 9's n34 windows); (12) `basalt-ui shot --states focus` past a long shell nav (five builders, no point lost). Its brief tells its lead to split one off behind a Spec if it turns out to need a field.

The skill row gathers 30 points of lessons the kit could already do. Two lessons failed on every page: the fact count (X1 lost a point in 6 of 6) and one view (X2 in 6 of 6). The skill already teaches both, so the row's brief asks why the step did not hold, not only for more text. The rubric row gives F7 and X4 one reading for an x focus on a line chart.

Wishes from the builders that are not round-0 findings, each a recipe at most or a later case's evidence: stacked dots for items on one day (n40, about 23 lines), a true minus in `useFormat` and `c.number` (n39, n41), `values` that label only the answer bar (n41, n44), a `y.domain` function that reads a stack total (n41), a duration in days and hours (n42), a delta without an arrow for a duration (n40), `c.meter` drawing its figure on the row's text line (n40), a mark for a step that never arrived (n44), one page-level Retry across frames (n40, n42, n43, n44; cycle 9's n33), and a `StatCell` value in mono (n42). The contract row's out-of-scope line names the ones it touches.

**The gate.** `v3-freeze-g4` is done, and no `primitive` or `doctrine` P1 is open, so no row joins a freeze (EXPRESSION.md § Gate).

**The bank.** Before this cycle the never-run cases were n39 to n45. This cycle ran six, so n45 alone is left. As lead note (h) asked, it adds six cases from pages no case covers, none with a reference:

- n46, from linewatch's throughput and verdict pages: did the line deliver the contracted speed this month, and on how many days did it fall below the minimum;
- n47, from the factory console's Issue page: where the time went between filing and shipping, and which attempt failed and why;
- n48, from argo's activities: on which days I trained, which sport, and whether I kept going through winter;
- n49, from argo's wiki page: which pages are stale, who owns them, and which stale pages are still read;
- n50, from the factory console's projects page: which project shipped the most, which went quiet, and where a shipped Issue costs the most;
- n51, from argo's transactions: which charges are unusual for their merchant, and which are still uncategorised.

Cycle 11 draws n45 to n50. n51 stays for cycle 12.

**Factory friction:** none filed; the factory cost this cycle no lost run.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`, unchanged since 2026-11-12):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: killed again; cycle 9's kill holds.** `skill` findings are 30 of the 63 points lost in round 0, 47.6 %, and no `planned` point is owned by a skill row. That is under half, so the first half of the confirm column is not met, where cycle 9's 63 % met it.

Repair rounds lifted the median from 81.5 to 84 on all items and from 85.5 to 88 on the F and K items, by 2.5 each. Both are under the 5 that kills, as in cycle 9 (2 and −1.5). Two cycles in a row on the kill side make it more than a one-cycle result.

The numbers meet the clause, but the clause's reason ('the builder knew what to do and could not') fits this cycle less well than cycle 9. The two builders who got feedback used it: n40 rose 9 points on all items and 14 on the F and K items, and n41 rose 7 and 5. The median moved little because four of six cases passed in round 0 and had nothing to repair. As first tries improve, a median lift measures how many cases fail more than how well feedback works. The threshold is the owner's to restate (`EXPRESSION.md` § Thresholds); this cycle reports it as written.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in any round.
- The round-0 median glue was 68.5 lines and the last-round median 69.5, both under 80. n39's 143 lines are mostly focus readouts.

Where glue grew it is readouts and label placement (census V3 `label-fit`): n39's figure for three models and a held night, n40's late-task labels through `chartLabels.place`, and n41's list-to-series adapter.

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for forms in two cases, each one case and so not a kind candidate under the Rule of Three:

- stacked dots for items that share a day (n40), composed from `CartesianChart` dots with a stack index and a one-minute offset;
- a map grid with the viewer marked and compass axes (n44), composed from `Heatmap` with an annotate glyph and hand-written band labels.

## Convergence

Not converged in full. Every clause the cycle can measure is met; the referenced clause cannot be:

- The round-0 median is 81.5, over 80; on the F and K items it is 85.5.
- The minimum is 75, over 60; on the F and K items it is 74.
- No referenced case ran, so the clause of three of four referenced verdicts cannot be met. TuffUI has published nothing since `f31ea2b`, and every `c` case in the bank has run, so no later cycle can meet it either until a reference appears.
- There is no P1, and there is 1 P2 against a limit of three.

`v3-cycle-expression-11` is filed after the four fix rows. Whether a cycle with no reference to run may converge on the other clauses is a protocol question for the owner, raised as a Decision on this cycle's Issue (2134) with the recommendation to amend `EXPRESSION.md` § Convergence. With no answer the protocol stands; this cycle files the next one as `EXPRESSION.md` says, and cycle 11's brief applies a ruling if one exists by then.

owner:
