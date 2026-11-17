# Expression cycle 9

Six one-shot trials on master after the cycle 8 fix rows landed. The cases are n33, n34, n35, n36, n37 and n38, all native: TuffUI published no component after `f31ea2b`, so none has a reference. They are scored against `docs/v3/expression/rubric.md`. Protocol: `docs/v3/EXPRESSION.md`.

Round 0 is the best first try of the nine cycles on the trend measure. On the F and K items the median is 83.5 and the minimum 71; on all items the median is 79 and the minimum 67. Two cases passed at once, n34 (82) and n35 (85), and four of six reached 80 on the F and K items. There is no P1 and there are 10 P2s, so the area has not converged. With no referenced case, the clause of three of four referenced verdicts cannot be met.

`skill` cost 48 of the 76 points lost in round 0, 63 %. The kit cost 25 and reviewers 3. Two gaps need a contract field: a list whose rows are not the chart's items cannot join its focus (n33, n34), and a table that mounts in loading cannot say how many rows it will show (n36, n37).

Repair rounds barely moved the median: 79 to 81 on all items, and 83.5 to 82 on the F and K items. n37 passed in round 1 and n38 in round 2. n33 and n36, the two pages built from tables and stat cells with no chart, ended at 74. Their builders named a kit limit in every round: no footer on `DataPanel`, no focus on `StatCell`, no grouping by a hidden column, no unit or threshold on `c.meter`, six skeleton rows. The lift is under 5, so hypothesis 1 meets its kill clause on this cycle's numbers (§ Hypotheses).

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `325a50fb54f55285fa10f745a6fcd8efed7a766f`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Date       | 2026-11-17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Cases      | n33, n34, n35, n36, n37 and n38 (native)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel, fenced as in cycle 8. The prompt is cycle 8's with the paths bumped and its list of kit gaps cut to the two the lead's probe still found                                                                                                                                                                                                                                                                                    |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                                                                                                                                     |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                                                                                                                                                                                                                                                   |
| Shots      | `.evidence/v3-shots/expression-9/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored), with the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, `--focus--`, `--list--` and `--sweep-gap--` frames, each light and dark at 1800x1200 and 390x844, and `r<round>/shoot-log.txt`. Source snapshots in `src-r<round>/`, builder reports in `builder-reports/`, reviews in `reports/`, the lead's log in `lead-state.md`, probes in `probe/` |

### Before round 0

- **TuffUI.** The newest commit is still `f31ea2b` (2026-11-16; `gh api repos/yurigdesigner/tuffui/commits`), so there is no `c` case and there are no verdicts.
- **(a) The cycle 8 kit fixes**, probed on a build of the pinned master (`probe/`, `probe/heights.log`):
  - n30's keyboard frame landed: the focused heatmap cell (Mon 01) draws a ring.
  - n29's `?shot-state=error` landed: the `BarList` reads 'Could not load merchants with untagged bookings.'
  - n32's tree table landed: a focused row dims the other 24 (`data-dimmed 24`).
  - The loading height landed for n31 at 1800 (468 and 468) but not for a card that mounts straight into loading: n31 at 390 is 324 against 342, n29 272 against 324 (1800) and 342 (390), and cycle 7's n24 458 against 538 at 1800. The kit row's ship note says a card holds only what the page declares, and the skill's `states.md` teaches declaring every slot.
  - No package commit since cycle 8's pin touches a reference-rule label, so cycle 7's n21 gap stands.
  - Builders were told the two gaps that remain: the dropped rule label and the card that mounts in loading.
- **(b) The contract row** `v3-expr-8-contract` shipped on a `looks_good` Spec: a `Sparkline` that names, announces and dims its stepped point, bar `values`, a `highlight` bar, a zero-bar tick and a clamped stack. The Spec ruled nested table rows out (one level through `group.by`). The reviewer prompt names all of it.
- **(c) The rubric row** landed (`86b282387`). Reviewers read its F3, K3 and X5 sentences from `rubric.md`.
- **(d) The repo's gate.** `make check-fast` started on the round-0 tree before scoring. It reached the quality matrix while n37's round-1 builder was editing, and failed there: 'No matching export in apps/playground/src/scenarios/expr/n37/fixture.ts for import "atRisk"'. The static gate and the unit suite had passed (0 fail). The run on the final tree is under [After the rounds](#after-the-rounds).
- **(e) Reviewer notes.** The prompt keeps cycle 8's lines on the two sanctioned colour forms, the 61 px band and the LIST approach. No reviewer marked down a colour form or the band.
- **(f) The keyboard frame.** The builder prompt still names no keys state. **6 of 6** builders shot `basalt-ui shot --states keys` unasked in round 0, against 5 of 6 in cycle 8 and 0 in cycles 5 to 7.
- **(g) The shared series file.** Three builders appended a group (n34, n37, n38; n38 added one key to it in round 2); each check before a shoot found the diff against master to be insertions only. Every builder ran `bun test` on its own.
- **(k) The headline spaces.** Reviewers were asked to quote any comma with no space after it. Three builds have a comma list in a headline or a title (n35 'Tue 12:30 to 17:30, longest block', n33 '2 stale, 2 never run', n37 '9 tickets, 53 pts'), and each reads with its space, joined with ', ' in the source. Cycle 8's n27 reading is not confirmed; this cycle had no `PageSummary` headline to retest it on.

### The shoot

- **The lead tool** (`lead-shots.ts`, `shoot-round.sh`, not in git) is cycle 8's with the paths bumped. Rounds 0, 1 and 2 wrote 204, 140 and 104 frames.
- **List frames (lead note j).** In round 0 the list frame linked on n38 (a `BarList`, 11 of 12 dots dimmed) and found no link on n33, n34, n36 and n37. On n35 it hovered the week track's own day rows, which are `[data-chart-mark]` elements, so it was the chart and not a list: the reviewer was told, and ruled X3 `n/a`.
- **Sweeps.** n34's sweep found its three go-window zones 670 px apart, not adjacent marks; the reviewer was told. In rounds 1 and 2 the sweeps on n33 and n36 moved between the `c.meter` bars of two table rows; reviewers were told to read them as row-to-row movement.

### After the rounds

`make check-fast` ran again on the final tree after every builder was done, on the pinned base. Every step passed except `check-contract-frozen`, which named three pins master had moved since the pin (`scripts/export-surface/page.json`, `src/router/index.ts`, `src/ui/slots.ts`, under its two contract-amendment commits). That covers the static gate, the unit suite and the quality matrix in host slots (0 fail), the playground build, coverage and agent-doc drift. After a rebase onto master, `check-contract-frozen` passes (20 pinned files frozen). The layout step picked no file, because none of the 24 changed files reaches a layout test, so CI runs the full suite.

## Numbers

| Number                         | n33       | n34        | n35                                              | n36       | n37                     | n38                     | Summary                   |
| ------------------------------ | --------- | ---------- | ------------------------------------------------ | --------- | ----------------------- | ----------------------- | ------------------------- |
| First-try score (round 0)      | 71        | 82         | 85                                               | 67        | 79                      | 79                      | median 79, minimum 67     |
| First-try score, F and K only  | 77        | 90         | 88                                               | 71        | 86                      | 81                      | median 83.5, minimum 71   |
| Round 1 score (F and K)        | 76 (79)   | passed     | passed                                           | 74 (76)   | 81 (81)                 | 79 (81)                 | median 80 (81)            |
| Round 2 score (F and K)        | 74 (77)   | passed     | passed                                           | 74 (76)   | passed                  | 81 (83)                 | last-round median 81 (82) |
| Rounds-to-pass (F and K)       | 3 (3)     | 0 (0)      | 0 (0)                                            | 3 (3)     | 1 (0)                   | 2 (0)                   | mean 1.5 (1.0)            |
| Verdict                        | n/a       | n/a        | n/a                                              | n/a       | n/a                     | n/a                     | none (no referenced case) |
| Glue lines, round 0            | ~25       | ~45        | ~135                                             | ~40       | ~12                     | ~35                     | median 37.5               |
| Glue lines, last round         | ~58       | ~45        | ~135                                             | ~50       | ~14                     | ~45                     | median 47.5               |
| Escape hatches, round 0        | none      | `as const` | 1 `as CSSProperties`, 4 lint disables, 9 markers | 1 marker  | 1 `as Bucket['status']` | 4 `as const`, 1 marker  | hand `<svg>` 0 of 6       |
| Escape hatches, last round     | 2 markers | as round 0 | as round 0                                       | 2 markers | `as const` only         | 6 `as const`, 2 markers | hand `<svg>` 0 of 6       |
| Devices used unasked (round 0) | 5         | 8          | 11                                               | 6         | 9                       | 9                       | median 8.5 of 12          |

A case that passed carries its passing score into later rows. The pass mark is 80 on all items. Rounds-to-pass in brackets is the first round whose F and K score reached 80: n37 and n38 did in round 0 without passing on all items, n33 and n36 never did. n34 passed in round 0 at 82 with an X3 of 0 (its window table joins nothing), a P2.

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines; it excludes fixtures. n35's 135 lines are a hand-drawn week track from `div`s through `focus.target`, plus about 60 lines of interval arithmetic in its model: the `seam-track` recipe, written by hand. n33's last round adds a 30-line `useEffect` that joins two tables' focus, the gap contract (a) takes.

No build used `theme-allow`, a deep import or a hand-written `<svg>`. n35 is the one build with lint disables: `basalt/primitive-bypass` on its `Mark` div and `basalt/tw-off-law` on three classes (`border-line`, `border-brand`, `text-brand`), each with a reason. n37's `as Bucket['status']` narrows the string an axis `format` receives. Every other `as` is a const assertion. Markers (`// cycle-expression-9:`) name what the kit lacked:

- n35: an interval-on-a-time-axis part, row labels per track width, hour ticks over minutes, a duration format, a hollow span mark, series colours for HTML marks;
- n36: grouping a table by a column it hides, a table skeleton that holds the loaded height;
- n38: a label `chartLabels.place` keeps at 390 and at the plot edge;
- n33 (round 2): a join between two tables' focus, a cap on `c.meter`.

Devices reached in round 0, partials counted, out of six builds: hero number 6, colour budget 6, keyboard parity 6, anatomy 6, direct labels 5, baseline delta 4, dim-the-rest 4, threshold geometry 3, pre-annotation 3, quantized marks 2, live cue 2, metaphor 1. The median is 8.5, against 7 in cycle 8. n35's week track is the first metaphor since cycle 5.

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The rows of cycles 3 to 9 give both, with F and K first.

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

Round 0 improved again; the repair rounds did not:

- The first-try median rose 3.5 to 83.5 on the F and K items and 3.5 to 79 on all items, both the best of nine cycles.
- The F and K minimum held at 71; the all-items minimum fell 3 to 67 (n36).
- The last-round median fell from 87 to 82 on the F and K items and from 85 to 81 on all items. Two cases never passed, against one in cycle 8.
- The P2 count rose from 9 to 10.
- The glue median rose from 35 to 37.5, still well under the seam's 80.

## Cases

### n33: which probes fail now, and which findings have been open longest (native)

- **Round 0, 71.** A four-cell `StatGroup` (failing, stale, never run, oldest finding) over two tables side by side: probes sorted failing first, findings sorted oldest first. Age is a bare number, the tables share no focus, and both sit in flush `Section`s. Shots `r0/scenarios-expr-n33*`.
- **Round 1, 76.** Each table in a `DataPanel` with a context line, age as a `c.meter`, and a hand `useEffect` that joins the two tables' focus (a probe lights its first finding only).
- **Round 2, 74, not passed.** A three-cell strip, whole rows in each panel, a meter capped at the runner-up when one finding is three times older. The capped bar carries no cue, and the panels have no footer, because `DataPanel` has no footer slot.

### n34: when there is water over the bar, and whether the swell is low enough then (native)

- **Round 0, 82, passed.** Tide and swell lines on one metre axis, 'Bar needs 2.8 m' and 'Crew limit 1.5 m' as rules, the go windows as zones, and a table of windows below. The hero reads 'Go Fri 03:00–05:00'. Its points went to an X3 of 0 (the window table joins nothing, because a window is not an hour), unlabelled bands, rule labels struck through at 390, and the loading frame 19 px short at 390. Shots `r0/scenarios-expr-n34*`.

### n35: how much of each workday is booked, and where the longest free block is (native)

- **Round 0, 85, passed.** A hand-drawn week: one row per day on an hour axis, events as spans, overlaps in a second lane, declined events hollow, the longest free block outlined, and a booked-share column. The hero reads '5 h free, Tue 12:30 to 17:30'. Its points went to titles dropped by `chartLabels.row`, kinds in close greys, a ring with no inset, and 18 px of loading jump at 390. Shots `r0/scenarios-expr-n35*`.

### n36: which merge requests wait on me, for how long, and which of mine are stuck (native)

- **Round 0, 67.** Two `StatCell`s ('Waiting on your review' 5, 'Yours, stuck' 2) over a table grouped into Waiting on you, Yours and Others, with a Lane column that repeats each group. No row says it is stuck, age is text, the table joins no focus, and loading draws six rows against eighteen. Shots `r0/scenarios-expr-n36*`.
- **Round 1, 74.** A verdict column (Stuck, Overdue), age as a `c.meter`, the table's rows dim on focus, and a `min-h-140` wrapper against the loading jump, still about 50 px short.
- **Round 2, 74, not passed.** One sorted table with a Queue column, one status hue, labelled phone cards. The age bar has no unit or 48 h tick, because `c.meter` takes only `max`.

### n37: how much of the sprint is done, and which tickets are at risk (native)

- **Round 0, 79.** Four bars of points by status with a 'Pace: 78' rule, beside a table of at-risk tickets. The hero reads '22 of 111 pts, −56 vs pace'. The pace rule stands over three bars it does not measure, and the table joins no focus because its rows are tickets and the bars are statuses. Shots `r0/scenarios-expr-n37*`.
- **Round 1, 81, passed.** One bar per ticket, grouped by status zones, so a table row and a bar are the same ticket and `DataTable focus` joins them by id. At-risk bars take the accent and carry their id.

### n38: what waits on the owner, and what it holds up (native)

- **Round 0, 79.** A scatter of open items by hours waiting and Issues held up, a 24 h rule for reviews that go ahead on their own, the top item labelled, and a `BarList` that shares the chart's focus. At 390 the top item's label is dropped; in `extreme` the 41-Issue item is clamped with a caret and no value. Shots `r0/scenarios-expr-n38*`.
- **Round 1, 79.** A fallback label spot at 390, the true value on the clamped label, the repeats cut.
- **Round 2, 81, passed.** The counts by kind in the subtitle, reviews close to 24 h in the one status hue, named offsets.

## Round-0 item scores

| Item                 | n33   | n34   | n35   | n36   | n37   | n38   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 2     | 3     | 3     | 2     | 2     | 2     |
| F2 Answer at rest    | 2     | 2     | 3     | 1     | 2     | 2     |
| F3 Baseline          | n/a   | 3     | 2     | 2     | 3     | 2     |
| F4 Colour budget     | 2     | 3     | 2     | 3     | 3     | 3     |
| F5 Honest marks      | 3     | 3     | 3     | 2     | 3     | 2     |
| F6 Labels            | 2     | 2     | 2     | 2     | 2     | 2     |
| F7 Focus and readout | 1     | 3     | 3     | 1     | 2     | 3     |
| F8 Anatomy           | 2     | 2     | 3     | 2     | 3     | 3     |
| K1 Scales            | 3     | 3     | 3     | 3     | 3     | 2     |
| K2 States            | 2     | 2     | 2     | 1     | 2     | 2     |
| K3 Keyboard          | 3     | 3     | 2     | 3     | 3     | 3     |
| K4 Tokens            | 3     | 3     | 3     | 3     | 3     | 3     |
| K5 Responsive        | 2     | 3     | 3     | 2     | 2     | 2     |
| K6 First paint       | 3     | 3     | 3     | 3     | 3     | 3     |
| X1 Word economy      | 2     | 2     | 2     | 1     | 2     | 2     |
| X2 One view          | 2     | 2     | 2     | 2     | 2     | 2     |
| X3 Linked parts      | 1     | 0     | n/a   | 1     | 0     | 3     |
| X4 Calm interaction  | n/a   | 3     | 2     | 2     | 3     | 2     |
| X5 Console anatomy   | 1     | 2     | 3     | 2     | 2     | 2     |
| Sum / max            | 36/51 | 47/57 | 46/54 | 38/57 | 45/57 | 45/57 |
| F and K sum / max    | 30/39 | 38/42 | 37/42 | 30/42 | 36/42 | 34/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`. F6, X2 and K4 held one value across all six: F6 lost a point everywhere, X2 lost a point everywhere, K4 stayed at 3. n33's F3 is `n/a` (one snapshot, no target, prior period or peer), and its X4 is `n/a` (no sweep, nothing dims). n35's X3 is `n/a` (no list beside the chart; the list frame hovered the chart's own rows).

## Findings

Severity follows the rubric: a 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, and a 2 is P3. An X item counts like an F item. No F1, F2 or K item scored 0, so there is no P1.

Points lost in round 0 by class: `skill` 48, `primitive` 25 and `rubric` 3, for a total of 76. No point is `doctrine`, `case` or `planned`. By severity there are 10 P2s (6 `skill`, 3 `primitive`, 1 `rubric`) and 54 P3s. Two plan rows were open at the pin, `v3-lint-11-lint` and this cycle's own, and neither owns a gap this cycle hit.

Where findings are fixed:

- `contract (x)` is change (x) of `v3-expr-9-contract`.
- `kit (n)` is change (n) of `v3-expr-9-kit-fixes`.
- `skill (n)` is change (n) of `v3-expr-9-skill`.
- `rubric (n)` is change (n) of `v3-expr-9-rubric`.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                 | Fix          |
| --------------- | ---------- | ---- | --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| expression-9.1  | n33 F1     | 1    | P3  | skill     | Age is a bare number with no mark (`r0/…n33--light--1800x1200`); its round-1 builder found `c.meter`                                                                                     | skill (2)    |
| expression-9.2  | n33 F2     | 1    | P3  | skill     | The strip counts failing probes but names none                                                                                                                                           | skill (3)    |
| expression-9.3  | n33 F4     | 1    | P3  | skill     | Pass, Never run, Low and Medium share one grey dot (`ExprN33.tsx:70,97`)                                                                                                                 | skill (5)    |
| expression-9.4  | n33 F6     | 1    | P3  | primitive | The probes table in a half-width `CardGrid` cell drops its 'Open findings' column at 1800; the builder found no doc of which width a priority tier needs                                 | kit (6)      |
| expression-9.5  | n33 F7     | 2    | P2  | skill     | Hover tints one row; nothing dims and no readout changes (`LIST`: NOT LINKED). No `useChartFocus` over the tables, which the shipped rule asks for 'chart or none'                       | skill (1)    |
| expression-9.6  | n33 F8     | 1    | P3  | skill     | Two flush `Section`s with no context line or footer (`ExprN33.tsx:154,157`); round 1 moved them into `DataPanel`s                                                                        | skill (7)    |
| expression-9.7  | n33 K2     | 1    | P3  | primitive | An empty or failed table's header row stops at x=750 of a 1013 px section; three Retry buttons in error                                                                                  | kit (6)      |
| expression-9.8  | n33 K5     | 1    | P3  | primitive | At 390 `maxRows: 12` clips the probe card list mid-card with no 'n of m' cue (builder report)                                                                                            | kit (6)      |
| expression-9.9  | n33 X1     | 1    | P3  | skill     | 'Needs a fix' beside 'Failing', F-232 twice, three Retry buttons, a label per line on phone cards                                                                                        | skill (6)    |
| expression-9.10 | n33 X2     | 1    | P3  | skill     | The findings sit apart from their probe, and half the page is empty                                                                                                                      | skill (1)    |
| expression-9.11 | n33 X3     | 2    | P2  | primitive | A probe and its findings share no focus; the only join is the text 'F-232 on CI runtime'. Round 1's hand `useEffect` join (~25 lines) lights only a probe's first finding                | contract (a) |
| expression-9.12 | n33 X5     | 2    | P2  | skill     | Flush sections, finding ids not mono, and `subMono` sets 'None open' in mono (`ExprN33.tsx:149`)                                                                                         | skill (7)    |
| expression-9.13 | n34 F2     | 1    | P3  | skill     | The go bands carry no label or key, the neap tide that never clears is not annotated, and 'bar dry' (`ExprN34.tsx:24`) is wrong for 2.4 m                                                | skill (3)    |
| expression-9.14 | n34 F6     | 1    | P3  | primitive | At 390 'Bar needs 2.8 m' and 'Crew limit 1.5 m' are struck through by the lines (`r0/…n34--light--390x844`); in `calm` a series label touches another                                    | kit (3)      |
| expression-9.15 | n34 F8     | 1    | P3  | skill     | No status chip at rest (`ExprN34.tsx:147` passes `undefined`) and no key for the bands                                                                                                   | skill (7)    |
| expression-9.16 | n34 K2     | 1    | P3  | primitive | At 390 the ready card is about 19 px taller than loading (footer y≈405 against ≈386); the empty state's table still lists windows (`ExprN34.tsx:83-103`)                                 | kit (1)      |
| expression-9.17 | n34 X1     | 1    | P3  | skill     | The windows are stated in the hero, the bands and the table                                                                                                                              | skill (6)    |
| expression-9.18 | n34 X2     | 1    | P3  | skill     | The window table is a separate section below the chart                                                                                                                                   | skill (1)    |
| expression-9.19 | n34 X3     | 3    | P2  | primitive | All four `LIST` lines NOT LINKED: a window row spans hours and `DataTable focus` maps a row to one item by id. The builder looked in `cartesian-chart-guide.md` and `ListFocus`          | contract (a) |
| expression-9.20 | n34 X5     | 1    | P3  | skill     | The readout 'tide 2.1 m, swell 0.5 m, 6 s' is set in mono (`ExprN34.tsx:146`), a measurement phrase, not an id or a time                                                                 | skill (7)    |
| expression-9.21 | n35 F3     | 1    | P3  | skill     | The hero '5 h free' stands against nothing at rest (`ExprN35.tsx:128-140`)                                                                                                               | skill (4)    |
| expression-9.22 | n35 F4     | 1    | P3  | skill     | Focus and Personal are close greys; the builder found no way to colour HTML marks from the series file, which `seriesTokens` and `groupTokens` in `basalt-ui/tokens` do                  | skill (5)    |
| expression-9.23 | n35 F6     | 1    | P3  | primitive | `chartLabels.row` places for the narrowest track: about a third of events unlabelled at 1800, none at 390 (`ExprN35.tsx:307`, marked)                                                    | kit (2)      |
| expression-9.24 | n35 K2     | 1    | P3  | primitive | At 390 the loading footer sits at y=415 and the ready footer at y=433                                                                                                                    | kit (1)      |
| expression-9.25 | n35 K3     | 1    | P3  | primitive | The ring of the `focus.target` host has no inset and touches 'Mon 23' and the % column (`r0/…n35--focus--light--1800x1200`)                                                              | not filed    |
| expression-9.26 | n35 X1     | 1    | P3  | skill     | '5 h free' in the hero and on the mark; 'longest block' repeats the legend                                                                                                               | skill (6)    |
| expression-9.27 | n35 X2     | 1    | P3  | skill     | No event-level detail anywhere, and 390 drops every title                                                                                                                                | skill (8)    |
| expression-9.28 | n35 X4     | 1    | P3  | skill     | Dimmed grey labels on grey bars sit near the legibility floor (`r0/…n35--list--dark--1800x1200`)                                                                                         | skill (5)    |
| expression-9.29 | n36 F1     | 1    | P3  | skill     | Age is only text ('3 weeks ago'); round 1 found `c.meter`                                                                                                                                | skill (2)    |
| expression-9.30 | n36 F2     | 2    | P2  | skill     | 'Which of mine are stuck' is a count only: !433 and !441 carry no flag, the 48 h rule (`ExprN36.tsx:59`) is invisible, the 3-week !391 is unannotated                                    | skill (3)    |
| expression-9.31 | n36 F3     | 1    | P3  | skill     | 'Yours, stuck' has no reference, though the data holds approvals needed                                                                                                                  | skill (4)    |
| expression-9.32 | n36 F5     | 1    | P3  | skill     | The stuck rule is on no row and no caption                                                                                                                                               | skill (2)    |
| expression-9.33 | n36 F6     | 1    | P3  | primitive | A Lane column repeats each group header, because a table cannot group by a column it hides (`ExprN36.tsx:118`, marked)                                                                   | not filed    |
| expression-9.34 | n36 F7     | 2    | P2  | skill     | Hover only tints the row; no focus is wired, so nothing dims and no readout changes (`r0/…n36--list--light--1800x1200`)                                                                  | skill (1)    |
| expression-9.35 | n36 F8     | 1    | P3  | skill     | The figure is not inset and the table is a flush small title                                                                                                                             | skill (7)    |
| expression-9.36 | n36 K2     | 2    | P2  | primitive | Loading draws six skeleton rows against eighteen ready, a jump of about 370 px (`SKELETON_ROWS`, `src/table/parts/phases.tsx`); round 1's `min-h-140` wrapper is still about 50 px short | contract (b) |
| expression-9.37 | n36 K5     | 1    | P3  | primitive | At 390 a phone card prints 'You' and 'Passed' with no label                                                                                                                              | kit (6)      |
| expression-9.38 | n36 X1     | 2    | P2  | skill     | The Lane column, 'You' in every Waiting on cell, 'Author: you', '5 rows' beside the 5 in the card                                                                                        | skill (6)    |
| expression-9.39 | n36 X2     | 1    | P3  | skill     | Each `StatCell` is about 750 px wide with its value and footer 700 px apart                                                                                                              | skill (7)    |
| expression-9.40 | n36 X3     | 2    | P2  | rubric    | Scored 1 on two stat cells over one table with no chart; the round-1 reviewer ruled the same structure `n/a`                                                                             | rubric (1)   |
| expression-9.41 | n36 X4     | 1    | P3  | rubric    | No sweep and nothing dims, scored 2 ('caps it at 2'); n33's reviewer ruled the same evidence `n/a`                                                                                       | rubric (2)   |
| expression-9.42 | n36 X5     | 1    | P3  | skill     | Opened timestamps not mono, no inset                                                                                                                                                     | skill (7)    |
| expression-9.43 | n37 F1     | 1    | P3  | skill     | The pace rule floats over To do, In progress and In review, which it does not measure; a `Meter` with zones draws done against pace                                                      | skill (4)    |
| expression-9.44 | n37 F2     | 1    | P3  | skill     | The at-risk tickets have no mark on the chart                                                                                                                                            | skill (3)    |
| expression-9.45 | n37 F6     | 1    | P3  | skill     | The 'Points' axis title and y ticks repeat the labelled bars and the hero's unit (`ExprN37.tsx:141`)                                                                                     | skill (6)    |
| expression-9.46 | n37 F7     | 1    | P3  | primitive | The focused grey bar is one grey step darker than the rest (`r0/…n37--sweep-gap--light--1800x1200`)                                                                                      | kit (5)      |
| expression-9.47 | n37 K2     | 1    | P3  | primitive | The table skeleton shows six rows against nine ready, about 100 px                                                                                                                       | contract (b) |
| expression-9.48 | n37 K5     | 1    | P3  | skill     | At 390 every card repeats 'Points (pts):'                                                                                                                                                | skill (6)    |
| expression-9.49 | n37 X1     | 1    | P3  | skill     | 'Not started, 13 pts' beside a Points column of 13; '3 days left' and 'day 7 of 10'                                                                                                      | skill (6)    |
| expression-9.50 | n37 X2     | 1    | P3  | skill     | A flush table beside a card, two parts that do not talk                                                                                                                                  | skill (1)    |
| expression-9.51 | n37 X3     | 3    | P2  | skill     | Bars per status, rows per ticket: no join (`LIST` NOT LINKED). Round 1 drew one bar per ticket in status zones and joined by id, so the kit could                                        | skill (1)    |
| expression-9.52 | n37 X5     | 1    | P3  | skill     | No context line under the title; the table is a flush section                                                                                                                            | skill (7)    |
| expression-9.53 | n38 F1     | 1    | P3  | skill     | Kind is carried by an accent and two grey steps, read off the legend                                                                                                                     | skill (5)    |
| expression-9.54 | n38 F2     | 1    | P3  | primitive | At 390 `chartLabels.place` drops the 'Issue 2018' label, so the worst item is an unnamed dot (`r0/…n38--light--390x844`)                                                                 | kit (2)      |
| expression-9.55 | n38 F3     | 1    | P3  | skill     | The hero 28 has no reference, and 'Review ahead in 1 h' names no review                                                                                                                  | skill (4)    |
| expression-9.56 | n38 F5     | 1    | P3  | primitive | In `extreme` 41 is drawn at 14 under a caret with no value (`ExprN38.tsx:15,125`); cycle 8's n27 lost the same on a capped peak                                                          | kit (4)      |
| expression-9.57 | n38 F6     | 1    | P3  | primitive | The label drops at 390; at 1800 a longer label clipped its tail at the plot edge and was cut to 'Issue 2018' (marked)                                                                    | kit (2)      |
| expression-9.58 | n38 K1     | 1    | P3  | skill     | At 390 the plot is about 130 px tall with ticks at 0 and 5, so dots crowd the baseline                                                                                                   | skill (8)    |
| expression-9.59 | n38 K2     | 1    | P3  | primitive | At 390 the ready card is about 19 px taller than loading; the empty footer shows 'Oldest' with no value                                                                                  | kit (1)      |
| expression-9.60 | n38 K5     | 1    | P3  | primitive | At 390 the top-item annotation disappears (as .54)                                                                                                                                       | kit (2)      |
| expression-9.61 | n38 X1     | 1    | P3  | skill     | 'Issues held up' as hero unit, axis title and label; 'ahead in N h' in rows, footer and rule; the empty sentence twice                                                                   | skill (6)    |
| expression-9.62 | n38 X2     | 1    | P3  | skill     | Two cards with their own headers, two items below the fold, half the page empty                                                                                                          | skill (1)    |
| expression-9.63 | n38 X4     | 1    | P3  | primitive | In dark the dimmed decision dots fall to a navy that is hard to see (`r0/…n38--focus--dark--1800x1200`)                                                                                  | kit (5)      |
| expression-9.64 | n38 X5     | 1    | P3  | skill     | Issue ids and hours in the body face; round 1 set the footer in mono, while the `BarList` label takes no mono                                                                            | skill (7)    |

## Filing

| Row                      | Class                                                         | Covers                                                                                         | Checkpoint | Gate |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- | ---- |
| `v3-expr-9-contract`     | primitive (P2s .11, .19, .36)                                 | .11, .19, .36, .47                                                                             | spec       | none |
| `v3-expr-9-kit-fixes`    | primitive (P3s only; no export, no contract change)           | .4, .7, .8, .14, .16, .23, .24, .37, .46, .54, .56, .57, .59, .60, .63                         | none       | none |
| `v3-expr-9-skill`        | skill (P2s .5, .12, .30, .34, .38, .51; their P3s ride along) | every `skill` finding                                                                          | none       | none |
| `v3-expr-9-rubric`       | rubric (P2 .40)                                               | .40, .41                                                                                       | none       | none |
| `v3-cycle-expression-10` | next cycle                                                    | n39, n40, n41, n42, n43, n44                                                                   | none       | none |
| not filed                | primitive, one case                                           | .25 (a ring inset on a hand-drawn host, n35 only), .33 (grouping by a hidden column, n36 only) |            |      |

There is no P1, so no row of its own. The P2s group one row per class. Each `primitive` P2 needs a contract field, so all three share the Spec row, with `checkpoint: spec` and seat opus high as the cycle brief requires:

- a list row that joins a chart's focus through an item of another grain: a window of hours (n34) and a finding under its probe (n33);
- a declared skeleton row count for a table that mounts in loading (n36, n37).

The kit row holds the behaviours that need none, each serving two cases or more: the loading height at 390 (n34, n35, n38), labels kept at width (n35, n38), rule labels at 390 (n34 and cycle 7's n21), a clamped mark's value (n38 and cycle 8's n27), dim strength (n37, n38), and phone cards and table states (n33, n36, n37). Its brief tells its lead to split one off behind a Spec if it turns out to need a field. The rubric row gives X3 and X4 one reading on a page with no chart.

Wishes from the repair rounds that are not round-0 findings, each a recipe at most or a later case's evidence: a footer slot on `DataPanel` (n33), a `StatCell` that takes a list focus or an inset (n36), a unit and a threshold tick on `c.meter` (n36), an outlier cap on `c.meter` (n33), a `BarList` taller than 10 rows (n38), mono on a `BarList` label and a hero period (n38), and one page-level Retry across frames (n33). The contract row's out-of-scope line names the ones it touches.

**The gate.** `v3-freeze-g4` is done, and no `primitive` or `doctrine` P1 is open, so no row joins a freeze (EXPRESSION.md § Gate).

**The bank.** Before this cycle the never-run cases were n33 to n39. This cycle ran six, so n39 alone is left. As lead note (h) asked, it adds six cases from pages no case covers, none with a reference:

- n40, from argo's task list: which tasks are overdue, how much is due today, and which list keeps growing;
- n41, from argo's model router: which model served each kind of request, and how often a request fell back;
- n42, from linewatch's router page: whether the router is healthy, and whether its load rose before the last drop;
- n43, from the factory console's artifacts page: which Specs and Reports came in per project, and which wait for a verdict;
- n44, from weatherorb's map: whether rain reaches my spot in the next two hours, when, and how heavy;
- n45, from argo's container page: which containers restart often, and which run close to their memory limit.

Cycle 10 draws n39 to n44. n45 stays for cycle 11, and the cycle 10 brief asks for at least five more.

Factory friction: none filed. The one lost run, `make check-fast` failing on a builder's half-written file, was the lead's ordering, and the cycle 10 brief carries it as lead note (d).

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`, unchanged since 2026-11-12):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: killed on this cycle's numbers.** `skill` findings are 48 of the 76 points lost in round 0, 63 %, and no `planned` point is owned by a skill row. That meets the first half of the confirm column.

Repair rounds lifted the median from 79 to 81 on all items, by 2 points, and on the F and K items it fell from 83.5 to 82, by 1.5. Both are under the 5 that kills. Cycles 2 to 8 each lifted it by 5 or more and under 15, which left it open (cycle 8 by 9.5), so this is the first cycle on the kill side.

The kill column reads 'the builder knew what to do and could not', and the two cases that never passed fit it. n33's and n36's builders took the reviewers' findings each round and named a kit limit for each one they left: no footer on `DataPanel`, no focus or inset on `StatCell`, no unit or tick on `c.meter`, six skeleton rows, no grouping by a hidden column. Their scores moved 71, 76, 74 and 67, 74, 74. The skill share says the method is still where most round-0 points go, so the cycle 10 brief asks its lead to say whether this kill holds or was a one-cycle result.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in any round. n35 hand-drew its week track from `div`s through `focus.target` and scored 85, which is data-mapped HTML through the seam rather than SVG.
- The round-0 median glue was 37.5 lines and the last-round median 47.5, both under 80.

Where glue grew it is label-fit and interval layout again (census V3): n35's lanes, per-row label fit and hour ticks, and n38's label placement with a fallback spot.

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for forms in two cases:

- spans on a time axis by day (n35): the `seam-track` recipe in `docs/recipes/` draws it, and the builder followed it to an 85; one case, so not a kind candidate under the Rule of Three.
- a list joined to a chart at another grain (n33, n34): a contract field, not a form, and the Spec row weighs it.

## Convergence

Not converged:

- The round-0 median is 79, under 80; on the F and K items it is 83.5.
- The minimum is 67, over 60; on the F and K items it is 71, over 60.
- No referenced case ran, so the clause of three of four cannot be met.
- There is no P1, and there are 10 P2s against a limit of three.

`v3-cycle-expression-10` is filed after the four fix rows.

owner:
