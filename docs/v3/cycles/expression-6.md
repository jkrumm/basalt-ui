# Expression cycle 6

Six one-shot trials on master after the cycle 5 fix rows landed: one referenced case, c16, from TuffUI's Model Picker, and five native cases. They are scored against `docs/v3/expression/rubric.md`. Protocol: `docs/v3/EXPRESSION.md`.

One case passed in round 0: n15 at 80. The round-0 median is 71 and the minimum 67. On the F and K items alone, the trend measure against cycles 1 and 2, the median is 75 and the minimum 62. There is no P1 for the first time since cycle 4, and there are 12 P2s, so the area has not converged. c16 ended `build` in round 0 against its reference, but one referenced case cannot meet the clause of three of four.

The P2s split eight `skill` and four `primitive`. The skill ones are the same three habits as every cycle: one fact stated four or five times, a page split into stacked surfaces, and a hero that measures something other than its marks. The primitive ones are new kit edges. A pointer that crosses a chart on its way to a linked table row leaves no focus. A Heatmap with states draws a gradient legend no cell uses. A capped point gets none of the off-scale caret the contract promises. A rule label with no free spot vanishes.

Repair rounds passed three more cases in round 1: n08 at 80, n20 at 81 and n21 at 88. c16 passed in round 2 at 81, `build` again. Only n19 did not pass: it ended at 74, held back by zone labels that land on the neighbouring stretch, an announcement read twice and a spike flattened by its cap. The last-round median is 80.5, and 82 on the F and K items.

What is left is mostly `skill`, 63 of 91 points. The kit cost 28. None of it needs a new export; two small contract fields (optional props that accept `undefined`, a monospace slot) go to a Spec row.

## Pin

|            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master sha | `349bc69f88a8af07fc08a7ab9c69c7dbfde0168b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Date       | 2026-11-16                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Cases      | c16 (referenced), n08, n15, n19, n20 and n21 (native)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Builders   | One fresh subagent per case on the default worker tier (Sonnet), run in parallel. Each was fenced to `packages/basalt-ui/agent/**`, `llms.txt`, the published types and docs, and the playground's own code, minus every other `scenarios/expr/` directory. Each built and shot its own route. The prompt is cycle 5's with the paths bumped, the retired `check-theme` line gone, and one line on the 61 px band. It does not mention the keyboard frame, so its use could be counted unasked                                                             |
| Reviewers  | A fresh subagent per case and round (Sonnet), never the builder, never the same reviewer twice, scoring a snapshot of that round's source                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Scenarios  | `apps/playground/src/scenarios/expr/<case>/`, route `/scenarios/expr-<case>`, as the builder left them after its last round                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Shots      | `.evidence/v3-shots/expression-6/r<round>/scenarios-expr-<case>*.png` in the main checkout on the dev host (gitignored), with the rest state, `?shot-state=loading\|empty\|error`, each builder's `?fixture=` names, a keyboard frame `--focus--`, a list frame `--list--` where a list exists and a pointer-sweep frame `--sweep-gap--`, each light and dark at 1800x1200 and 390x844, and `r<round>/shoot-log.txt`. Source snapshots in `src-r<round>/`, builder reports in `builder-reports/`, reviews in `reports/`, the lead's log in `lead-state.md` |

### Before round 0

- **TuffUI.** One commit since `589cbb0`: `f31ea2b` on 2026-11-16 (`gh api repos/yurigdesigner/tuffui/commits?since=2026-11-13`), adding Model Picker and Voice Session, both in TuffUI's "conversation" category.
  - Model Picker compares models on speed (linear), price and context (log) as five-segment bars, recommends one for the task, and prices the open chat on each. That is a visualization of a dataset, so it became c16, and it ran in place of n11, the native case with the closest form (per-item bars in a list). n11 stays never-run for cycle 7. Its reference shot (`.claude/shots/tuffui-ref/model-picker-{dark,light,phone}.png`) was taken with reduced motion, which leaves the panel open (lead tool `ref-shot.ts`).
  - Voice Session is a call control whose bars draw a live audio level, not a dataset. It has no case, as Tone Rewrite had none in cycle 3.
- **(a) The keyboard frame and the lint rule.** `v3-expr-5-keys` landed: `basalt-ui shot --states keys` shoots the frame and names a page error (`24a91dfa`), the app preset sets `no-use-before-define` (`oxlint-app.json:613`, `b058c9cc`), and step 6 of both skills names the command (`3cdbd50a`). The builder prompt did not mention it. **No builder shot a keyboard frame unasked: 0 of 6**, as in cycle 5 (cycle 4: 2 of 6 wrote their own). No page crashed on a key this cycle; every `KEY` line in every round reads an announcement.
- **(b) The kit fixes.** `v3-expr-5-kit-fixes` (1) and (2) landed as the last two commits before the pin: placed labels clear captions, lines and bars (`349bc69f`), and lines dim and mark the focused x like bars (`2323e920`). Builders were told nothing.
- **(c) The repo's gate.** `make check-fast` ran on the round-0 tree before scoring and passed (rc 0): the static gate (fmt, lint, typecheck, budgets, literals), the unit suite in a host slot (18 chunks), the coverage, doc-drift and contract-frozen gates (20 pins), and the pack-test. The layout step picked no file, because none of the 16 changed files reaches a layout test. It was in its unit step, not queued, when round 1 started, and was left to finish.
- **(d) Reviewer notes.** The reviewer prompt named the `{ light, dark }` series pair and a `fillOpacity` number as sanctioned forms, and said K6 loses a point only to a defect a shot or a source line shows. No reviewer marked either form down this cycle.
- **(e) The page band.** Builders and reviewers were told the 61 px band under a title-only `PageBar` is the kit's (`page.tsx:146`). No point was lost to it.

### The shoot

- **The lead tool** (`.evidence/v3-shots/expression-6/lead-shots.ts`, not in git) is cycle 5's. It needed no fix in round 0.
- **A false NOT LINKED, and the kit defect under it.** In round 0 the list frame read c16's table as NOT LINKED at 1800 and linked at 390. Two lead probes on the round-0 build settled it:
  - `probe-table-link.ts`: a row hover at 1800 sets one `data-focused` and swaps the hero to the row.
  - `probe-steps.ts`: a pointer arriving on the row directly links it (1); one that comes from the page corner in four steps, crossing the chart above, leaves none (0) and keeps the chart's last tooltip text in the live region; one that comes from straight above links (1).

  The lead tool moves in steps from the corner, so it crossed the chart. The defect is the kit's: a page whose table sits under its chart loses the link on the way a pointer usually travels (expression-6.13). From round 1 the list frame retries a direct arrival and logs which approach linked, and the reviewer prompt says so. c16's round-0 reviewer read X3 from the NOT LINKED line; the finding keeps its points because the crossing loss is real.

- **Sweeps.** n19 draws lines, so its sweep pair is three SVG shapes and the gap test is weak; its reviewers scored X4 from the frames. The dim counters read 0 on scenes that dim by colour (n15, n19, n20, c16); reviewers read the frames.

### After the rounds

`make check-fast` ran on the final tree, rebased onto master after every builder was done, and passed (rc 0): the static gate, the unit suite in a host slot, the coverage, doc-drift and contract-frozen gates (20 pins), and the pack-test. The layout step picked no file, because none of the 23 changed files reaches a layout test, so CI runs the full suite. A first run before the rebase failed `check-contract-frozen` on `page/contract.ts`, a pin master had moved after the pin (`38e21b1f`), which this tree never touched; the rebase cleared it. Master had moved 19 commits past the pin; the builds, written against the pin, pass lint and typecheck on it.

## Numbers

| Number                         | c16                                             | n08                    | n15                                 | n19                           | n20                        | n21        | Summary                          |
| ------------------------------ | ----------------------------------------------- | ---------------------- | ----------------------------------- | ----------------------------- | -------------------------- | ---------- | -------------------------------- |
| First-try score (round 0)      | 70                                              | 72                     | 80                                  | 70                            | 77                         | 67         | median 71, minimum 67            |
| First-try score, F and K only  | 76                                              | 71                     | 81                                  | 74                            | 79                         | 62         | median 75, minimum 62            |
| Round 1 score (F and K)        | 77 (81)                                         | 80 (83)                | passed                              | 74 (76)                       | 81 (83)                    | 88 (88)    | median 80 (82)                   |
| Round 2 score (F and K)        | 81 (81)                                         | passed                 | passed                              | 74 (74)                       | passed                     | passed     | last-round median 80.5 (82)      |
| Rounds-to-pass (F and K)       | 2 (1)                                           | 1 (1)                  | 0 (0)                               | 3 (3)                         | 1 (1)                      | 1 (1)      | mean 1.33 (1.17)                 |
| Verdict                        | `build` (rounds 0 and 1)                        | n/a                    | n/a                                 | n/a                           | n/a                        | n/a        | 1, 0, 0 (one referenced case)    |
| Glue lines, round 0            | ~50                                             | ~15                    | ~35                                 | ~56 (40 of it spreads)        | ~45                        | ~10        | median 40 (25.5 without spreads) |
| Glue lines, last round         | ~65                                             | ~18                    | ~35                                 | ~50 (35 spreads and readouts) | ~60                        | ~45        | median 47.5                      |
| Escape hatches, round 0        | `as const satisfies`, one `!`, 2 custom columns | none (one `satisfies`) | 1 `CalendarDate` cast, 4 `as const` | 1 `as Sample`, `as const`     | 2 `as WeekRow`, `as const` | `as const` | hand `<svg>` 0 of 6              |
| Escape hatches, last round     | as round 0, plus a ring mark                    | as round 0             | as round 0                          | as round 0                    | as round 0                 | as round 0 | hand `<svg>` 0 of 6              |
| Devices used unasked (round 0) | 7                                               | 6                      | 7                                   | 8                             | 9                          | 4          | median 7 of 12                   |

A case that passed carries its passing score into later rows. The pass mark is 80 on all items, so n08's round 1 passed at 80 (83 on F and K) and n15 passed in round 0 at 80.

Glue is the builder's own count of geometry, ticks, label placement, measuring, and focus or readout lines; it excludes the fixture (n19 counted about 90 lines of fixture derivation, n21 about 80). n19 counted 40 lines of conditional spreads in round 0: `exactOptionalPropertyTypes` rejects `undefined` for an optional kit prop, so a maybe-absent `delta` or `sub` cannot be passed straight. That is glue the kit could own (`v3-expr-6-contract` (a)), so it is in the count; without it the round-0 median is 25.5, one below cycle 5's. Glue grew in the repair rounds where builders drew what the kit lacked: c16 label boxes for a rule line and a hollow ring for the focused dot; n20 a second series to colour out-of-range weeks; n21 obstacle boxes and an off-scale label for its capped outage.

No build used a lint disable, `theme-allow`, a deep import or a hand-written `<svg>`. Every `as const` is a const assertion; the casts type an array read (n19, n20) or a template date (n15).

Devices reached in round 0, out of six builds: hero number 6, dim-the-rest 6, keyboard parity 6, anatomy 4, direct labels 4, baseline delta 4, threshold geometry 4, colour budget 3, pre-annotation 3, live cue 1, metaphor 0, quantized marks 0. The median holds at 7. Keyboard parity is back to 6 of 6.

### Trend

Cycles 1 and 2 had no X items, so their scores are F and K scores. The rows of cycles 3 to 6 give both, with F and K first.

| Cycle | Sha        | First-try median    | Minimum     | Last-round median     | Rounds-to-pass, mean  | Verdicts (build, tie, reference) | P1  | P2  | Glue median, round 0 to last      | Hand `<svg>`, last round |
| ----- | ---------- | ------------------- | ----------- | --------------------- | --------------------- | -------------------------------- | --- | --- | --------------------------------- | ------------------------ |
| 1     | `062367fe` | 68                  | 64          | 78.5                  | 2.17                  | 3, 2, 0                          | 0   | 16  | 62.5 to 195                       | 1 of 6                   |
| 2     | `ac6acc90` | 66.5                | 48          | 78.5                  | 2.17                  | 3, 1, 0                          | 0   | 17  | 50 to 67.5                        | 0 of 6                   |
| 3     | `2ad50570` | 65.5 (all items 62) | 57 (all 54) | 72.5 (all items 71)   | 2.83 (all items 3)    | 4, 0, 0                          | 0   | 28  | 18.5 to 34                        | 1 of 6                   |
| 4     | `4c991fd8` | 65.5 (all items 65) | 62 (all 59) | 77.5 (all items 76.5) | 2.17 (all items 2.33) | 1, 1, 0 (two referenced)         | 0   | 16  | 37.5 to 65                        | 0 of 6                   |
| 5     | `e03eddea` | 75 (all items 72.5) | 60 (all 52) | 83 (all items 81.5)   | 1.5 (all items 1.5)   | none (no referenced case)        | 1   | 18  | 26.5 to 27.5                      | 0 of 6                   |
| 6     | `349bc69f` | 75 (all items 71)   | 62 (all 67) | 82 (all items 80.5)   | 1.17 (all items 1.33) | 1, 0, 0 (one referenced)         | 0   | 12  | 40 to 47.5 (25.5 without spreads) | 0 of 6                   |

On the F and K items the first-try median held at 75 and the minimum rose from 60 to 62; on all items the median fell 1.5 to 71 and the minimum rose 15 to 67. The P2 count is the lowest yet, and there is no P1. The round-0 spread is the narrowest of any cycle (67 to 80): no case collapsed, and only one reached the bar.

## Cases

### c16: which model suits this chat (referenced: `model-picker`)

- **Round 0, 70, `build`.** A recommendation card ("Alder Flash", "-US$0.80 vs Alder Pro, current"), a speed-against-chat-cost scatter with every model named and a dashed current-cost rule, and a ten-figure table linked to the chart. The current model was named five times, three stacked surfaces filled the page, and a US$21.42 model sat on the US$3 cap with no mark. Shots `r0/scenarios-expr-c16*`. The reviewer judged the build faster than the reference: it leads with the pick, the reason and the saving, where the reference makes the viewer find the recommended row in a ranked list.
- **Round 1, 77, `build`.** One page-level state instead of three, the current model said once with its own series, the saving on the recommended dot, the capped dot labelled with its true cost, compact table rows at 390. Still three stacked blocks.
- **Round 2, 81, passed, `build`.** The hero card folded into the chart card (the pick, its reason and the saving in the figure), the current model ringed and stated once on its rule, the table in a `DataPanel`, the list-focused dot ringed. At 390 four dots lose their names and the table scrolls sideways.

### n08: should I train today (native)

- **Round 0, 72.** A three-by-three recovery-by-load Heatmap with a verdict per cell, today's cell named in its text, and a hero verdict with "4 of 15 sessions strong". The legend printed a '0 d' to '1 d' gradient no cell used, the thresholds lived only in the legend, and dimmed cells lost their labels. Shots `r0/scenarios-expr-n08*`.
- **Round 1, 80, passed.** The gradient gone (`legend={false}` and the verdicts moved to the card's legend row), "27 % strong, under 40 %" beside the hero, the tooltip off, the card filling its width. Today's cell is still marked only by text, and the dimmed labels are still hard to read: both are the kit's.

### n15: did I walk enough this week (native)

- **Round 0, 80, passed.** Weekly minutes against a 150-minute target and weekly pace against a four-week rule, two cards on one focus, a zero week named "None", the partial week drawn lighter and called "so far" in the figure. Each move was announced twice, the target label dropped at 390, and a red shortfall sat on a week not yet over. Shots `r0/scenarios-expr-n15*`.

### n19: would Wi-Fi carry a failover (native)

- **Round 0, 70.** A verdict strip ("Would carry", +9 dB), a signal line against a −72 dBm limit with weak stretches as zones, and a round-trip card against the wired median. The round-trip card sat below the fold on a 0 to 95 ms scale that flattened both lines, the hero read "-56.083 dBm", and the error title read "Could not load wi-Fi signal." Shots `r0/scenarios-expr-n19*`.
- **Round 1, 74.** The cards side by side, the line drawn as the hourly low so dips reach the limit, a 20 ms cap with the kit's caret, every zone labelled with its length, the strip one height in every phase. The pills did not follow focus, and the announcement was still doubled.
- **Round 2, 74 (74 on F and K), not passed.** Pills that follow focus through `focus.readout`, an offline stretch drawn as a gap, zone labels with day and time, a round-trip footer with the 95 ms peak. One zone label runs across the neighbouring stretch while the longest goes unlabelled, the announcement is still read twice, and the 20 ms cap flattens the spike. The builder left the dim, the tooltip and the doubled announcement as kit-owned.

### n20: is each lift inside its productive range (native)

- **Round 0, 77.** Four small multiples of weekly tonnage stacked by set type, each with a range band, a dashed typical rule and an on-mark "1.6 t over, 3 wk". The overshoot was stated four times, the four cards announced one move as four joined readouts, and the tooltip sat on the focused bar. Shots `r0/scenarios-expr-n20*`.
- **Round 1, 81, passed.** Out-of-range weeks in the status hue, the near-minimum lift marked on its chart, "W16 so far" on the last tick, a context line per lift, the lift named in each announcement. Still one fact four times (X1 1), and four announcements per move.

### n21: does a reboot fix a drop (native)

- **Round 0, 67.** A date scatter of drops coloured by what was done, a dashed left-alone median, and a hero "4 min median down after a reboot". The hero measured minutes after the reboot while the dots measured the whole drop, the rule's label vanished on the full fixture, a 19-hour outage sat on the 45-minute cap with no mark, and edge dots were cut in half. Shots `r0/scenarios-expr-n21*`.
- **Round 1, 88, passed.** One measure throughout, the held-back drops as the control with "-2 min vs held back", the 19 h outage labelled off scale, the rule label anchored at the left end where it survives, withheld actions as list rows with their reasons, the x domain padded. At 390 the rule label still drops.

## Round-0 item scores

| Item                 | c16   | n08   | n15   | n19   | n20   | n21   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| F1 Form              | 2     | 3     | 3     | 2     | 2     | 1     |
| F2 Answer at rest    | 2     | 2     | 2     | 2     | 2     | 1     |
| F3 Baseline          | 3     | 1     | 3     | 2     | 3     | 1     |
| F4 Colour budget     | 2     | 2     | 2     | 3     | 2     | 2     |
| F5 Honest marks      | 2     | 1     | 2     | 2     | 2     | 1     |
| F6 Labels            | 2     | 2     | 2     | 2     | 2     | 1     |
| F7 Focus and readout | 3     | 2     | 2     | 2     | 2     | 2     |
| F8 Anatomy           | 2     | 2     | 3     | 2     | 3     | 2     |
| K1 Scales            | 2     | 2     | 3     | 2     | 2     | 2     |
| K2 States            | 2     | 2     | 2     | 2     | 3     | 2     |
| K3 Keyboard          | 3     | 3     | 2     | 3     | 2     | 3     |
| K4 Tokens            | 2     | 3     | 3     | 3     | 3     | 3     |
| K5 Responsive        | 2     | 3     | 2     | 2     | 3     | 2     |
| K6 First paint       | 3     | 2     | 3     | 2     | 2     | 3     |
| X1 Word economy      | 1     | 2     | 2     | 2     | 1     | 2     |
| X2 One view          | 1     | 2     | 2     | 1     | 2     | 2     |
| X3 Linked parts      | 1     | n/a   | n/a   | n/a   | 3     | 3     |
| X4 Calm interaction  | 3     | 2     | 3     | 2     | 3     | 3     |
| X5 Console anatomy   | 2     | 3     | 2     | 2     | 2     | 2     |
| Sum / max            | 40/57 | 39/54 | 43/54 | 38/54 | 44/57 | 38/57 |
| F and K sum / max    | 32/42 | 30/42 | 34/42 | 31/42 | 33/42 | 26/42 |

Each reviewer cited a shot or `file:line` for every score under 3, and the findings below carry those citations. Source line numbers refer to the round-0 snapshots in `src-r0/`. No item scored 0. F2 lost a point in every build but n21, which lost two. n20 scored X3 on the shared focus across its four cards; n08, n15 and n19 have no list.

## Findings

Severity follows the rubric. A 0 on F1, F2 or any K item is P1, any other 0 or 1 is P2, a 2 is P3, and an X item counts like an F item. No item scored 0, so there is no P1.

Points lost in round 0 by class: `skill` 63 and `primitive` 28, for a total of 91. No point is `doctrine`, `rubric`, `case` or `planned`: the open plan rows (`v3-shell-1-shell`, `v3-dogfood-2-shell`, `v3-cycle-shell-2`, `v3-cycle-dogfood-3`, `v3-cycle-lint-7`) own no gap this cycle hit. By severity there are 12 P2 (8 `skill`, 4 `primitive`) and 67 P3.

Where findings are fixed:

- `kit (n)` is change (n) of `v3-expr-6-kit-fixes`.
- `contract (x)` is change (x) of `v3-expr-6-contract`.
- `skill (n)` is change (n) of `v3-expr-6-skill`.
- `none` names a gap one case asks for: a recipe at most, under EXPRESSION.md's two-case rule.

| Id              | Case, item | Lost | Sev | Class     | Evidence                                                                                                                                                                                                                                                              | Fix            |
| --------------- | ---------- | ---- | --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| expression-6.1  | c16 F1     | 1    | P3  | skill     | Vision and context decide whether a model takes the chat, but sit on no mark: the viewer reads the table to learn why a dot is grey (`ExprC16.tsx:137-283`)                                                                                                           | skill (1)      |
| expression-6.2  | c16 F2     | 1    | P3  | skill     | Two heroes compete: the recommendation card and the chart's current-model cost; the recommended dot carries only its name (`ExprC16.tsx:254`)                                                                                                                         | skill (1)      |
| expression-6.3  | c16 F4     | 1    | P3  | skill     | "Current" is blue in the table and ink in the chart; "No vision" amber in the table and grey in the chart (`ExprC16.tsx:51-52` against `series.ts:139-142`)                                                                                                           | skill (8)      |
| expression-6.4  | c16 F5     | 1    | P3  | primitive | In `extreme` the US$21.42 model sits on the US$3 cap with no caret (`r0/…c16-fixture-extreme--light--1800x1200`), though `contract.ts:169` promises one for a capped datum; n19's capped line got it                                                                  | kit (4)        |
| expression-6.5  | c16 F6     | 1    | P3  | skill     | At 390 in `free` the recommended Open VL loses its label to lesser dots (`r0/…c16-fixture-free--light--390x844`); the builder labelled every dot instead of the few that matter                                                                                       | skill (2)      |
| expression-6.6  | c16 F8     | 1    | P3  | skill     | The chart footer states chat tokens the chart does not encode; the legend swatches differ from the table's status dots                                                                                                                                                | skill (8)      |
| expression-6.7  | c16 K1     | 1    | P3  | primitive | In `extreme` the current-cost rule is dropped (`ExprC16.tsx:214`) because the model is past the cap and no caret marks it                                                                                                                                             | kit (4)        |
| expression-6.8  | c16 K2     | 1    | P3  | skill     | The empty sentence appears three times and truncates at 390; error has three Retry buttons and a stat card reading 'Could not load this.'                                                                                                                             | skill (5)      |
| expression-6.9  | c16 K4     | 1    | P3  | skill     | The price column mixes `$0.10 / $0.40` from `createFormat()` (`ExprC16.tsx:44`, `:61`) with 'US$' elsewhere, left-aligned                                                                                                                                             | skill (6)      |
| expression-6.10 | c16 K5     | 1    | P3  | skill     | At 390 the table projects to eight 190 px cards (`r0/…c16--list--light--390x844`); `phone: 'scroll'`, which the builder found in round 1, keeps compact rows                                                                                                          | skill (3)      |
| expression-6.11 | c16 X1     | 2    | P2  | skill     | The current model is named five times: chart hero, delta label, dot label, rule label, table status; the empty sentence three times                                                                                                                                   | skill (2)      |
| expression-6.12 | c16 X2     | 2    | P2  | skill     | Three stacked surfaces; the chart card is about 490 px tall for eight dots with its top half empty; detail sits under the chart                                                                                                                                       | skill (3)      |
| expression-6.13 | c16 X3     | 2    | P2  | primitive | Table to chart read NOT LINKED at 1800 (`r0/shoot-log.txt` LIST). Lead probe `probe-steps.ts`: a pointer arriving on a row directly links it (1 `data-focused`, hero 'US$0.04 Cobalt S'); one that crosses the chart on the way leaves none (0), on the round-0 build | kit (1)        |
| expression-6.14 | c16 X5     | 1    | P3  | skill     | The chart figure has no delta pill: the builder believed a delta cannot follow focus, but `focus.readout` is generic (`contract.ts:134`); model ids not monospace (no slot: `v3-expr-6-contract`)                                                                     | skill (9)      |
| expression-6.15 | n08 F2     | 1    | P3  | primitive | Today's cell is marked only by its 'Today:' text; `Heatmap` has no marked-cell option (builder report)                                                                                                                                                                | none: n08 only |
| expression-6.16 | n08 F3     | 2    | P2  | skill     | '4 of 15 sessions strong' is never set against the 40 % and 70 % thresholds, which sit only in the legend (`ExprN08.tsx:46,54,57,89`)                                                                                                                                 | skill (4)      |
| expression-6.17 | n08 F4     | 1    | P3  | skill     | Four saturated fills cover all nine cells, with no neutral default (`r0/…n08--light--1800x1200`)                                                                                                                                                                      | skill (8)      |
| expression-6.18 | n08 F5     | 2    | P2  | primitive | With `states` the legend still prints a '0 d' to '1 d' gradient no cell uses (`r0/…n08--light--1800x1200`, `ExprN08.tsx:167,182`); a state replaces the ramp and `legend={false}` drops the state key too (builder report)                                            | kit (6)        |
| expression-6.19 | n08 F6     | 1    | P3  | primitive | Cell text about 10 px in 180x44 cells, the focus ring against the row label; `annotate` size and ring inset are the kit's                                                                                                                                             | kit (6)        |
| expression-6.20 | n08 F7     | 1    | P3  | skill     | The tooltip's 'Past days' row prints 'Train' (`ExprN08.tsx:174-177`) and repeats the hero, which already follows focus                                                                                                                                                | skill (2)      |
| expression-6.21 | n08 F8     | 1    | P3  | primitive | 130 px of empty inset: `matchHeight` clipped the Heatmap legend, so the builder set a fixed 200 px height (`ExprN08.tsx:181`, builder report)                                                                                                                         | kit (6)        |
| expression-6.22 | n08 K1     | 1    | P3  | primitive | The '0 d to 1 d' ramp stays in `zero` and `extreme` (`r0/…n08-fixture-extreme--light--1800x1200`)                                                                                                                                                                     | kit (6)        |
| expression-6.23 | n08 K2     | 1    | P3  | skill     | A stray '—' figure in empty and error (`r0/…n08-shot-state-empty--light--1800x1200`)                                                                                                                                                                                  | skill (5)      |
| expression-6.24 | n08 K6     | 1    | P3  | skill     | At 390 the loaded card is 20 px taller than loading: the loaded hero wraps                                                                                                                                                                                            | skill (5)      |
| expression-6.25 | n08 X1     | 1    | P3  | skill     | '15' three times, the verdict three times, a subtitle that adds nothing                                                                                                                                                                                               | skill (2)      |
| expression-6.26 | n08 X2     | 1    | P3  | primitive | The `max-w-2xl` cap that came with the fixed-height workaround leaves 900 px of the page empty (`ExprN08.tsx:120`)                                                                                                                                                    | kit (6)        |
| expression-6.27 | n08 X4     | 1    | P3  | primitive | Dimmed stated cells lose their labels: white on pale sage in light, dark on muted green in dark (`r0/…n08--sweep-gap--light--1800x1200`); no prop reaches the dim                                                                                                     | kit (6)        |
| expression-6.28 | n15 F2     | 1    | P3  | skill     | The current-week bar and the pace drop carry no annotation (`ExprN15.tsx:172-176`)                                                                                                                                                                                    | skill (1)      |
| expression-6.29 | n15 F4     | 1    | P3  | skill     | A red '-32 min to target' on a week not over; in `monday` '-150 min' (`ExprN15.tsx:84`)                                                                                                                                                                               | skill (1)      |
| expression-6.30 | n15 F5     | 1    | P3  | skill     | The partial bar is 0.55 opacity with no key in the card; the rest-week pace gap has no note (`ExprN15.tsx:159`)                                                                                                                                                       | skill (7)      |
| expression-6.31 | n15 F6     | 1    | P3  | primitive | At 390 the 'Target 150 min' rule label is dropped with no other spot tried (`r0/…n15--light--390x844`)                                                                                                                                                                | kit (3)        |
| expression-6.32 | n15 F7     | 1    | P3  | primitive | At 390 the tooltip covers three neighbouring bars (`r0/…n15--sweep-gap--light--390x844`)                                                                                                                                                                              | kit (5)        |
| expression-6.33 | n15 K2     | 1    | P3  | skill     | The empty header shows an up-arrow pill with dashes from a placeholder delta (`ExprN15.tsx:13-17`)                                                                                                                                                                    | skill (5)      |
| expression-6.34 | n15 K3     | 1    | P3  | primitive | Each announcement is read twice: two charts on one `useChartFocus` each render the live text (`r0/shoot-log.txt` KEY)                                                                                                                                                 | kit (2)        |
| expression-6.35 | n15 K5     | 1    | P3  | primitive | At 390 the target label is gone (the same drop as .31) and the pace ticks crowd                                                                                                                                                                                       | kit (3)        |
| expression-6.36 | n15 X1     | 1    | P3  | skill     | 'Prior 4 weeks' in both the pill and the rule label (`ExprN15.tsx:117,264`); 'Energy, of 5' answers neither question                                                                                                                                                  | skill (2)      |
| expression-6.37 | n15 X2     | 1    | P3  | skill     | Two 750 px cards for seven points each; the lower 45 % of the page empty                                                                                                                                                                                              | skill (3)      |
| expression-6.38 | n15 X5     | 1    | P3  | skill     | No context line under either card title (`ExprN15.tsx:128,212`)                                                                                                                                                                                                       | skill (3)      |
| expression-6.39 | n19 F1     | 1    | P3  | skill     | The round-trip chart's 0-95 ms scale flattens both baselines and carries no zones; a capped domain, which the kit marks with a caret, answers it (round 1)                                                                                                            | skill (3)      |
| expression-6.40 | n19 F2     | 1    | P3  | skill     | Only the longest of three weak stretches is annotated (`ExprN19.tsx:109`)                                                                                                                                                                                             | skill (1)      |
| expression-6.41 | n19 F3     | 1    | P3  | skill     | 'Too weak this week 6.3 h' stands against nothing (`ExprN19.tsx:231-251`)                                                                                                                                                                                             | skill (4)      |
| expression-6.42 | n19 F5     | 1    | P3  | skill     | An hourly mean line under 5-minute zones: a 'weak' band over a line that never nears −72 (`fixture.ts:96-112`)                                                                                                                                                        | skill (1)      |
| expression-6.43 | n19 F6     | 1    | P3  | primitive | At 390 the limit label runs through the second zone (`r0/…n19--light--390x844`); `clean` clips the verdict to 'Would ca…'                                                                                                                                             | kit (3)        |
| expression-6.44 | n19 F7     | 1    | P3  | skill     | The hero reads '-56.083 dBm' with an ASCII hyphen while tooltip and announcement read '−56' (`ExprN19.tsx:73`)                                                                                                                                                        | skill (6)      |
| expression-6.45 | n19 F8     | 1    | P3  | skill     | The strip's 'Stretches' and 'Longest' rows sit 750 px from their values; the builder's round-1 `sub` line fixed it                                                                                                                                                    | skill (5)      |
| expression-6.46 | n19 K1     | 1    | P3  | skill     | Fixed domains leave the wired baseline unreadable once a spike exists; the `down` readout is a bare dash                                                                                                                                                              | skill (3)      |
| expression-6.47 | n19 K2     | 1    | P3  | primitive | The error title reads 'Could not load wi-Fi signal.' (`couldNotLoad`, `could-not-load.ts:20-22`); the strip is 40 px shorter outside ready                                                                                                                            | kit (7)        |
| expression-6.48 | n19 K5     | 1    | P3  | skill     | `clean` clips 'Would ca…' at 390; a shorter verdict word fits (round 1)                                                                                                                                                                                               | skill (2)      |
| expression-6.49 | n19 K6     | 1    | P3  | skill     | The strip grows 40 px when data arrives: `sub` is passed in ready only                                                                                                                                                                                                | skill (5)      |
| expression-6.50 | n19 X1     | 1    | P3  | skill     | The limit stated three times (`ExprN19.tsx:95,101,227`); 'Signal clear' repeats the verdict                                                                                                                                                                           | skill (2)      |
| expression-6.51 | n19 X2     | 2    | P2  | skill     | A strip and two full-width cards stacked; the round-trip card below the fold at 1800x1200 draws a flat line across 1500 px (`r0/…n19--light--1800x1200`)                                                                                                              | skill (3)      |
| expression-6.52 | n19 X4     | 1    | P3  | primitive | The dim is a pale wash on the whole line, and the light-scheme noise floor nearly vanishes (`r0/…n19--sweep-gap--light--1800x1200`)                                                                                                                                   | kit (8)        |
| expression-6.53 | n19 X5     | 1    | P3  | primitive | Timestamps in the figure `period` and `StatCell` `sub` are proportional; no slot sets them mono (builder report)                                                                                                                                                      | contract (b)   |
| expression-6.54 | n20 F1     | 1    | P3  | skill     | The total against the range is read off a four-colour stack; the overhead press drift shows only as bar height                                                                                                                                                        | skill (1)      |
| expression-6.55 | n20 F2     | 1    | P3  | skill     | 'Near minimum' has no mark on the chart, only a status word                                                                                                                                                                                                           | skill (1)      |
| expression-6.56 | n20 F4     | 1    | P3  | skill     | Out-of-range weeks are coloured like the rest; a second series per state, which the builder used in round 1, draws them                                                                                                                                               | skill (8)      |
| expression-6.57 | n20 F5     | 1    | P3  | skill     | The partial week is named only in the page's fact line, not in the card                                                                                                                                                                                               | skill (7)      |
| expression-6.58 | n20 F6     | 1    | P3  | skill     | In `zero` at 390 '3.0 t under, 4 wk' starts over the W11 bar and loses a character; the over case anchors clear (`ExprN20.tsx:185-213`)                                                                                                                               | skill (2)      |
| expression-6.59 | n20 F7     | 1    | P3  | primitive | The tooltip covers the focused bar's top and the typical rule (`r0/…n20--sweep-gap--light--1800x1200`)                                                                                                                                                                | kit (5)        |
| expression-6.60 | n20 K1     | 1    | P3  | skill     | The same 390 collision as .58                                                                                                                                                                                                                                         | skill (2)      |
| expression-6.61 | n20 K3     | 1    | P3  | primitive | Each press announces four cards' lines joined by ' \| ', none naming its lift (`r0/shoot-log.txt` KEY, `ExprN20.tsx:79-81`)                                                                                                                                           | kit (2)        |
| expression-6.62 | n20 K6     | 1    | P3  | skill     | At 390 the loaded summary wraps to four lines over a two-line skeleton, so the cards drop 40 px                                                                                                                                                                       | skill (5)      |
| expression-6.63 | n20 X1     | 2    | P2  | skill     | Squat's overshoot four times (page sentence, status, on-chart note, fact line); band and rule labels repeat the footer                                                                                                                                                | skill (2)      |
| expression-6.64 | n20 X2     | 1    | P3  | skill     | Four 550 px cards each with its own scale read as four cards                                                                                                                                                                                                          | skill (3)      |
| expression-6.65 | n20 X5     | 1    | P3  | skill     | No context line under the lift titles                                                                                                                                                                                                                                 | skill (3)      |
| expression-6.66 | n21 F1     | 2    | P2  | skill     | A date scatter for a comparison of rebooted drops against left-alone ones; actor and span not drawn (`ExprN21.tsx:90-105`)                                                                                                                                            | skill (1)      |
| expression-6.67 | n21 F2     | 2    | P2  | skill     | The hero (minutes after a reboot, `ExprN21.tsx:44-46`) and the dots (total minutes down) measure different things; the 19 h outage unlabelled                                                                                                                         | skill (1)      |
| expression-6.68 | n21 F3     | 2    | P2  | skill     | No signed delta; the rebooted dots sit above the left-alone rule against a hero saying 4 min; the fixture's reboots follow only drops of 8 min or more (`fixture.ts:67-70`)                                                                                           | skill (1)      |
| expression-6.69 | n21 F4     | 1    | P3  | skill     | Three near-black 'Cable or port' dots outweigh the accent                                                                                                                                                                                                             | skill (8)      |
| expression-6.70 | n21 F5     | 2    | P2  | primitive | The 1140-minute outage is drawn at the 45-minute cap with no caret (`ExprN21.tsx:97`); the first and last dots are cut in half at the plot edge (`r0/…n21-fixture-quiet--light--1800x1200`)                                                                           | kit (4)        |
| expression-6.71 | n21 F6     | 2    | P2  | primitive | The 'Left alone: 7 min' rule label is dropped on the full fixture (`ExprN21.tsx:114`, `r0/…n21--light--1800x1200`) and shows only in `quiet`; anchored at the other end in round 1, it shows                                                                          | kit (3)        |
| expression-6.72 | n21 F7     | 1    | P3  | skill     | The focused fact in the tooltip, the hero and the list row at once                                                                                                                                                                                                    | skill (2)      |
| expression-6.73 | n21 F8     | 1    | P3  | skill     | No delta pill and no status on the card                                                                                                                                                                                                                               | skill (9)      |
| expression-6.74 | n21 K1     | 1    | P3  | primitive | The edge dots are clipped, as .70                                                                                                                                                                                                                                     | kit (4)        |
| expression-6.75 | n21 K2     | 1    | P3  | skill     | Empty names no next step and keeps a '— down after a reboot' stub                                                                                                                                                                                                     | skill (5)      |
| expression-6.76 | n21 K5     | 1    | P3  | primitive | At 390 the median rule has no label (the drop of .71)                                                                                                                                                                                                                 | kit (3)        |
| expression-6.77 | n21 X1     | 1    | P3  | skill     | The subtitle restates the title and axis title; two 'Held back' notes repeat one sentence                                                                                                                                                                             | skill (2)      |
| expression-6.78 | n21 X2     | 1    | P3  | skill     | Withheld actions sit in a separate section with no link to their drops                                                                                                                                                                                                | skill (3)      |
| expression-6.79 | n21 X5     | 1    | P3  | skill     | No delta pill; timestamps in the sans face, which the builder set mono itself in round 1                                                                                                                                                                              | skill (9)      |

What the classes say:

- **`skill`, 63 points.** Three habits carry most of it. Word economy (X1) cost 8 points in all six builds, for the fourth cycle running; cycle 5's worked before and after did not move it, so `v3-expr-6-skill` (2) makes it a count in step 6. One view (X2) cost 7 `skill` points in five builds: stacked full-width cards where the charts share an x and fit side by side. And n21 lost 6 points, three P2s, to a hero that measured something other than its marks. Two smaller ones recur: placeholder pills and dashes outside the ready phase (four builds), and a readout that bypasses `useFormat` (two).
- **`primitive`, 28 points.** Four P2s and eight behaviours (`v3-expr-6-kit-fixes`): the chart-to-row crossing (c16), the Heatmap legend, clip and dim (n08, 7 points), rule labels that drop (n21, n15, n19), the missing caret on capped points and the edge clip (c16, n21), the doubled announcement on a shared focus (n15, n20), a tooltip over its own mark (n15, n20), `couldNotLoad` on 'Wi-Fi' (n19) and the light dim floor (n19). Two contract fields (`v3-expr-6-contract`) close what no behaviour can: optional props that take `undefined`, and a monospace slot. n08's marked cell serves one case and is not filed.
- **Not points, but evidence.** c16 believed a delta cannot follow focus and n20 put a placeholder delta on its figure; n19's round 2 passed both its deltas through `focus.readout`, which takes any value (`contract.ts:134`). That is `v3-expr-6-skill` (9).

The six trial builds add 2,404 lines under `apps/playground/src/scenarios/expr/`.

## Filing

| Row                     | Class                                                             | Covers                                                                                                     | Checkpoint | Gate                                                            |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `v3-expr-6-kit-fixes`   | primitive (P2s .13, .18, .70, .71; no export, no contract change) | .4, .7, .13, .18, .19, .21, .22, .26, .27, .31, .32, .34, .35, .43, .47, .52, .59, .61, .70, .71, .74, .76 | none       | none                                                            |
| `v3-expr-6-contract`    | primitive (P3 .53; the glue of n19 and n20)                       | .53, and the conditional spreads of n19 and n20                                                            | spec       | none: additive, ships in a minor unless the Spec says otherwise |
| `v3-expr-6-skill`       | skill (all 8 skill P2s; their P3s ride along)                     | every `skill` finding                                                                                      | none       | none: skill ships in a minor                                    |
| `v3-cycle-expression-7` | next cycle                                                        | n11, n22, n23, n24, n25, n26                                                                               | none       | none                                                            |
| not filed               | primitive, one case                                               | .15 (a marked Heatmap cell, n08 only)                                                                      |            |                                                                 |

There is no P1, so no row of its own. The primitive P2s file as one kit row with six P3 behaviours riding along; none adds an export or a contract field, and the brief tells its lead to split one off behind a Spec if it turns out to need one. The two contract fields are a separate row with `checkpoint: spec` and seat opus high, because they amend `charts/contract.ts` and `cards/contract.ts`, as the cycle brief requires. Both are additive.

**The gate.** No `primitive` or `doctrine` P1 is open, so the freeze is left alone (EXPRESSION.md § Gate). `v3-freeze-g4` is done (issue 1227).

**The bank.** Every referenced case has now run, c16 included. The never-run native cases before this cycle were n08, n11, n15, n19, n20 and n21; c16 took n11's place, so n11 is left. As cycle 5's lead note (f) asked, this cycle adds six cases from pages no case covers:

- n22, from argo's fitness direction: is fitness improving, and which body signal says so;
- n23, from argo's Uptime Kuma monitors: what is down or slow now, and what was flaky;
- n24, from argo's gateway demand: which workflows draw the spend, and how much is production;
- n25, from argo's reading shelf: on pace for the year's goal, and which started books stalled;
- n26, from linewatch's path probes: is the delay and loss at home, at the provider or at the far end;
- n27, from the factory console's Improve page: which health measures moved the right way this week.

Cycle 7 draws n11, n22, n23, n24, n25 and n26. After it, n27 and whatever cycle 7 adds are the only never-run cases, so its brief asks for at least five (lead note (f)). c16's reference row is in `references.md`.

Factory friction: none this cycle. `factory project plan` gave the open rows that `planned` needs, and `factory plan check` passed on the appended rows.

## Hypotheses

Census verdict lines (`docs/v3/spikes/viz-census.md`, unchanged since 2026-11-12):

- V1 seam: CONFIRMED.
- V2 kinds: `bar list`, `meter`, `time-series lines`.
- V3 helpers: `scale`, `ticks`, `packing`, `measure-width`, `label-fit`.
- V4 devices: `d01-metaphor`, `d02-hero-readout`, `d08-direct-labels`, `d10-dim-focus`.

**1, method: open.** `skill` findings are 63 of the 91 points lost in round 0, 69 %, with no `planned` point. That meets the first half of the confirm column (half or more).

Repair rounds lifted the median from 71 to 80.5, by 9.5 points on all items. On the F and K items they lifted it from 75 to 82, by 7. Both lifts are under the 15 that confirms and over the 5 that kills, so the hypothesis stays open on the lift, as in cycles 2 to 5. Five of six cases passed by round 2, as in cycle 5.

What capped it is the kit again. n19, the one case that did not pass, left the dim, the tooltip and the doubled announcement as kit-owned in round 2 (`v3-expr-6-kit-fixes` (2), (5) and (8)), and its zone labels are the label-fit gap of census V3.

**2, seam: confirmed.** Census V1 is CONFIRMED, which alone meets the threshold, and V1 is not REFUTED, so the kill column is not met. The cycle's own numbers fall short of both cycle clauses:

- 0 of 6 builds hand-wrote an `<svg>` in any round, against the three that would confirm.
- The round-0 median glue was 40 lines with the conditional spreads and 25.5 without, and the last-round median 47.5, all under 80.

Where glue grew, it is label-fit again (census V3): c16 boxed a rule line and drew a focus ring, n21 boxed its obstacles and wrote an off-scale label. Both are `v3-expr-6-kit-fixes` (3) and (4).

**3, exemplars: confirmed.** Census V2 names `bar list`, `meter` and `time-series lines`, and each has a shipped symbol (`BarList`, `Meter`, `Lines`). V2 names no form without a symbol, which is the confirm column. Builders wished for three forms, each in one case, so each is a recipe at most and the Rule of Three stands:

- horizontal bars (c16, which chose a scatter instead);
- a group against its control on one axis (n21);
- a marked cell in a grid (n08).

## Convergence

Not converged:

- The round-0 median is 71, under 80; on the F and K items it is 75.
- The minimum is 67, over 60; on the F and K items it is 62, over 60.
- One referenced case ran and ended `build`, so the clause of three of four cannot be met in full.
- There is no P1, and there are 12 P2s against a limit of three.

`v3-cycle-expression-7` is filed after the three fix rows.

owner:
