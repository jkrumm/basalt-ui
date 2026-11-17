# Expression cycle 7

Six one-shot trials on master after the cycle 6 fix rows landed: six native cases, n11, n22, n23, n24, n25 and n26, none with a reference, because TuffUI published no component after `f31ea2b`. They are scored against `docs/v3/expression/rubric.md`. Protocol: `docs/v3/EXPRESSION.md`.

No case passed in round 0. The round-0 median is 69.5 and the minimum 63. On the F and K items alone, the trend measure against cycles 1 and 2, the median is 71.5 and the minimum 67. There is no P1 and there are 14 P2s, so the area has not converged; with no referenced case, the clause of three of four referenced verdicts cannot be met at all.

The points went where they went in cycle 6. `skill` cost 72 of 102: a table of the page's items that joins no focus although the kit links tables and bar lists, a page of rows with no card anatomy, a headline that stands against nothing, an answer stated in the hero but not on the mark. The kit cost 22, none of it needing an export but three fields behind a Spec: a list whose rows are a chart's series, a mono face for an entity's main text and a footer value, and a bar form that keeps twelve long names. Reviewers cost 7: three rubric sentences were read three ways.

Repair rounds passed two cases: n11 at 82 in round 1 and n22 at 80 in round 2. n23, n24, n25 and n26 ended at 74, 74, 79 and 79. The last-round median is 79, and 81 on the F and K items. The lift is 9.5 points, the same as cycle 6's.

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `e8fdaefdf0b8de942f37758d1456d283dfee42be`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Date       | 2026-11-17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Cases      | n11, n22, n23, n24, n25 and n26 (native)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel. Each was fenced to `packages/basalt-ui/agent/**`, `llms.txt`, the published types and docs, and the playground's own code, minus every other `scenarios/expr/` directory. Each built and shot its own route. The prompt is cycle 6's with the paths bumped and one line on the `refLines` label gap of lead note (a). It does not mention the keyboard frame                                                                                                             |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Shots      | `.evidence/v3-shots/expression-7/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored), with the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, a keyboard frame `--focus--`, a list frame `--list--` where a list exists and a pointer-sweep frame `--sweep-gap--`, each light and dark at 1800x1200 and 390x844, and `r<round>/shoot-log.txt`. Source snapshots in `src-r<round>/`, builder reports in `builder-reports/`, reviews in `reports/`, the lead's log in `lead-state.md` |

### Before round 0

- **TuffUI.** No commit after `f31ea2b` (`gh api repos/yurigdesigner/tuffui/commits`, newest `f31ea2b` on 2026-11-16), so no `c` case and no verdicts. The six cases are the ones the brief named.
- **(a) The cycle 6 kit fixes**, probed on a build of the pinned master (`.evidence/v3-shots/expression-7/probe/`):
  - (1) landed. `probe-steps.ts` on c16 at 1800: a pointer arriving on a table row directly, across the chart and from the side each leave one `data-focused` (cycle 6: 1, 0, 1). The lead tool's stepped path links c16's list.
  - (2) landed. n15's keyboard log reads one announcement per move ('Week of Sep 21: …', then 'Week of Sep 28: …').
  - (3) did not land in full. n21 at 390 draws its dashed median rule with no label (`probe/scenarios-expr-n21--light--390x844.png`). Builders were told that a `refLines` label with no free spot is still dropped, most often at 390, and to check their 390 shots.
- **(b) The contract fields** of `v3-expr-6-contract` shipped (`c66ca4bd`, optional fields accept `undefined`; `0660bc88`, `periodMono` and `subMono`). Reviewers got no note on conditional spreads, and no build wrote one.
- **(c) The repo's gate.** `make check-fast` on the round-0 tree passed its static gate (fmt, lint, typecheck, the 77 budgets, the generation checks). Its unit step was still queued for a host slot, eight ahead, when round 1 was due, so it was stopped by pid as the brief allows. The final tree's run is under [After the rounds](#after-the-rounds).
- **(d) Reviewer notes.** The reviewer prompt named the `{ light, dark }` series pair and a `fillOpacity` number as sanctioned forms, the 61 px band as the kit's, and the LIST approach. With cycle 6's crossing fixed, it said a `direct arrival only` line would now be a finding of its own. No reviewer marked either colour form or the band down, and no list frame needed a direct arrival.
- **(e) The keyboard frame.** No builder shot one unasked: **0 of 6**, as in cycles 5 and 6, although step 6 of both skills now names `basalt-ui shot --states keys` as its own checklist line. The count is confounded: the builder prompt names `apps/playground/scripts/shots.ts` as the shoot command, which has no keys state, and n24's builder said exactly that. The cycle 8 brief asks its lead to let the prompt defer to the skill.

### The shoot

- **The lead tool** (`lead-shots.ts`, `shoot-round.sh`, not in git) is cycle 6's with the paths bumped. It needed no fix. Rounds 0, 1 and 2 wrote 204, 204 and 176 frames.
- **List frames.** Round 0 linked one list (n24's table, by the stepped path). n11's and n23's lists were tables and a `BarList` with no focus, n25's and n26's tables of other items. By round 2 n11, n23, n24 and n25 linked; n26 never did (expression-7.84).
- **Sweeps.** Only n24 (bars) and n26 (lines) have adjacent marks. Their dims are by colour, so the counters read 0 and reviewers read the frames.
- **A shared file.** In round 1 n24's builder rewrote `apps/playground/src/demo/series.ts` from its own group on and deleted the n22, n25 and n26 groups; those builders re-added them, and the lead checked before each shoot that the file's diff against master is insertions only. Round-2 prompts said to change only one's own group with one Edit after a fresh Read.

### After the rounds

`make check-fast` ran on the final tree, rebased onto master (`ee6c7897`) after every builder was done. The static gate, the unit suite in a host slot (22 processes), the playground build and the coverage and agent-doc-drift gates passed; the layout step picked no file, because none of the 26 changed files reaches a layout test, so CI runs the full suite. `check-contract-frozen` failed on `charts/contract.ts`: master had amended it (`18f78915`, a Sparkline band) after that base, and this branch touches nothing under `packages/`. A second rebase onto `de45a29b` cleared it (20 pinned files frozen), and the steps the failure had skipped (guard completeness, the primitive contract tests, the test ledger and the pack-test) then passed.

## Numbers

| Number                         | n11                                                 | n22                  | n23                                                      | n24                   | n25                                  | n26                                 | Summary                   |
| ------------------------------ | --------------------------------------------------- | -------------------- | -------------------------------------------------------- | --------------------- | ------------------------------------ | ----------------------------------- | ------------------------- |
| First-try score (round 0)      | 63                                                  | 74                   | 63                                                       | 72                    | 76                                   | 67                                  | median 69.5, minimum 63   |
| First-try score, F and K only  | 67                                                  | 76                   | 71                                                       | 72                    | 79                                   | 71                                  | median 71.5, minimum 67   |
| Round 1 score (F and K)        | 82 (81)                                             | 78 (81)              | 68 (69)                                                  | 76 (74)               | 75 (81)                              | 67 (71)                             | median 75.5 (77.5)        |
| Round 2 score (F and K)        | passed                                              | 80 (81)              | 74 (74)                                                  | 74 (69)               | 79 (83)                              | 79 (83)                             | last-round median 79 (81) |
| Rounds-to-pass (F and K)       | 1 (1)                                               | 2 (1)                | 3 (3)                                                    | 3 (3)                 | 3 (1)                                | 3 (2)                               | mean 2.5 (1.83)           |
| Verdict                        | n/a                                                 | n/a                  | n/a                                                      | n/a                   | n/a                                  | n/a                                 | none (no referenced case) |
| Glue lines, round 0            | ~12                                                 | ~25                  | ~25                                                      | ~15                   | ~35                                  | ~70                                 | median 25                 |
| Glue lines, last round         | ~45                                                 | ~50                  | ~32                                                      | ~32                   | ~75                                  | ~70                                 | median 47.5               |
| Escape hatches, round 0        | 1 `as const satisfies`, a no-op retry, 1 marker     | `as const`           | none                                                     | 1 `as const`          | 3 `as const`, 1 arbitrary grid class | 4 `as const`, 1 marker              | hand `<svg>` 0 of 6       |
| Escape hatches, last round     | 2 custom columns (marked), 2 `as const`, as round 0 | `as const`, 1 marker | 1 `as const satisfies`, 1 marker, 1 arbitrary grid class | `as const`, 3 markers | 2 `as const`, 1 arbitrary grid class | 6 `as const`, 2 `as 'x'`, 2 markers | hand `<svg>` 0 of 6       |
| Devices used unasked (round 0) | 4                                                   | 8                    | 7                                                        | 5                     | 8                                    | 8                                   | median 7.5 of 12          |

A case that passed carries its passing score into later rows. The pass mark is 80 on all items. Rounds-to-pass in brackets is the first round whose F and K score reached 80: n25 did in round 1 (81) and n26 in round 2 (83) without passing on all items. n24's F and K score fell in round 2 (74 to 69): its builder stretched the y domain by the tallest segment, not the stack, to make room for a label the kit dropped, and cut the two largest stacks (n24 round-2 review, F5 and K1).

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines; it excludes fixtures. n26's ~70 is gap and culprit derivation and readouts, not geometry; n25's last-round ~75 is data derivation for the book marks it put on the chart. Glue grew where builders drew what the kit lacked: n22 and n24 placed end and total labels by hand with `chartLabels` (about 25 and 22 lines), n11 drew difficulty pips in a custom column.

No build used a lint disable, `theme-allow`, a deep import or a hand-written `<svg>`. Every `as const` is a const assertion; n26's `as 'x'` types an axis key. Markers (`// cycle-expression-7:`) name what the kit lacked: a number column that takes `null` (n26), an inert table action (n23), short band names and a stretched domain (n24), a rating column (n11).

Devices reached in round 0, partials counted, out of six builds: hero number 6, colour budget 6, keyboard parity 6, direct labels 5, anatomy 5, dim-the-rest 4, threshold geometry 3, baseline delta 2, pre-annotation 2, live cue 1, metaphor 0, quantized marks 0. The median rises to 7.5 from 7.

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The rows of cycles 3 to 7 give both, with F and K first.

| Cycle | Sha        | First-try median      | Minimum     | Last-round median     | Rounds-to-pass, mean  | Verdicts (build, tie, reference) | P1  | P2  | Glue median, round 0 to last      | Hand `<svg>`, last round |
| ----- | ---------- | --------------------- | ----------- | --------------------- | --------------------- | -------------------------------- | --- | --- | --------------------------------- | ------------------------ |
| 1     | `062367fe` | 68                    | 64          | 78.5                  | 2.17                  | 3, 2, 0                          | 0   | 16  | 62.5 to 195                       | 1 of 6                   |
| 2     | `ac6acc90` | 66.5                  | 48          | 78.5                  | 2.17                  | 3, 1, 0                          | 0   | 17  | 50 to 67.5                        | 0 of 6                   |
| 3     | `2ad50570` | 65.5 (all items 62)   | 57 (all 54) | 72.5 (all items 71)   | 2.83 (all items 3)    | 4, 0, 0                          | 0   | 28  | 18.5 to 34                        | 1 of 6                   |
| 4     | `4c991fd8` | 65.5 (all items 65)   | 62 (all 59) | 77.5 (all items 76.5) | 2.17 (all items 2.33) | 1, 1, 0 (two referenced)         | 0   | 16  | 37.5 to 65                        | 0 of 6                   |
| 5     | `e03eddea` | 75 (all items 72.5)   | 60 (all 52) | 83 (all items 81.5)   | 1.5 (all items 1.5)   | none (no referenced case)        | 1   | 18  | 26.5 to 27.5                      | 0 of 6                   |
| 6     | `349bc69f` | 75 (all items 71)     | 62 (all 67) | 82 (all items 80.5)   | 1.17 (all items 1.33) | 1, 0, 0 (one referenced)         | 0   | 12  | 40 to 47.5 (25.5 without spreads) | 0 of 6                   |
| 7     | `e8fdaefd` | 71.5 (all items 69.5) | 67 (all 63) | 81 (all items 79)     | 1.83 (all items 2.5)  | none (no referenced case)        | 0   | 14  | 25 to 47.5                        | 0 of 6                   |

On the F and K items the first-try median fell 3.5 to 71.5 and the minimum rose from 62 to 67; on all items the median fell 1.5 to 69.5 and the minimum fell 4 to 63. The round-0 spread (63 to 76) is as narrow as cycle 6's, but no case reached 80, against one in cycle 6. The round-0 glue median fell to 25 now that the contract takes `undefined` (cycle 6's 25.5 without spreads). More repair rounds were needed: the mean rounds-to-pass rose from 1.33 to 2.5 on all items.

## Cases

### n11: how far along am I in the catalogue (native)

- **Round 0, 63.** A sentence '5 of 20 courses started' over a five-column `DataTable`: course, difficulty as a dot and a word, a progress meter, lessons done and lessons total. No card, no focus, the accent on a difficulty dot. Shots `r0/scenarios-expr-n11*`.
- **Round 1, 82, passed.** A `StatCard` 'Courses started, 5 of 20' with a pill and footer pairs, difficulty as five pips in a custom column, progress as one bar with '9 / 18', and one `useChartFocus` that drives the table and the card's readout. Nothing dims, and the course column still holds the marks far from the name.

### n22: is my fitness improving (native)

- **Round 0, 74.** A verdict hero ('Improving +6.6 % in 28 days, on resting heart rate') over two 28-day slope lines on one up-is-fitter axis with a ±4 % no-change band, and two signal cards. Ticks at ±5 beside a band at ±4, focus greys both lines to one slate, loading 36 to 56 px short. Shots `r0/scenarios-expr-n22*`.
- **Round 1, 78.** An end label on the leading line, an announcement with both signals' values, cards that follow focus, a chart context line, loading at height. Both lines still dim to one slate, the 390 ticks still touch.
- **Round 2, 80, passed.** The accent follows the signal that leads the verdict, the end note hides while a morning is focused, the band edges sit on ticks, the flat fixture draws both lines. To land the band on a tick the builder moved the case's change threshold from ±4 % to ±5 % (expression-7.17). Still a stack of three cards and touching ticks at 390.

### n23: what is down, slow or flaky (native)

- **Round 0, 63.** A four-cell `StatGroup` strip (Down, Slow, Flaky, Paused), a 'Flaky in the last day' `BarList` running 1,480 px wide, and a monitor table under it. The bar list and the table list the same monitors and share no focus; no headline has a baseline; the strip in error repeats Retry four times. Shots `r0/scenarios-expr-n23*`.
- **Round 1, 68.** One focus over the flaky monitors drives the bar list and the table, the list beside the table, a '+151 min vs usual day' pill, tones for Slow and Flaky in the status column. Nothing dims, the readout is only the live region, and the strip's count disagrees with the table's Down rows.
- **Round 2, 74, not passed.** A visible readout, the list before the table on a phone, counts that include groups (now counting a group and its child twice). The builder left the dim, the strip error and the skeleton height as the kit's.

### n24: which workflows draw the gateway spend (native)

- **Round 0, 72.** A hero '54 % of $22,030 is production' over stacked bars per workflow by purpose, linked both ways to a table. 4 of 12 names on the axis, a plot that stops at 65 % of its card because the last long name reserves its width, three readouts at once, eleven slivers in the extreme fixture. Shots `r0/scenarios-expr-n24*`.
- **Round 1, 76.** Totals on the top bars, shortened names (the plot fills its card), the tooltip off, wider grey steps. Two of 12 names on the axis, label collisions at 390, loading still 80 px short.
- **Round 2, 74, not passed.** Every bar named by a first word, a Payer column, the empty sentence once. The label above the tallest bar never placed, and the builder's domain stretch cut the two largest stacks.

### n25: am I on pace for the reading goal (native)

- **Round 0, 76.** A step line of books finished against an even-pace diagonal and a goal rule, with '18 of 24, −3 vs pace', beside a started-books table. On a phone the table scrolls sideways and the State column is off screen; the stalled books are not on the chart. Shots `r0/scenarios-expr-n25*`.
- **Round 1, 75.** The phone table down to Book and State, loading at height, an end dot at today, one status word fewer. Its reviewer scored X3 1 where round 0's had ruled it `n/a` on the same structure (expression-7 rubric (3)).
- **Round 2, 79, not passed.** Each started book a dot on the time axis, red if stalled, joined to its table row by one focus, '18 (−3)' at today. The stalled dots sit at the finished count of their day, so five coincide in the zero fixture, and the done fixture's end label lands on the line.

### n26: where does the line break (native)

- **Round 0, 67.** 'Breaks at the provider' over four median round-trip lines with all-loss minutes as labelled zones, and a per-hop table in a second card. The table's rows are the chart's four lines and share no focus; no headline has a baseline; the router lies on the zero rule; the home fixture's spike crushes the other hops. Shots `r0/scenarios-expr-n26*`.
- **Round 1, 67.** A '+8 min vs previous day' pill, the accent on the culprit hop, a capped domain with the kit's caret, evening-delay footer pairs, one readout. A lane form tried and dropped (stacked charts overlapped in one card); zone labels under lines.
- **Round 2, 79, not passed.** Zone labels clear of the lines with headroom, the four round trips in the focused status, the cap named on the axis. X3 stays 0 in every round: the kit has no way to link a row to a series (expression-7.84).

## Round-0 item scores

| Item                 | n11   | n22   | n23   | n24   | n25   | n26   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 1     | 3     | 2     | 2     | 2     | 2     |
| F2 Answer at rest    | 2     | 2     | 2     | 2     | 2     | 2     |
| F3 Baseline          | 2     | 3     | 1     | n/a   | 3     | 1     |
| F4 Colour budget     | 2     | 3     | 2     | 3     | 2     | 2     |
| F5 Honest marks      | 2     | 2     | 3     | 2     | 3     | 2     |
| F6 Labels            | 2     | 2     | 2     | 1     | 3     | 2     |
| F7 Focus and readout | 1     | 2     | 1     | 2     | 2     | 2     |
| F8 Anatomy           | 1     | 2     | 2     | 2     | 2     | 2     |
| K1 Scales            | 3     | 2     | 2     | 2     | 2     | 2     |
| K2 States            | 2     | 2     | 2     | 2     | 2     | 2     |
| K3 Keyboard          | 3     | 2     | 3     | 3     | 3     | 3     |
| K4 Tokens            | 3     | 3     | 3     | 3     | 3     | 3     |
| K5 Responsive        | 2     | 2     | 2     | 2     | 1     | 2     |
| K6 First paint       | 2     | 2     | 3     | 2     | 3     | 3     |
| X1 Word economy      | 2     | 2     | 2     | 2     | 2     | 2     |
| X2 One view          | 2     | 2     | 1     | 2     | 2     | 2     |
| X3 Linked parts      | n/a   | n/a   | 0     | 3     | n/a   | 0     |
| X4 Calm interaction  | 1     | 2     | 1     | 2     | 2     | 2     |
| X5 Console anatomy   | 1     | 2     | 2     | 2     | 2     | 2     |
| Sum / max            | 34/54 | 40/54 | 36/57 | 39/54 | 41/54 | 38/57 |
| F and K sum / max    | 28/42 | 32/42 | 30/42 | 28/39 | 33/42 | 30/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`. F2 lost a point in every build; so did X1, and K2 in all six. Two X3 scores are 0, both on a list that shows the chart's own items: n23's `BarList` and table (a skill gap, the kit links both) and n26's table of the chart's series (a kit gap). n24's F3 is `n/a`: one 30-day window with no target or previous period.

## Findings

Severity follows the rubric. A 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, a 2 is P3, and an X item counts like an F item. The two 0s are X3, so there is no P1.

Points lost in round 0 by class: `skill` 72, `primitive` 22, `rubric` 7 and `planned` 1, for a total of 102. No point is `doctrine` or `case`. By severity there are 14 P2 (10 `skill`, 2 `primitive`, 2 `rubric`) and 72 P3. The open plan rows at the pin (`v3-cycle-shell-3`, `v3-dogfood-3-row-mark`, `v3-dogfood-3-visual`, `v3-cycle-dogfood-4`, `v3-lint-8-lint`, `v3-cycle-lint-9`) own one gap this cycle hit: `v3-dogfood-3-visual` reshares a table's width among its columns (expression-7.13, appended to its brief as a note).

Where findings are fixed:

- `kit (n)` is change (n) of `v3-expr-7-kit-fixes`.
- `contract (x)` is change (x) of `v3-expr-7-contract`.
- `skill (n)` is change (n) of `v3-expr-7-skill`.
- `rubric (n)` is change (n) of `v3-expr-7-rubric`.
- `none` names a gap one case asks for: a recipe at most, under EXPRESSION.md's two-case rule.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                      | Fix                         |
| --------------- | ---------- | ---- | --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| expression-7.1  | n11 F1     | 2    | P2  | skill     | A five-column table holds the data; difficulty is a dot and a word ('4 Hard'), read rather than seen (`ExprN11.tsx:23-37`); round 1 drew it as five pips in a custom column                                   | skill (8)                   |
| expression-7.2  | n11 F2     | 1    | P3  | skill     | 'Five of 20 courses started' answers progress at rest, but no mark carries an annotation (`ExprN11.tsx:51-55`)                                                                                                | skill (4)                   |
| expression-7.3  | n11 F3     | 1    | P3  | skill     | A percent bar hides course size: 12 and 48 lessons draw the same bar; round 1 put '9 / 18' beside it                                                                                                          | skill (3)                   |
| expression-7.4  | n11 F4     | 1    | P3  | skill     | The one accent is a 6 px dot on difficulty 4 and 5; the progress bars, the answer, carry none                                                                                                                 | skill (7)                   |
| expression-7.5  | n11 F5     | 1    | P3  | skill     | The unit '% of lessons' lives only in the column header (`ExprN11.tsx:34`), so the 390 cards print bare numbers                                                                                               | skill (5)                   |
| expression-7.6  | n11 F6     | 1    | P3  | skill     | 'Lessons done' and 'Lessons' repeat the bar's number: three zeros per unstarted row                                                                                                                           | skill (11)                  |
| expression-7.7  | n11 F7     | 2    | P2  | skill     | A row hover only tints it; nothing dims and no readout follows (`r0/scenarios-expr-n11--list--light--1800x1200.png`, LIST NOT LINKED). `useChartFocus` with `DataTable focus` did it in round 1               | skill (1)                   |
| expression-7.8  | n11 F8     | 2    | P2  | skill     | No card, context line, figure or footer: a sentence over a flush table (`ExprN11.tsx:70-77`); round 1 led with a `StatCard`                                                                                   | skill (2)                   |
| expression-7.9  | n11 K2     | 1    | P3  | primitive | Error reads 'Could not load this.' (`table/parts/phases.tsx:122` takes no title); at 390 the skeleton row pitch is 140 px against 148 px loaded                                                               | kit (1), kit (5)            |
| expression-7.10 | n11 K5     | 1    | P3  | skill     | Each 390 card is 148 px for three number lines, so about four of 20 courses fit a screen; round 1 folded them into one cell                                                                                   | skill (5)                   |
| expression-7.11 | n11 K6     | 1    | P3  | rubric    | The same 390 skeleton mismatch charged a second time, under K6; n25's and n26's reviewers charged it once, under K2                                                                                           | rubric (2)                  |
| expression-7.12 | n11 X1     | 1    | P3  | skill     | Progress stated three ways per row; the empty state says 'no courses' twice                                                                                                                                   | skill (11)                  |
| expression-7.13 | n11 X2     | 1    | P3  | planned   | The course column takes about 830 px at 1800, so the marks sit far from the name they describe; `width: 'content'` did not close it in round 1                                                                | note on v3-dogfood-3-visual |
| expression-7.14 | n11 X4     | 2    | P2  | rubric    | Scored 1 because nothing dims ('no dimmed state to read'); the round-1 reviewer scored the same non-dimming table 3 and charged the dim to F7 (`r0/` and `r1/scenarios-expr-n11--list--light--1800x1200.png`) | rubric (1)                  |
| expression-7.15 | n11 X5     | 2    | P2  | skill     | A flush table under one sentence, none of the console anatomy                                                                                                                                                 | skill (2)                   |
| expression-7.16 | n22 F2     | 1    | P3  | skill     | The hero answers, but nothing marks the RHR line leaving the band; the only note is the band label (`ExprN22.tsx:220`)                                                                                        | skill (4)                   |
| expression-7.17 | n22 F5     | 1    | P3  | primitive | Ticks at +5, 0, −5 while the band edges sit at ±4 (`r0/scenarios-expr-n22--light--1800x1200.png`); the kit has no tick control, and in round 2 the builder moved the case's threshold to ±5 to fit the ticks  | kit (6)                     |
| expression-7.18 | n22 F6     | 1    | P3  | primitive | At 390 the x ticks read '27 Sep 4 Oct' as one string; `x.ticks: 4` and `3` did not thin them (rounds 1 and 2); the sparse fixture's line end touches the band label                                           | kit (6), kit (3)            |
| expression-7.19 | n22 F7     | 1    | P3  | primitive | Focus turns both lines one slate, so the accent series is lost (`r0/scenarios-expr-n22--focus--light--1800x1200.png`)                                                                                         | kit (4)                     |
| expression-7.20 | n22 F8     | 1    | P3  | skill     | No context line under the chart title; the strip carries no swatches                                                                                                                                          | skill (2)                   |
| expression-7.21 | n22 K1     | 1    | P3  | skill     | The flat fixture draws RHR under HRV, so one line vanishes; an odd '+9' tick at 390 (round 1 fixed the draw order and the domain)                                                                             | skill (6)                   |
| expression-7.22 | n22 K2     | 1    | P3  | primitive | Loading 36 px short of the chart card, 56 px by the stat cards; a bare dash in empty and error; the builder declared the status row with `label: ''` in round 1 because no slot declaration exists            | kit (5)                     |
| expression-7.23 | n22 K3     | 1    | P3  | skill     | The announcement 'stable neither signal passed ±4 %' carries no separator and no per-signal values (`ExprN22.tsx:133-136`)                                                                                    | skill (12)                  |
| expression-7.24 | n22 K5     | 1    | P3  | skill     | The 390 plot is about 140 px tall with colliding ticks; the trend reads with effort                                                                                                                           | skill (5)                   |
| expression-7.25 | n22 K6     | 1    | P3  | rubric    | The loading-height jump of .22 charged again under K6                                                                                                                                                         | rubric (2)                  |
| expression-7.26 | n22 X1     | 1    | P3  | skill     | '28 days' stated three times, the ±4 % threshold three times, the verdict word on each card                                                                                                                   | skill (11)                  |
| expression-7.27 | n22 X2     | 1    | P3  | skill     | A chart card with two signal cards stacked under it; the per-signal detail sits below, not beside                                                                                                             | skill (11)                  |
| expression-7.28 | n22 X4     | 1    | P3  | primitive | No sweep; the dimmed rest is one slate for both lines, so the signals are not told apart                                                                                                                      | kit (4)                     |
| expression-7.29 | n22 X5     | 1    | P3  | skill     | No context line on the chart card, 'Counts from' inside the inset, dates not mono although `periodMono` exists                                                                                                | skill (2)                   |
| expression-7.30 | n23 F1     | 1    | P3  | skill     | 'Slow' shows only as a count: the rows carry no slow mark (`ExprN23.tsx:117`); round 1 derived Slow and Flaky states in the status column                                                                     | skill (8)                   |
| expression-7.31 | n23 F2     | 1    | P3  | skill     | The Slow cell cuts at 'and 1 more'; the Down figure carries no hue                                                                                                                                            | skill (4)                   |
| expression-7.32 | n23 F3     | 2    | P2  | skill     | No headline stands against anything: thresholds are words ('over 500 ms'), and 30-day uptime never meets the 1-day figure; round 1 added '+151 min vs usual day'                                              | skill (3)                   |
| expression-7.33 | n23 F4     | 1    | P3  | skill     | The Down hero and the 'Down now' tags carry no hue; the one status hue sits only in table dots                                                                                                                | skill (7)                   |
| expression-7.34 | n23 F6     | 1    | P3  | skill     | At 390 the strip subs clip ('Nextcloud, qBittorrent an…'); round 1 cut them to one name and a count                                                                                                           | skill (5)                   |
| expression-7.35 | n23 F7     | 2    | P2  | skill     | No hover focus on any mark: LIST NOT LINKED, `faded 0/0`; `BarList focus` and `DataTable focus` existed and linked in round 1                                                                                 | skill (1)                   |
| expression-7.36 | n23 F8     | 1    | P3  | skill     | The strip is a flush band of label, figure and free text; no inset or delta pill                                                                                                                              | skill (2)                   |
| expression-7.37 | n23 K1     | 1    | P3  | skill     | The outage fixture shows five identical 1,440 min bars and no cue that 15 more are cut                                                                                                                        | skill (6)                   |
| expression-7.38 | n23 K2     | 1    | P3  | primitive | The strip in error draws a message and a Retry per cell, 'Could not load down.' clipping at 390 (`r0/scenarios-expr-n23-shot-state-error--light--390x844.png`); the table skeleton is 6 rows against 27       | kit (2)                     |
| expression-7.39 | n23 K5     | 1    | P3  | skill     | At 390 the table becomes 170 px cards with unlabelled lines, 27 of them before the flaky list                                                                                                                 | skill (5)                   |
| expression-7.40 | n23 X1     | 1    | P3  | skill     | 'Nightly backup' and 'Sonarr' named four times on one screen                                                                                                                                                  | skill (11)                  |
| expression-7.41 | n23 X2     | 2    | P2  | skill     | Three stacked bands with no link; five bars run 1,480 px wide at 1800 and the table that lists the same monitors sits below                                                                                   | skill (11)                  |
| expression-7.42 | n23 X3     | 3    | P2  | skill     | The `BarList` and the table show the same monitors and share no focus in either direction (LIST NOT LINKED in all four frames); one `useChartFocus` passed to both linked them in round 1                     | skill (1)                   |
| expression-7.43 | n23 X4     | 2    | P2  | rubric    | Scored 1 because 'nothing flashes, but only because nothing responds': the missing response is F7's (.35)                                                                                                     | rubric (1)                  |
| expression-7.44 | n23 X5     | 1    | P3  | skill     | The strip lacks the inset figure, delta pill and footer pairs; names not mono                                                                                                                                 | skill (2)                   |
| expression-7.45 | n24 F1     | 1    | P3  | skill     | The payer, the case's second dimension, is only a row sub line and two footer sums (`ExprN24.tsx:68`, `99-120`)                                                                                               | skill (8)                   |
| expression-7.46 | n24 F2     | 1    | P3  | skill     | No value or call-out on the bars that draw the spend; 'which workflows' is read from heights                                                                                                                  | skill (4)                   |
| expression-7.47 | n24 F5     | 1    | P3  | skill     | In the extreme fixture eleven bars collapse to 1 to 6 px; the $0 workflow draws nothing and carries no '0' (`r0/scenarios-expr-n24-fixture-extreme--light--1800x1200.png`)                                    | skill (6)                   |
| expression-7.48 | n24 F6     | 2    | P2  | primitive | 4 of 12 names on the band axis at 1800, 2 at 390; no value on any bar. The builder wished for horizontal stacked bars; `BarList` does not stack (cycle 6's c16 wished for horizontal bars too)                | contract (c)                |
| expression-7.49 | n24 F7     | 1    | P3  | skill     | A pointer opens a tooltip, swaps the hero and lights a row: three readouts; round 1 turned the tooltip off                                                                                                    | skill (9)                   |
| expression-7.50 | n24 F8     | 1    | P3  | skill     | No status; the payer footer pairs map to no mark                                                                                                                                                              | skill (2)                   |
| expression-7.51 | n24 K1     | 1    | P3  | skill     | The extreme fixture's slivers (as .47) and a bar-less $0 slot; no cap on the domain                                                                                                                           | skill (6)                   |
| expression-7.52 | n24 K2     | 1    | P3  | primitive | Loading ends 80 px above the loaded card (`r0/scenarios-expr-n24-shot-state-loading--light--1800x1200.png` against rest); the builder found no way to hold the footer height in three rounds                  | kit (5)                     |
| expression-7.53 | n24 K5     | 1    | P3  | primitive | The plot stops at x=247 of a 366 px card at 390: the long last band label reserves its half width; the builder shortened the names in round 1 to get the width back                                           | kit (6)                     |
| expression-7.54 | n24 K6     | 1    | P3  | primitive | The plot ends at x=890 against a card edge near 995 at 1800, read as a stale measure; the cause is the label reserve of .53 (the reviewer also cited the loading jump of .52)                                 | kit (6)                     |
| expression-7.55 | n24 X1     | 1    | P3  | skill     | '30 days' in the context line and the column header; 'Billed to' on all 12 rows                                                                                                                               | skill (11)                  |
| expression-7.56 | n24 X2     | 1    | P3  | skill     | A third of the plot card empty, the production column dropped at 1800, about 550 px unused under both parts                                                                                                   | skill (11)                  |
| expression-7.57 | n24 X4     | 1    | P3  | primitive | At 390 the tooltip names doc-summarise while the live text and the frame keep support-triage (`r0/scenarios-expr-n24--sweep-gap--light--390x844.png`)                                                         | none: n24 only              |
| expression-7.58 | n24 X5     | 1    | P3  | primitive | Workflow ids set in the body face in the table and on the axis: an entity's main text has no mono flag (builder, rounds 1 and 2)                                                                              | contract (b)                |
| expression-7.59 | n25 F1     | 1    | P3  | skill     | The stalled books are a plain table beside the pace chart; in round 2 the builder put each started book on the time axis and linked the two                                                                   | skill (8)                   |
| expression-7.60 | n25 F2     | 1    | P3  | skill     | Nothing marks today or the gap to the pace line; the −3 lives only in the pill                                                                                                                                | skill (4)                   |
| expression-7.61 | n25 F4     | 1    | P3  | skill     | A red delta pill and an amber 'Behind pace' dot say one fact in two hues                                                                                                                                      | skill (7)                   |
| expression-7.62 | n25 F7     | 1    | P3  | primitive | The 'Finished' direct label stays blue while its line dims (`r0/scenarios-expr-n25--focus--light--1800x1200.png`); the builder: 'the kit owns that label'                                                     | kit (4)                     |
| expression-7.63 | n25 F8     | 1    | P3  | skill     | The chart card has no context line while its neighbour has one                                                                                                                                                | skill (2)                   |
| expression-7.64 | n25 K1     | 1    | P3  | skill     | At zero the finished line lies on the baseline rule and reads as absent; round 1 marked it with a dot                                                                                                         | skill (6)                   |
| expression-7.65 | n25 K2     | 1    | P3  | skill     | Loading 36 px short because the footer row was not passed in loading (the shipped rule asks for it; round 1 passed it); a bare dash in empty and error                                                        | skill (10)                  |
| expression-7.66 | n25 K5     | 2    | P2  | skill     | `phone: 'scroll'` (`ExprN25.tsx:79`) pushes the State column off screen at 390, so 'which stalled' needs a swipe                                                                                              | skill (5)                   |
| expression-7.67 | n25 X1     | 1    | P3  | skill     | 'Behind pace' beside '−3 vs pace'; 'Stalled' in the subtitle count and the column                                                                                                                             | skill (11)                  |
| expression-7.68 | n25 X2     | 1    | P3  | skill     | Two separate cards in the top half of a 1200 px page; a wide, tall chart for one 52-point line                                                                                                                | skill (11)                  |
| expression-7.69 | n25 X4     | 1    | P3  | primitive | No sweep; on focus the line greys while its label stays blue (as .62)                                                                                                                                         | kit (4)                     |
| expression-7.70 | n25 X5     | 1    | P3  | primitive | '21 Oct' in the footer is set in the sans face; a footer value has no mono flag (builder, rounds 1 and 2)                                                                                                     | contract (b)                |
| expression-7.71 | n26 F1     | 1    | P3  | skill     | A four-line time series; the hops are not drawn in path order, so 'where' is read from the headline (`ExprN26.tsx:165-206`); a stacked-lane attempt in round 1 overlapped inside one card                     | skill (8)                   |
| expression-7.72 | n26 F2     | 1    | P3  | skill     | Loss is answered; the delay half (the gateway's evening rise, the far server's step) is only geometry                                                                                                         | skill (4)                   |
| expression-7.73 | n26 F3     | 2    | P2  | skill     | '10 min lost' and 'Longest gap 6 min' stand against nothing; round 1 added '+8 min vs previous day'                                                                                                           | skill (3)                   |
| expression-7.74 | n26 F4     | 1    | P3  | skill     | The accent is fixed to the gateway, so in `?fixture=home` the culprit router is grey; resolver and far greys near-identical                                                                                   | skill (7)                   |
| expression-7.75 | n26 F5     | 1    | P3  | skill     | The router at 1.1 ms lies on the zero rule; partial loss and the 1,840 ms reply appear only in the table                                                                                                      | skill (6)                   |
| expression-7.76 | n26 F6     | 1    | P3  | primitive | In `?fixture=home` the 'Router 5 min' zone label is struck through by the spike; in round 1 'Gateway 6 min' vanished under the far-server line                                                                | kit (3)                     |
| expression-7.77 | n26 F7     | 1    | P3  | skill     | A tooltip and the headline readout both show; the whole chart greys rather than the rest                                                                                                                      | skill (9), kit (4)          |
| expression-7.78 | n26 F8     | 1    | P3  | skill     | The per-hop table sits in a second card with no swatches; the strip carries none                                                                                                                              | skill (2)                   |
| expression-7.79 | n26 K1     | 1    | P3  | skill     | The 420 ms congestion rescales the axis and crushes the other hops into one band; round 1 capped the domain with the kit's caret                                                                              | skill (6)                   |
| expression-7.80 | n26 K2     | 1    | P3  | primitive | Loading 36 px short, a stray dash in empty and error, the table error 'Could not load this.'                                                                                                                  | kit (1), kit (5)            |
| expression-7.81 | n26 K5     | 1    | P3  | skill     | The table scrolls sideways at 390 (`phone: 'scroll'`, `ExprN26.tsx:143`), the plot is about 85 px tall, the headline truncates                                                                                | skill (5)                   |
| expression-7.82 | n26 X1     | 1    | P3  | skill     | The period stated twice, the loss three times (zone labels, status, footer)                                                                                                                                   | skill (11)                  |
| expression-7.83 | n26 X2     | 1    | P3  | skill     | Two full-width cards; the table with blank space under four rows; 300 px empty below at 1800                                                                                                                  | skill (11)                  |
| expression-7.84 | n26 X3     | 3    | P2  | primitive | The table's rows are the chart's four series and share no focus (LIST NOT LINKED in every round); `DataTable focus` maps a row to one item by id, and the items are minutes                                   | contract (a)                |
| expression-7.85 | n26 X4     | 1    | P3  | rubric    | Scored 2 with no defect named: 'no flash', 'the dimmed lines stay readable', only that the counters read 0 because the dim is by colour                                                                       | rubric (1)                  |
| expression-7.86 | n26 X5     | 1    | P3  | skill     | No delta pill on the figure; the table card is a flush header over a table                                                                                                                                    | skill (2)                   |

Three kit gaps are old. A bare dash in an empty or failed figure and a table error that does not name its table were cycle 4's `planned` notes on `v3-dogfood-2-state` (expression-4.7, .19); they recur here (.9, .22, .80) and are kit (1) and (5) now. Cycle 6's kit fix (3) closed the rule-label case it was filed for, but not zone and band labels, nor n21 at 390 (kit (3)).

## Filing

| Row                     | Class                                               | Covers                                                                                       | Checkpoint | Gate                                                            |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `v3-expr-7-kit-fixes`   | primitive (P3s only; no export, no contract change) | .9, .17, .18, .19, .22, .28, .38, .52, .53, .54, .62, .69, .76, .80, and the kit part of .77 | none       | none                                                            |
| `v3-expr-7-contract`    | primitive (P2s .48 and .84)                         | .48, .58, .70, .84                                                                           | spec       | none: additive, ships in a minor unless the Spec says otherwise |
| `v3-expr-7-skill`       | skill (all 10 skill P2s; their P3s ride along)      | every `skill` finding                                                                        | none       | none: skill ships in a minor                                    |
| `v3-expr-7-rubric`      | rubric (P2s .14 and .43)                            | .11, .14, .25, .43, .85                                                                      | none       | none                                                            |
| `v3-cycle-expression-8` | next cycle                                          | n27, n28, n29, n30, n31, n32                                                                 | none       | none                                                            |
| note                    | planned                                             | .13 on `v3-dogfood-3-visual`                                                                 |            |                                                                 |
| not filed               | primitive, one case                                 | .57 (a 390 tooltip that names one bar while the live region keeps another, n24 only)         |            |                                                                 |

There is no P1, so no row of its own. The P2s group one row per class. The `primitive` P2s both need a contract field (a list row that stands for a series, a bar form that keeps every name), so they share the Spec row with the mono flag, `checkpoint: spec` and seat opus high, as the cycle brief requires; the kit row holds the six behaviours that need none, and its brief tells its lead to split one off behind a Spec if it turns out to need a field. The rubric row changes three sentences of `rubric.md` and the shipped reviewer; it rests on shots where two reviewers scored one build state two ways (EXPRESSION.md § Guards).

One-case wishes, each a recipe at most: a rating column (n11), a number column that takes `null` (n26), a `BarList` whose secondary text takes a tone (n23), lanes of charts inside one card (n26), a kind that draws idle time (n25). The kit row's out-of-scope line names them.

**The gate.** No `primitive` or `doctrine` P1 is open, so the freeze is left alone (EXPRESSION.md § Gate). `v3-freeze-g4` is done.

**The bank.** Before this cycle the never-run cases were n11 and n22 to n27; this cycle ran six, so n27 alone is left. As lead note (f) asked, it adds six cases from pages no case covers, none with a reference:

- n28, from argo's spending page: where the money goes, and which category moved most last month;
- n29, from argo's tax page: how much of the year is tagged for tax, and which merchants hold untagged bookings;
- n30, from linewatch's throughput: when the line is busiest, and how close it comes to the contracted rate;
- n31, from the factory console's Shipped tab: what shipped each day, and what is in production;
- n32, from the console's Chain: which open Issues wait on others, and which one unblocks the most;
- n33, from the console's Hygiene tab: which probes fail, and which findings are oldest.

Cycle 8 draws n27 to n32; n33 stays for cycle 9, and the cycle 8 brief asks for at least five more.

Factory friction: one signal, filed on software-factory and merged into `issue_1793` by triage. A builder's compound shell command that ended in `bun test` was wrapped whole into a host test slot, so its build and shoot steps waited behind the slot (n25's round 0 took about 19 minutes, 11 ahead). The `make check-fast` unit step waited in the same queue.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`, unchanged since 2026-11-12):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` findings are 72 of the 102 points lost in round 0, 71 %, with no `planned` point a skill row owns. That meets the first half of the confirm column (half or more).

Repair rounds lifted the median from 69.5 to 79, by 9.5 points on all items. On the F and K items they lifted it from 71.5 to 81, also by 9.5. Both lifts are under the 15 that confirms and over the 5 that kills, so the hypothesis stays open on the lift, as in cycles 2 to 6. Two of six cases passed by round 2, against five in cycles 5 and 6.

What capped the lift is the kit again, and one builder's own workaround. n26 ended with X3 at 0 in every round because no row can stand for a series; n23 left the dim, the strip error and the skeleton as the kit's; n24's label above the tallest bar never placed, and its domain stretch cost it three points.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in any round, against the three that would confirm.
- The round-0 median glue was 25 lines and the last-round median 47.5, both under 80.

Where glue grew it is label-fit and ticks again (census V3): n22 and n24 placed end and total labels by hand, n24 shortened names and stretched a domain to fit labels, and n22 moved a threshold to fit the ticks. Kit (3) and (6) take the shareable part.

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for forms in three cases:

- horizontal stacked bars (n24; cycle 6's c16 wished for horizontal bars): two cases, so the Spec row weighs it, as a prop of `Bars` or a stacking `BarList`, and says whether it is a form under the Rule of Three;
- lanes of charts in one card (n26 only);
- idle time as a mark (n25 only).

## Convergence

Not converged:

- The round-0 median is 69.5, under 80; on the F and K items it is 71.5.
- The minimum is 63, over 60; on the F and K items it is 67, over 60.
- No referenced case ran, so the clause of three of four cannot be met.
- There is no P1, and there are 14 P2s against a limit of three.

`v3-cycle-expression-8` is filed after the four fix rows.

owner:
