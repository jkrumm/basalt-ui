# Expression cycle 8

Six one-shot trials on master after the cycle 7 fix rows landed. The cases are n27, n28, n29, n30, n31 and n32, all native: TuffUI published no component after `f31ea2b`, so none has a reference. They are scored against `docs/v3/expression/rubric.md`. Protocol: `docs/v3/EXPRESSION.md`.

Two cases passed in round 0, the first since cycle 6: n30 and n31, both at 88. The round-0 median is 75.5 and the minimum 70. On the F and K items alone, the trend measure against cycles 1 and 2, the median is 80 and the minimum 71. There is no P1 and there are 9 P2s, so the area has not converged. With no referenced case, the clause of three of four referenced verdicts cannot be met.

`skill` cost 42 of the 73 points lost in round 0. Every case lost a point to word economy and one to one view, as in cycles 6 and 7. The kit cost 25, and most of that is three gaps that need a contract field:

- a `Sparkline` that steps by keys but names no point, announces nothing and dims nothing;
- bars with no value label, a zero bar with no mark, and a stack that never clamps;
- no form for rows nested under a parent.

Reviewers cost 6. Two of those 6 came from the lead's own keyboard tool, which focused a scroll box, and it was fixed after round 0.

Repair rounds passed every case but n27: n32 and n29 in round 1 (81, 84) and n28 in round 2 (86). n27 ended at 75, held back by the Sparkline until its builder replaced it in round 2. The last-round median is 85, and 87 on the F and K items. The lift is 9.5 points, the same as cycles 6 and 7.

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `996f76c1ebaa8e9f395d4d953841a089d384d49e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Date       | 2026-11-17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Cases      | n27, n28, n29, n30, n31 and n32 (native)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel. Each was fenced to `packages/basalt-ui/agent/**`, `llms.txt`, the published types and docs, and the playground's own code, minus every other `scenarios/expr/` directory. Each built and shot its own route. The prompt is cycle 7's with the paths bumped, three changes, and three kit gaps the lead's probe found. First, it says to look at the page the way the shipped skill's last step says, and offers both `basalt-ui shot` and `shots.ts` without naming the keys state. Second, it says how to change `demo/series.ts`. Third, it says to run `bun test` on its own |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Shots      | `.evidence/v3-shots/expression-8/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored), with the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, a keyboard frame `--focus--`, a list frame `--list--` where a list exists and a pointer-sweep frame `--sweep-gap--`, each light and dark at 1800x1200 and 390x844, and `r<round>/shoot-log.txt`. Source snapshots in `src-r<round>/`, builder reports in `builder-reports/`, reviews in `reports/`, the lead's log in `lead-state.md`, probes in `probe/`                                                                                    |

### Before round 0

- **TuffUI.** The newest commit is still `f31ea2b` (2026-11-16; `gh api repos/yurigdesigner/tuffui/commits`), so there is no `c` case and there are no verdicts. The six cases are the ones the brief named.
- **(a) The cycle 7 kit fixes**, probed on a build of the pinned master (`.evidence/v3-shots/expression-8/probe/`):
  - n26's error frame landed. Both cards read 'Could not load each hop, minute by minute.' and 'Could not load each target over 24 hours.'
  - n23's error at 390 landed for the strip and the table: one 'Could not load monitor health.' with one Retry, and 'Could not load monitors.'. Its `BarList`, titled 'Flaky in the last day', still reads 'Could not load this.', because that row covered tables and panels.
  - n26 `?fixture=home` at 1800 landed: 'Router 9 min' clears the lines.
  - n21 at 390 did not land. Its median rule draws with no label: dots cover every spot beside the rule, as the kit row's own ship note says.
  - n22's focus frame landed: each line keeps its hue. n22 at 390 landed too: the ticks read '20 Sep 4 Oct 18 Oct 8 Nov' with air between them.
  - n24's loading frame did not land. It ends about 80 px above its rest frame at 1800. A card that mounts straight into loading has no ready frame to hold, as the kit row's ship note says.
  - Builders were told the three gaps that remain: the dropped rule label, the card that mounts in loading, and the untitled `BarList` error.
- **(b) The contract row** `v3-expr-7-contract` shipped on a `looks_good` Spec. It added `focus.seriesItem` and `DataTable focusSeries`, mono on `c.entity` and footer facts, and a `BarList` that stacks parts by series; the Spec gave `Bars` no horizontal orientation. The reviewer prompt names all three, and says that a list whose rows are a chart's series is now scored under X3.
- **(c) The rubric row** landed (`d95e4a8e`). Reviewers read its three sentences from `rubric.md`.
- **(d) The repo's gate.** `make check-fast` on the round-0 tree ran before scoring and passed (rc 0, including the unit suite in a host slot and the pack-test). The final tree's run is under [After the rounds](#after-the-rounds).
- **(e) Reviewer notes.** The prompt keeps cycle 7's lines on the two sanctioned colour forms, the 61 px band and the LIST approach. No reviewer marked down a colour form or the band.
- **(f) The keyboard frame.** The builder prompt no longer names `shots.ts` as the shoot command. It says to look as the skill's last step says and offers both tools without naming the keys state. **5 of 6** builders then shot `basalt-ui shot --states keys` unasked (n28, n29, n30, n31, n32), against 0 of 6 in cycles 5 to 7. The sixth, n27, ran it too, and the CLI found no keys host on its page: a `Sparkline` inside a `StatCard` (expression-8.6). So the cycle 7 count was the prompt, not the skill.
- **(g) The shared series file.** Builders appended and later changed only their own group, and each check before a shoot found the diff against master to be insertions only. In round 1, n29 removed its own group. Every builder ran `bun test` as a command of its own, and none reported a build or shoot held behind a test slot.

### The shoot

- **The lead tool** (`lead-shots.ts`, `shoot-round.sh`, not in git) is cycle 7's with the paths bumped. Rounds 0, 1 and 2 wrote 200, 136 and 64 frames.
- **One fix after round 0.** The keyboard frame focused the first tabbable non-control element in `<main>`. On n32 that was the `BarList`'s scroll region (`div[role=region]`), where ArrowRight does nothing, so the log showed no announcement. `basalt-ui shot --states keys` on the same build walked the table rows and announced each Issue (`probe/keys-r0/n32`). The tool now skips scroll regions (`probe/keyfix`: the list walks with ArrowDown, '#1950 Merge lock handoff: 6 waiting on it, …'). Rounds 1 and 2 used the fixed tool, and the round-0 scores stand as scored (expression-8.58, .62).
- **List frames.** Round 0 linked lists in n28, n29, n31 and n32; n27 and n30 have none. On n29 the frame took the split bar's segment divs (`[data-chart-mark]`) for a list, so its 'list' was the chart itself; the review read it that way and named it for the lead.
- **Sweeps.** n28, n29, n30 and n31 have adjacent marks. n28 and n31 dim by colour or series opacity, which the counters do not see, so reviewers read those frames.

### After the rounds

`make check-fast` ran on the final tree after every builder was done, on the pinned base, and passed (rc 0). That covers the static gate (fmt, lint, typecheck, the 77 budgets, the literal, recipe and playground lint checks), the unit suite in a host slot, the playground build, and the coverage, contract-frozen and pack-test steps. The layout step picked no file, because none of the 25 changed files reaches a layout test, so CI runs the full suite.

## Numbers

| Number                         | n27       | n28                                     | n29                             | n30    | n31                  | n32                    | Summary                   |
| ------------------------------ | --------- | --------------------------------------- | ------------------------------- | ------ | -------------------- | ---------------------- | ------------------------- |
| First-try score (round 0)      | 76        | 72                                      | 75                              | 88     | 88                   | 70                     | median 75.5, minimum 70   |
| First-try score, F and K only  | 79        | 71                                      | 81                              | 88     | 90                   | 74                     | median 80, minimum 71     |
| Round 1 score (F and K)        | 70 (71)   | 74 (74)                                 | 84 (90)                         | passed | passed               | 81 (83)                | median 82.5 (85.5)        |
| Round 2 score (F and K)        | 75 (76)   | 86 (86)                                 | passed                          | passed | passed               | passed                 | last-round median 85 (87) |
| Rounds-to-pass (F and K)       | 3 (3)     | 2 (2)                                   | 1 (0)                           | 0 (0)  | 0 (0)                | 1 (1)                  | mean 1.17 (1.0)           |
| Verdict                        | n/a       | n/a                                     | n/a                             | n/a    | n/a                  | n/a                    | none (no referenced case) |
| Glue lines, round 0            | ~45       | ~60                                     | ~25                             | ~20    | ~45                  | ~25                    | median 35                 |
| Glue lines, last round         | ~80       | ~95                                     | ~40                             | ~20    | ~45                  | ~45                    | median 45                 |
| Escape hatches, round 0        | none      | 2 `as const`, 3 markers                 | 2 `as CSSProperties`            | none   | `as const`, 1 marker | 1 `as const`           | hand `<svg>` 0 of 6       |
| Escape hatches, last round     | 2 markers | 2 `as const`, a reload retry, 8 markers | 2 `as CSSProperties`, 2 markers | none   | as round 0           | 2 `as const`, 1 marker | hand `<svg>` 0 of 6       |
| Devices used unasked (round 0) | 4         | 8                                       | 6                               | 10     | 9                    | 4                      | median 7 of 12            |

A case that passed carries its passing score into later rows. The pass mark is 80 on all items. Rounds-to-pass in brackets is the first round whose F and K score reached 80: n29 did in round 0 (81) without passing on all items. n27's score fell in round 1 (76 to 70). Its builder cut repeats and named the slid measures, but left the Sparkline's readout as the kit's, and the round-1 reviewer read F3 and K5 a point apart from round 0's on the same structure.

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines; it excludes fixtures. Glue grew where builders drew what the kit lacks. n28 placed bar names and values, a zero hairline and a capped extreme by hand: about 55 of its 95 lines. n27 moved from `Sparkline` to `CartesianChart` to get a readout that names its week, at about 80 lines. n32's round-1 tree is about 30 lines of tree walk and a 15-line indent cell.

No build used a lint disable, `theme-allow`, a deep import or a hand-written `<svg>`. n29 drew its split bar from `div`s through `focus.target` and `focus.item(i)`, with two `as CSSProperties` casts for the custom properties that size and colour each segment. Every `as const` is a const assertion. Markers (`// cycle-expression-8:`) name what the kit lacked:

- n28: a signed money format, a value label per bar, a zero bar mark, a clamp on a stack, headroom;
- n27: a Sparkline readout, and later a partial-point style and a peak label;
- n29: a loading frame that holds its height, a titled `BarList` error, mono `BarList` names;
- n31: a rule box as a label obstacle;
- n32: a nesting form.

Devices reached in round 0, partials counted, out of six builds: colour budget 6, anatomy 6, hero number 5, keyboard parity 5, baseline delta 4, dim-the-rest 4, direct labels 4, pre-annotation 3, quantized marks 2, threshold geometry 1, live cue 1, metaphor 0. The median is 7, against 7.5 in cycle 7.

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The rows of cycles 3 to 8 give both, with F and K first.

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

Every headline number is the best of the eight cycles:

- On the F and K items the first-try median rose 8.5 to 80, the first cycle to reach the pass mark, and the minimum rose 4 to 71.
- On all items the median rose 6 to 75.5 and the minimum 7 to 70.
- Two cases passed in round 0, against none in cycle 7.
- The P2 count fell from 14 to 9.
- The mean rounds-to-pass fell from 2.5 to 1.17 on all items.
- The round-0 glue median rose from 25 to 35, still well under the seam's 80.

## Cases

### n27: which health measures moved the right way, and which slid (native)

- **Round 0, 76.** A sentence '3 measures slid, 4 moved the right way' over eight `StatCard`s with a 12-week `Sparkline` each, sorted slid first. Every card carries 'Better when', 'Last week', the verdict word and a range line. Keys move a bare value into the axis label row, with no week and no announcement. Shots `r0/scenarios-expr-n27*`.
- **Round 1, 70.** The repeats are gone, the headline names the three that slid, and a 'peak 38 h in W40' sub line appears. The Sparkline's readout, dim and cap are left as the kit's under one marker, and F7 and K3 stay at 1.
- **Round 2, 75, not passed.** Each measure is now a `ChartCard` with `CartesianChart` marks and a `useChartFocus`. The keys announce the week and its value, the last week is dashed, a 12-week median rule is drawn, and an outlier is capped with the kit's caret. The capped 38 h peak carries no label (`chartLabels` dropped it at the plot edge), and the announcement joins eight values without their measures.

### n28: where the money goes, and which category moved most (native)

- **Round 0, 72.** Bars of each category's change, October against September, beside a `BarList` of 12-month totals, with a per-month chart and the merchants of the focused category. The axis uses invented short names ('Power' for Energy). Only the mover and the zeros are labelled, by hand. In `extreme` the mover runs off the plot with no caret, because the accent bar is a second series and a stack never clamps. Shots `r0/scenarios-expr-n28*`.
- **Round 1, 74.** The list's names are on the bars, a hand cap prints 'Travel +€2,809 ↑', the accent follows focus, and loading and error titles are neutral. At 390 four names drop and labels collide.
- **Round 2, 86, passed.** Labels thin by priority at 390, a 2-euro hairline gives a zero category a mark, the rest fade on focus, and the footer and a per-month delta pill return. A zero bar now shows the cap caret, from a comparison against the hairline value.

### n29: how much of the year is tagged, and which merchants hold untagged bookings (native)

- **Round 0, 75.** A hand-drawn split bar (tags as `div` segments) with a legend list, beside a `BarList` of merchants by untagged spend. The legend rows join no focus, the untagged segment uses `BASALT.brand` while the list uses the series blue, and the segments carry no labels. Shots `r0/scenarios-expr-n29*`.
- **Round 1, 84, passed.** Legend rows join the bar's focus both ways, the hero follows the focused tag, one blue in both cards, and segment labels placed with `chartLabels.fits`. At 390 the loading frame is still 55 px short, as the kit holds it.

### n30: when the line is busiest, and how close to the contract (native)

- **Round 0, 88, passed.** Two weekday-by-hour `Heatmap`s, down and up, of each hour's busiest 15 minutes as a share of the contract. They share one focus that drives both heroes ('94 %, −6 pts to the contract, Busiest Thu 20:15'). A peak triangle and an over-contract state complete it. Its points went to word economy, one view, state copy, cells with no value, off-clock ticks, and a keyboard-focused cell with no ring. Shots `r0/scenarios-expr-n30*`.

### n31: what shipped each day, and what is in production (native)

- **Round 0, 88, passed.** Stacked bars per day by kind with a 'Deployed' rule, beside a day list that joins the chart's focus. The hero reads '22 shipped, +4 vs prior 7 days', and the sha and deploy time are in mono in the footer. The sha is not on the rule, the delta turns red on an empty Saturday, and the 390 sweep loses focus at a gap. Shots `r0/scenarios-expr-n31*`.

### n32: which open Issues wait on others, and which unblocks the most (native)

- **Round 0, 70.** A `StatCard` '6 Issues wait on #1950', a `BarList` of blockers showing 4 of 13, and a table with a 'Waits on' id column; who waits on whom is never drawn. Amber 'Waiting' sits on 16 of 25 rows, and #1950 is named three times. Shots `r0/scenarios-expr-n32*`.
- **Round 1, 81, passed.** One `DataTable` laid out as a tree: each Issue sits indented under its first blocker, with 'also waits on #…' for the rest. 'Ships first: unblocks the most' marks the top row, and only Building keeps its hue. The tree is one `c.custom` column the builder indented by hand, and focused rows do not dim the rest.

## Round-0 item scores

| Item                 | n27   | n28   | n29   | n30   | n31   | n32   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 2     | 2     | 3     | 3     | 3     | 1     |
| F2 Answer at rest    | 2     | 2     | 2     | 3     | 2     | 2     |
| F3 Baseline          | 3     | 3     | 2     | 3     | 3     | n/a   |
| F4 Colour budget     | 3     | 3     | 2     | 2     | 2     | 2     |
| F5 Honest marks      | 2     | 2     | 3     | 2     | 3     | 2     |
| F6 Labels            | 2     | 1     | 2     | 2     | 2     | 3     |
| F7 Focus and readout | 1     | 2     | 2     | 3     | 3     | 2     |
| F8 Anatomy           | 3     | 2     | 2     | 3     | 3     | 3     |
| K1 Scales            | 3     | 1     | 3     | 3     | 3     | 3     |
| K2 States            | 3     | 2     | 2     | 2     | 2     | 2     |
| K3 Keyboard          | 1     | 3     | 2     | 2     | 3     | 1     |
| K4 Tokens            | 3     | 3     | 3     | 3     | 3     | 3     |
| K5 Responsive        | 2     | 2     | 3     | 3     | 3     | 2     |
| K6 First paint       | 3     | 2     | 3     | 3     | 3     | 3     |
| X1 Word economy      | 1     | 2     | 2     | 2     | 2     | 1     |
| X2 One view          | 2     | 2     | 2     | 2     | 2     | 2     |
| X3 Linked parts      | n/a   | 2     | 1     | 3     | 3     | 2     |
| X4 Calm interaction  | 2     | 3     | 2     | 3     | 2     | 2     |
| X5 Console anatomy   | 3     | 2     | 2     | 3     | 3     | 2     |
| Sum / max            | 41/54 | 41/57 | 43/57 | 50/57 | 50/57 | 38/54 |
| F and K sum / max    | 33/42 | 30/42 | 34/42 | 37/42 | 38/42 | 29/39 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`. X2 lost a point in every build, X1 in every build, two of them two points. K4 held at 3 in all six. n27's X3 is `n/a`: no list or second part shows its measures. n32's F3 is `n/a`: the data holds no target, best or prior period.

## Findings

Severity follows the rubric: a 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, and a 2 is P3. An X item counts like an F item. No item scored 0, so there is no P1.

Points lost in round 0 by class: `skill` 42, `primitive` 25 and `rubric` 6, for a total of 73. No point is `doctrine`, `case` or `planned`. By severity there are 9 P2s (3 `skill`, 5 `primitive`, 1 `rubric`) and 55 P3s. Six plan rows were open at the pin, and none owns a gap this cycle hit: `v3-cycle-shell-5`, `v3-dogfood-4-visual`, `v3-cycle-dogfood-5`, `v3-lint-10-lint`, `v3-cycle-lint-11`, and this cycle's own row. `v3-dogfood-4-visual`'s status-column width and `Sparkline form="bar"` are not what n27 or n32 lost.

Where findings are fixed:

- `kit (n)` is change (n) of `v3-expr-8-kit-fixes`.
- `contract (x)` is change (x) of `v3-expr-8-contract`.
- `skill (n)` is change (n) of `v3-expr-8-skill`.
- `rubric (n)` is change (n) of `v3-expr-8-rubric`.
- `none` names a gap one case asks for: a recipe at most, under EXPRESSION.md's two-case rule.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                                                              | Fix              |
| --------------- | ---------- | ---- | --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| expression-8.1  | n27 F1     | 1    | P3  | skill     | Eight `StatCard`s sorted slid first (`ExprN27.tsx:154`); nothing marks where the slid group ends, so the viewer scans pill colours                                                                                                                    | skill (8)        |
| expression-8.2  | n27 F2     | 1    | P3  | skill     | The headline counts but names no slid measure (`ExprN27.tsx:162`); no mark is annotated (the 38 h spike, the partial week)                                                                                                                            | skill (3)        |
| expression-8.3  | n27 F5     | 1    | P3  | primitive | Each Sparkline autoscales, so the 38 h spike flattens Time in queue's other weeks (212 h in `extreme`); `Sparkline` takes no domain or cap                                                                                                            | contract (a)     |
| expression-8.4  | n27 F6     | 1    | P3  | primitive | The keyboard readout '8.1' replaces the W41 axis label and names no week; the end dot takes no value (`r0/scenarios-expr-n27--focus--light--1800x1200.png`)                                                                                           | contract (a)     |
| expression-8.5  | n27 F7     | 2    | P2  | primitive | The only response is the readout in the label row; nothing dims. The builder marked the Sparkline's missing dim in round 1 and left `Sparkline` for `CartesianChart` in round 2                                                                       | contract (a)     |
| expression-8.6  | n27 K3     | 2    | P2  | primitive | Each card is a `role=slider`; the KEY log's live text is empty before and after both presses; `basalt-ui shot --states keys` found no host on the page (0 frames, rounds 0 and 1)                                                                     | contract (a)     |
| expression-8.7  | n27 K5     | 1    | P3  | skill     | The eight cards run about 2,000 px at 390; two and a half show above the tab bar                                                                                                                                                                      | skill (8)        |
| expression-8.8  | n27 X1     | 2    | P2  | skill     | 'Better when lower' on all eight cards, 'W47 so far' in the summary and on every axis, the verdict word beside its pill, 'vs last week' in the pill and 'Last week' in the footer (`ExprN27.tsx:46`, `63`, `82`, `102-103`, `109`, `172`)             | skill (1)        |
| expression-8.9  | n27 X2     | 1    | P3  | skill     | About 240 px per card for a figure and a small line; three columns of cards, not one surface                                                                                                                                                          | skill (2)        |
| expression-8.10 | n27 X4     | 1    | P3  | primitive | No sweep and nothing dims, so the score is capped at 2: the Sparkline has no dimmed state                                                                                                                                                             | contract (a)     |
| expression-8.11 | n28 F1     | 1    | P3  | skill     | The axis uses invented short names (Food, Trips, Power) that the list and hero never use (`fixture.ts`, `short`)                                                                                                                                      | skill (7)        |
| expression-8.12 | n28 F2     | 1    | P3  | skill     | The mover's label sits on a bar named 'Power'; 'where the money goes' has no figure of its own                                                                                                                                                        | skill (3)        |
| expression-8.13 | n28 F5     | 1    | P3  | primitive | In `extreme` the Travel bar is cut at the plot top with no caret and no '+€2,809': one series split in two for a per-datum accent stacks, and a stack never clamps (`ExprN28.tsx:45`, `111-126`)                                                      | contract (b)     |
| expression-8.14 | n28 F6     | 2    | P2  | primitive | Only the mover and the zeros carry labels, placed by hand with `chartLabels` and a `text` mark (`ExprN28.tsx:127-151`); a bar has no value label; at 390 the band axis keeps every other name (`r0/scenarios-expr-n28--light--390x844.png`)           | contract (b)     |
| expression-8.15 | n28 F7     | 1    | P3  | primitive | Focusing a zero category highlights no mark: a zero bar draws nothing                                                                                                                                                                                 | contract (b)     |
| expression-8.16 | n28 F8     | 1    | P3  | skill     | The per-month card has no figure or footer, and its subtitle repeats its title (`ExprN28.tsx:179-184`)                                                                                                                                                | skill (10)       |
| expression-8.17 | n28 K1     | 2    | P2  | primitive | The extreme bar overruns the last tick with no break mark and reads as about +€225 for +€2,809 (`r0/scenarios-expr-n28-fixture-extreme--light--1800x1200.png`); the builder's comment expected the kit's caret                                        | contract (b)     |
| expression-8.18 | n28 K2     | 1    | P3  | skill     | Error has no Retry; loading and error print 'Energy per month' and '€1,606 in 12 months' from data that did not load                                                                                                                                  | skill (9)        |
| expression-8.19 | n28 K5     | 1    | P3  | primitive | At 390 half the names are gone: the band axis thins and no bar carries its name                                                                                                                                                                       | contract (b)     |
| expression-8.20 | n28 K6     | 1    | P3  | primitive | The per-month y gutter changes width when focus rescales the axis, shifting the plot about 9 px                                                                                                                                                       | none: n28 only   |
| expression-8.21 | n28 X1     | 1    | P3  | skill     | 'Change vs September' repeats the subtitle and the footer; 'Per month' repeats its title                                                                                                                                                              | skill (1)        |
| expression-8.22 | n28 X2     | 1    | P3  | skill     | Row-1 cards end at 597 and 647 px; the merchant card has about 100 px of empty body                                                                                                                                                                   | skill (2)        |
| expression-8.23 | n28 X3     | 1    | P3  | skill     | Both directions link, but the chart's names do not match the list's rows (.11), and the focused grey bar is barely set off                                                                                                                            | skill (7)        |
| expression-8.24 | n28 X5     | 1    | P3  | skill     | The per-month card is a flush chart with no inset or footer (the reviewer also asked for mono amounts, which the shipped rule does not ask)                                                                                                           | skill (10)       |
| expression-8.25 | n29 F2     | 1    | P3  | skill     | The untagged segment, the answer, carries no annotation; its 38 % is read from the legend                                                                                                                                                             | skill (3)        |
| expression-8.26 | n29 F3     | 1    | P3  | rubric    | Scored 2 for 'no target, prior year or delta pill' on one tax year; n32's reviewer ruled F3 `n/a` on data with no reference, as cycle 7's n24 was                                                                                                     | rubric (1)       |
| expression-8.27 | n29 F4     | 1    | P3  | skill     | The split bar's untagged blue is `BASALT.brand` (`ExprN29.tsx:24`) while the list's is the series blue; three tagged greys hard to tell apart. A one-row stacked `BarList` takes the series file's colours                                            | skill (4)        |
| expression-8.28 | n29 F6     | 1    | P3  | skill     | The split bar has no direct labels; segments are matched to the legend by order                                                                                                                                                                       | skill (4)        |
| expression-8.29 | n29 F7     | 1    | P3  | skill     | A focused segment is announced, but the hero stays '62 %' (`r0/scenarios-expr-n29--focus--light--1800x1200.png`)                                                                                                                                      | skill (4)        |
| expression-8.30 | n29 F8     | 1    | P3  | skill     | Two blues break 'swatches match the marks'; about 140 px empty under the legend                                                                                                                                                                       | skill (4)        |
| expression-8.31 | n29 K2     | 1    | P3  | primitive | The `BarList` error reads 'Could not load this.'; at 390 loading ends about 55 px short (the card mounts in loading, and the footer is passed only when ready, `ExprN29.tsx:141`)                                                                     | kit (2), kit (3) |
| expression-8.32 | n29 K3     | 1    | P3  | rubric    | Docked because a second host was 'not shown to be reachable'; the keyboard log covers one host by design                                                                                                                                              | rubric (2)       |
| expression-8.33 | n29 X1     | 1    | P3  | skill     | The year three times; the one-series legend repeats the card title; the legend's 38 % restates the hero                                                                                                                                               | skill (1)        |
| expression-8.34 | n29 X2     | 1    | P3  | skill     | About 140 px of dead band under the legend to match the list's height                                                                                                                                                                                 | skill (2)        |
| expression-8.35 | n29 X3     | 2    | P2  | skill     | The legend rows list the bar's parts and join no focus (`ExprN29.tsx:65-79`); spreading `tagFocus.item(i)` linked them in round 1. The LIST frame had hovered the bar's own segments, which the lead tool took for a list                             | skill (4)        |
| expression-8.36 | n29 X4     | 1    | P3  | skill     | A dimmed Business and the focused Donation come out near-equal greys (`r0/scenarios-expr-n29--sweep-gap--light--1800x1200.png`)                                                                                                                       | skill (4)        |
| expression-8.37 | n29 X5     | 1    | P3  | rubric    | Docked for no delta pill and plain merchant names; the data holds no baseline, and the shipped rule sets mono for times and ids only                                                                                                                  | rubric (3)       |
| expression-8.38 | n30 F4     | 1    | P3  | skill     | Magnitude by hue alone, no value on the cells that answer; `Heatmap annotate` puts a short mark in a cell                                                                                                                                             | skill (5)        |
| expression-8.39 | n30 F5     | 1    | P3  | skill     | An hour that missed one to three of its buckets looks complete; a `states` entry marks it                                                                                                                                                             | skill (5)        |
| expression-8.40 | n30 F6     | 1    | P3  | skill     | A bare '0' on Mon 04:00 with no key; hour ticks at 00, 05, 10 (`tickCols` keeps clock stops)                                                                                                                                                          | skill (5)        |
| expression-8.41 | n30 K2     | 1    | P3  | skill     | Empty names no next step, error no cause and no retry, and the error footer blanks the contract it already knows                                                                                                                                      | skill (9)        |
| expression-8.42 | n30 K3     | 1    | P3  | primitive | The keyboard-focused cell gets no ring, unlike a pointer focus (`r0/scenarios-expr-n30--focus--light--1800x1200.png`); the builder saw the same in its own keys frame                                                                                 | kit (1)          |
| expression-8.43 | n30 X1     | 1    | P3  | skill     | The contract named three times per card: pill, legend caption, footer                                                                                                                                                                                 | skill (1)        |
| expression-8.44 | n30 X2     | 1    | P3  | skill     | Two cards on one scale carry two legends and two captions; the lower half of the 1800 frame is empty                                                                                                                                                  | skill (2)        |
| expression-8.45 | n31 F2     | 1    | P3  | skill     | The production sha sits only in the footer; the 'Deployed' rule's label lacks it                                                                                                                                                                      | skill (3)        |
| expression-8.46 | n31 F4     | 1    | P3  | skill     | The delta pill turns red on the empty Saturday ('−3.1 vs 3.1 a day'); Fix and Chore one grey step apart                                                                                                                                               | skill (6)        |
| expression-8.47 | n31 F6     | 1    | P3  | primitive | Kinds only in the legend; Monday's total touches the deploy rule. The builder drew the rule's box as a label obstacle by hand because `chartLabels` does not know it (marker)                                                                         | contract (b)     |
| expression-8.48 | n31 K2     | 1    | P3  | primitive | At 390 ready is about 19 px taller than loading: the period chip wraps in ready only                                                                                                                                                                  | kit (3)          |
| expression-8.49 | n31 X1     | 1    | P3  | skill     | '7 days' three times; each day's count on the bar and again in the list header                                                                                                                                                                        | skill (1)        |
| expression-8.50 | n31 X2     | 1    | P3  | skill     | The day list is cut mid-row with no scroll cue; chart and list are two cards                                                                                                                                                                          | skill (2)        |
| expression-8.51 | n31 X4     | 1    | P3  | primitive | At 390 the gap frame shows no dim and an empty readout (SWEEP); at 1800 the focus holds across the gap                                                                                                                                                | none: n31 only   |
| expression-8.52 | n32 F1     | 2    | P2  | primitive | Who waits on whom is never drawn: a ranked `BarList` and a 'Waits on' id column. The builder looked for a dependency or nesting form in round 0 and indented a `c.custom` column by hand in round 1 (marker)                                          | contract (c)     |
| expression-8.53 | n32 F2     | 1    | P3  | skill     | The top blocker's bar carries no annotation                                                                                                                                                                                                           | skill (3)        |
| expression-8.54 | n32 F4     | 1    | P3  | skill     | Amber 'Waiting' on 16 of 25 rows dilutes the one status hue                                                                                                                                                                                           | skill (6)        |
| expression-8.55 | n32 F5     | 1    | P3  | primitive | `bodyRows={4}` shows 4 of 13 blockers with no cue that nine are hidden                                                                                                                                                                                | kit (4)          |
| expression-8.56 | n32 F7     | 1    | P3  | primitive | A row hover updates the hero and marks the bar, but no other row dims (LIST: `data-dimmed 0`)                                                                                                                                                         | kit (5)          |
| expression-8.57 | n32 K2     | 1    | P3  | skill     | Error names no cause and offers no retry; empty has no next step and prints one line three times                                                                                                                                                      | skill (9)        |
| expression-8.58 | n32 K3     | 2    | P2  | rubric    | The lead tool's keyboard frame focused the `BarList`'s scroll region and pressed ArrowRight. `basalt-ui shot --states keys` on the same build walks the table and announces each Issue (`probe/keys-r0/n32`), as does the fixed tool (`probe/keyfix`) | rubric (2)       |
| expression-8.59 | n32 K5     | 1    | P3  | skill     | At 390 a phone card shows '#1950' with no label over 'Unblocks: 23'                                                                                                                                                                                   | skill (8)        |
| expression-8.60 | n32 X1     | 2    | P2  | skill     | #1950 in the hero, the bar list and the table; near-twin card titles; the empty line three times                                                                                                                                                      | skill (1)        |
| expression-8.61 | n32 X2     | 1    | P3  | skill     | A dead band under the hero at 1800; the bar list's top four repeat the table's                                                                                                                                                                        | skill (2)        |
| expression-8.62 | n32 X3     | 1    | P3  | rubric    | Chart to list scored as not evidenced, because the keyboard frame sat on the scroll region (.58)                                                                                                                                                      | rubric (2)       |
| expression-8.63 | n32 X4     | 1    | P3  | primitive | No sweep, and list rows never dim (as .56)                                                                                                                                                                                                            | kit (5)          |
| expression-8.64 | n32 X5     | 1    | P3  | skill     | The bar list card lacks the inset and footer                                                                                                                                                                                                          | skill (10)       |

Two kit gaps carry over from the probe of cycle 7's fixes. A rule label with marks on every side is still dropped (n21 at 390), and a card that mounts in loading still holds only its declared rows (n24). No build this cycle lost a point to the first. The second recurs as .31 and .48, and kit (3) re-checks n24.

Round 1 showed one more thing, which is not a round-0 finding. n27's reviewer read the headline 'Fix commits, Time in queue, Issues shipped slid' as having its word spaces collapsed at 1800. The source joins with ', ' (`src-r1/n27/ExprN27.tsx:162`), and `PageSummary` sets `tracking-tight` on the sentence. No other reviewer and no other frame shows it, so it is left for cycle 9's reviewers to confirm.

## Filing

| Row                     | Class                                               | Covers                                                                                                     | Checkpoint | Gate                                                            |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `v3-expr-8-contract`    | primitive (P2s .5, .6, .14, .17, .52)               | .3, .4, .5, .6, .10, .13, .14, .15, .17, .19, .47, .52                                                     | spec       | none: additive, ships in a minor unless the Spec says otherwise |
| `v3-expr-8-kit-fixes`   | primitive (P3s only; no export, no contract change) | .31, .42, .48, .55, .56, .63                                                                               | none       | none                                                            |
| `v3-expr-8-skill`       | skill (P2s .8, .35, .60; their P3s ride along)      | every `skill` finding                                                                                      | none       | none: skill ships in a minor                                    |
| `v3-expr-8-rubric`      | rubric (P2 .58)                                     | .26, .32, .37, .58, .62                                                                                    | none       | none                                                            |
| `v3-cycle-expression-9` | next cycle                                          | n33, n34, n35, n36, n37, n38                                                                               | none       | none                                                            |
| not filed               | primitive, one case                                 | .20 (a y gutter that shifts on focus, n28 only), .51 (a 390 gap that drops a band chart's focus, n31 only) |            |                                                                 |

There is no P1, so no row of its own. The P2s group one row per class. Every `primitive` P2 needs a contract field, so all five share the Spec row, with `checkpoint: spec` and seat opus high as the cycle brief requires:

- a Sparkline point readout (n27);
- bar value labels, a zero-bar mark and a clamped stack (n28, with n31 and cycle 7's n22 and n24);
- nested rows (n32, with cycle 3's c10).

The kit row holds the five behaviours that need none. Its brief tells its lead to split one off behind a Spec if it turns out to need a field. The rubric row changes three sentences of `rubric.md` and the shipped reviewer, on round-0 reviews that read F3, K3 and X5 two ways (EXPRESSION.md § Guards). The lead tool's keyboard fix is outside git and was made in this cycle (§ The shoot).

One-case wishes, each a recipe at most:

- a signed money format (n28);
- a contract line on a heatmap (n30);
- a toggle between two heatmaps without a router field (n30);
- a day-grouped feed that joins a focus and shows an empty day, which `EventList` does not (n31);
- a partial-day mark on a bar (n31);
- grouping cards by verdict (n27).

The kit and contract rows' out-of-scope lines name the ones they touch.

**The gate.** No `primitive` or `doctrine` P1 is open, so the freeze is left alone (EXPRESSION.md § Gate).

**The bank.** Before this cycle the never-run cases were n27 to n33. This cycle ran six, so n33 alone is left. As lead note (h) asked, it adds six cases from pages no case covers, none with a reference:

- n34, from argo's marine page: when there is water over the harbour bar, and whether the swell is low enough then;
- n35, from argo's calendar: how much of each workday is booked, and where the longest free block is;
- n36, from argo's GitLab merge requests: which wait on me, for how long, and which of mine are stuck;
- n37, from argo's Jira sprint: how much is done with three days left, and which tickets are at risk;
- n38, from the factory console's Needs you page: what waits on the owner, and what it holds up;
- n39, from weatherorb's overnight temperatures: which nights freeze, and whether the models agree.

Cycle 9 draws n33 to n38. n39 stays for cycle 10, and the cycle 9 brief asks for at least five more.

**The plan file.** `docs/plan.yaml` is past 60 KiB (61.8 KiB before this cycle's rows). CYCLES.md step 6 says to collapse done rows to the adopted-row form at that size, but this cycle's brief allows only appended rows. The collapse is left to a row that owns the file, and is filed as a signal for the repo's lead.

Factory friction: none this cycle. Builders ran `bun test` on its own (lead note (g)), and none reported a wait behind a test slot.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`, unchanged since 2026-11-12):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` findings are 42 of the 73 points lost in round 0, 57.5 %, and no `planned` point is owned by a skill row. That meets the first half of the confirm column (half or more).

Repair rounds lifted the median from 75.5 to 85 on all items, by 9.5 points. On the F and K items they lifted it from 80 to 87, by 7. Both lifts are under the 15 that confirms and over the 5 that kills, so the hypothesis stays open on the lift, as in cycles 2 to 7. Five of six cases passed by round 2, against two in cycle 7.

The lift was smaller because round 0 started higher: two cases passed at once, and four of six passed on the F and K items by round 1. The kit capped the rest:

- n27 could not pass with the Sparkline it chose and moved to `CartesianChart` in round 2.
- n28's passing build draws its labels, zero marks and cap by hand, in about 55 of its 95 lines.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in any round, against the three that would confirm. n29 drew its split bar from `div`s through the focus seam, which is data-mapped HTML rather than SVG.
- The round-0 median glue was 35 lines and the last-round median 45, both under 80.

Where glue grew it is label-fit again (census V3). n28 placed names and values by priority, n31 drew a rule's box as an obstacle, and n29 fitted segment labels against a fixed track width. Contract (b) takes the shareable part.

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for forms in two cases:

- rows nested under the row they wait on (n32; cycle 3's c10 asked for the graph of a leaked key's reach): two cases, so the Spec row weighs a table nesting field. A dependency graph would be a kind candidate only at three cases under the Rule of Three.
- a share of a whole with named parts (n29): the stacked `BarList` from cycle 7 draws it, so this is a skill finding (.27), not a form.

## Convergence

Not converged:

- The round-0 median is 75.5, under 80; on the F and K items it is 80.
- The minimum is 70, over 60; on the F and K items it is 71, over 60.
- No referenced case ran, so the clause of three of four cannot be met.
- There is no P1, and there are 9 P2s against a limit of three.

`v3-cycle-expression-9` is filed after the four fix rows.

owner:
