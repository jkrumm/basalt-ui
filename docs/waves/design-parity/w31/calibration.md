# Wave 31 — reviewer calibration (SPEC § 8.5)

Each seed shot with `basalt-ui shot /scenarios/<seed> --dist apps/playground/dist --out .design-parity/w31/<dir>`, then scored by a fresh, blind reviewer (prompt names only the out dir). Expected items were read from the seed headers after scoring. Item numbers are the reviewer's.

## Iteration 1 (reviewer as shipped on master)

| seed                      | expected               | verdict | items cited                               | correct?                  |
| ------------------------- | ---------------------- | ------- | ----------------------------------------- | ------------------------- |
| calibrate-good            | pass                   | fail    | Craft 1 (gaps 8/12), Craft 7, Craft 8     | no — noise                |
| calibrate-delta-fill      | Craft 4 / Expression 3 | fail    | Craft 1, Craft 8                          | no — expected item missed |
| calibrate-empty-half      | Craft 3                | fail    | Craft 1, 3, 7, 8, Expression 4            | yes                       |
| calibrate-repeated-axis   | Expression 5           | fail    | Craft 1, 6, 7, 8, Expression 5            | yes                       |
| calibrate-accent-tab      | Craft 4                | fail    | Craft 1, Expression 1, 4, Communication 5 | no — expected item missed |
| calibrate-banned-subtitle | Communication 1        | fail    | Communication 1                           | yes                       |

Root causes found:

1. The reviewer's Craft list split SPEC § 8.1 item 3 in two, so every later Craft number was off by one from the SPEC (SPEC "Craft 4, no accent on chrome" was the reviewer's Craft 5).
2. Nothing told the reviewer how to read chrome from a crop: no accent-tab underline or filled delta was ever cited.
3. Craft 1 compared every gap to `scale.spacing` (11/13/18/20/26), but basalt's own components lay out on `--vx-space-*` steps (8/12/6 …). Every board failed Craft 1, the good one included. Root cause was in `shot`: `scale` read only `--mantine-*`.
4. `calibrate-good` seed defects (a seed bug, not a basalt defect): its `data-shot-tooltip` pointed at a sparkline with no tooltip (shot status `error`), its table had no focusable element (`enableSorting={false}`; focus shot `error`), and its definition lived in an `info` glyph the shot could not hover.

## Changes between iterations

- Reviewer (`packages/basalt-ui/agent/agents/basalt-design-reviewer.md`): Craft numbering aligned to SPEC § 8.1 (items 3+4 merged); Craft 4 says what to look for in crops (accent on tab underline, selected row, button, ring, solid-filled badge; accent only for the primary action and active-nav icons); Expression 3 states a delta is neutral text with a trend glyph; Craft 1 temporarily accepted the even-pixel layout grid and named type tokens (reverted in iteration 3, see below). 81 → 80 lines, budget entry updated.
- Seed `CalibrateGood.tsx`: definition moved from the `info` glyph to the card's `subtitle`; dead hover/tooltip wrapper removed; table sorting enabled so headers are focusable. No change to any bad seed.

## Iteration 2 (all six re-shot, six fresh blind reviewers)

| seed                      | expected               | verdict | items cited                               | correct? |
| ------------------------- | ---------------------- | ------- | ----------------------------------------- | -------- |
| calibrate-good            | pass                   | pass    | —                                         | yes      |
| calibrate-delta-fill      | Craft 4 / Expression 3 | fail    | Craft 1, 4, 7, Expression 3               | yes      |
| calibrate-empty-half      | Craft 3                | fail    | Craft 3, 7, Expression 4                  | yes      |
| calibrate-repeated-axis   | Expression 5           | fail    | Craft 1, 5, 6, 7, Expression 5            | yes      |
| calibrate-accent-tab      | Craft 4                | fail    | Craft 4, Expression 1, 4, Communication 5 | yes      |
| calibrate-banned-subtitle | Communication 1        | fail    | Communication 1                           | yes      |

Extra failures on bad seeds, judged against the crops/metrics: delta-fill Craft 1 (radius 6 in card 7, 1 px step) is real; delta-fill Craft 7 (focus `error`, card has nothing focusable) is a real `shot` state gap, not reviewer noise; empty-half Craft 7 (focus ring over "Oct", tooltip not declared) and Expression 4 (a lone figure) are real; repeated-axis Craft 5 (axis ticks 4.06:1) and Craft 6 (end label struck through by the line) are real basalt findings; accent-tab Expression 1/4 and Communication 5 are real (the seed is a tab strip and one sentence). No reviewer noise remained.

## Iteration 3 (lead review: fix the root cause in `shot`, revert the reviewer's grid)

Changes:

- `shot` (`src/cli/shot/capture.ts`): `scale` now also collects every `--vx-space-*`, `--vx-text-*` and `--vx-radius-*` custom property declared for the root (stylesheet scan, resolved to px through a probe), component-scoped ones included, keyed by property name (`vx-space-3`, …). On the good board that adds the 8/12/6 steps components use (`vx-space-stack-sm` 8, `vx-space-stack-md` 12, `vx-space-control-gap` 6, …).
- `shot` (`src/cli/shot/index.ts`): `commitOut` creates the out dir's parent. A focus state on an anchor with no focusable descendant records `not-declared` ("no focus target in the anchor"), not `error`. Exit 1 on any real `error` shot is unchanged. Tests added for all three.
- Reviewer: Craft 1 is back to "a step in `metrics.json` `scale`" (no grid, no named tokens). Numbering stays aligned to SPEC § 8.1; the accent/delta cues stay.
- CLI budget: `shot` entry 1395 → 1438 (+43 lines).

All six seeds re-shot and scored by six fresh, blind general-purpose agents reading the edited reviewer file.

| seed                      | expected               | verdict | items cited                               | correct? |
| ------------------------- | ---------------------- | ------- | ----------------------------------------- | -------- |
| calibrate-good            | pass                   | pass    | —                                         | yes      |
| calibrate-delta-fill      | Craft 4 / Expression 3 | fail    | Craft 1, 4, Expression 3                  | yes      |
| calibrate-empty-half      | Craft 3                | fail    | Craft 3                                   | yes      |
| calibrate-repeated-axis   | Expression 5           | fail    | Craft 5, 6, 7, Expression 5               | yes      |
| calibrate-accent-tab      | Craft 4                | fail    | Craft 4, Expression 1, 4, Communication 5 | yes      |
| calibrate-banned-subtitle | Communication 1        | fail    | Communication 1                           | yes      |

`calibrate-good` no longer fails Craft 1: every gap, inset and radius on it is now a step in `scale`, so there is no value in no token and no Wave 32 baseline failure to record from the good board. Extra failures on bad seeds, checked against the crops/metrics: delta-fill Craft 1 (radius 6 inside card 7) is real; repeated-axis Craft 5 (axis ticks 4.06:1) and Craft 6 (end label struck through by the line) are real basalt findings; repeated-axis Craft 7 (tooltip `error`: the seed marks a hover/tooltip target that opens no tooltip) is a seed annotation gap, not a reviewer error, and shot's exit 1 on it is by design; accent-tab Expression 1/4 and Communication 5 are real (a tab strip and one sentence). No reviewer noise remained.

## Iteration 4 (review round 1: coverage, scoping, visibility)

Changes:

- `shot` now writes one contact sheet per anchor (`png/<anchor-stem>__sheet.png`: every state × scheme × viewport, labelled, rendered from the crops already on disk in the open browser, 2000 px wide) and lists it as `sheet` on the anchor's `metrics.json` entries. A sheet that cannot be written is logged and left unlisted.
- `scale` collects component-scoped `--vx-space/text/radius-*` declarations from any style rule (not only `:root`), via a typed in-page function passed to `page.evaluate(fn, arg)`; the pure grouping is tested as a plain function. A failed read is `scaleError` in `metrics.json`, a `[shot] scale unavailable: <reason>` line and a banner on the board.
- Focus: the target check runs inside `attempt` (a locator failure is that anchor's `error`, never an abort); `hasFocusTarget` excludes hidden inputs, `tabindex="-1"`, disabled controls and `hidden`/`inert` subtrees (tested). Tooltip's trigger check moved inside `attempt` too. Stale `.basalt/shots/tmp-*` older than an hour are swept at start.
- Reviewer: it MUST read every anchor's sheet and every `_page` shot and print a `Read:` line per component; a component whose sheet was not read is `unverified`. `scaleError` or no `scale` makes Craft 1 `unverified`. Craft 3 says which half is measured (`emptyRatio`) and which is judged from the 390 crop. The stale "(Craft 8)" is Craft 7; a test asserts every `Craft N`/`Expression N`/`Communication N` cited in the body exists in the rubric. The skill's step 6 names the sheets.
- `CalibrateGood` (playground only): the header says why table sorting is on (a focus target) and that the board has no hover/tooltip target by design. Two real defects the sheets exposed were removed from the seed, not argued with the reviewer: the `Share` column did not say share of what (Communication 3), and putting the definition in the column header made "Support bot" wrap at 390 (Craft 3); the section title now carries it ("Top 3 projects, share of all spend, …") and the header stays `Share`.

All six seeds re-shot (with sheets) and scored by six fresh blind general-purpose agents reading the edited reviewer file. `calibrate-good` was scored three times: the first two runs failed on the two real seed defects above (the second run cited Craft 3 after my first fix widened a header); the third passes.

| seed                      | expected               | verdict        | items cited                    | read per component      | correct? |
| ------------------------- | ---------------------- | -------------- | ------------------------------ | ----------------------- | -------- |
| calibrate-good            | pass                   | pass (3rd run) | —                              | sheet ×2 + 4 page shots | yes      |
| calibrate-delta-fill      | Craft 4 / Expression 3 | fail           | Craft 1, 4, Expression 3       | sheet + 4 page shots    | yes      |
| calibrate-empty-half      | Craft 3                | fail           | Craft 3, 7, Expression 4       | sheet + 4 page shots    | yes      |
| calibrate-repeated-axis   | Expression 5           | fail           | Craft 1, 5, 6, 7, Expression 5 | sheet + 4 page shots    | yes      |
| calibrate-accent-tab      | Craft 4                | fail           | Craft 4, Expression 1, 4       | sheet + 4 page shots    | yes      |
| calibrate-banned-subtitle | Communication 1        | fail           | Communication 1, Craft 6       | sheet + 4 page shots    | yes      |

All six read the anchor's sheet and the four page shots and opened no single crop; the `Read:` lines are in each run's output. Extra failures on bad seeds, checked: delta-fill Craft 1 (radius 6 in card 7), repeated-axis Craft 1/5/6 (same radius step, 4.06:1 axis ink, end label struck through) and empty-half Craft 7 (tooltip `not-declared` although the card has an info glyph) are real basalt/seed findings. banned-subtitle Craft 6 (the focus panel at 390) was suspected to be a `shot` artefact (the focus crop ended at the anchor and cut the focus tooltip); see iteration 4b.

## Iteration 4b (lead: hover/focus crops must hold an opened tooltip)

Changes in `shot`: the hover and focus crops now include a visible `[role="tooltip"]` that opened, with the same union clip as the tooltip state. The tooltip box is read once it has settled (two equal reads; the first read of an animating tooltip was too small). Tested: the focus and hover crops hold a tooltip that grows read by read; with no tooltip the crops are unchanged. Budget: `shot` 1602 → 1613 is the settle loop; 1585 → 1602 the union itself.

Re-shot and re-scored only the affected boards, with fresh blind agents (each read the sheet and the four page shots):

| board                     | expected        | verdict | items cited                       | correct? |
| ------------------------- | --------------- | ------- | --------------------------------- | -------- |
| calibrate-banned-subtitle | Communication 1 | fail    | Communication 1, Craft 6, Craft 7 | yes      |
| S4 baseline               | —               | fail ×7 | see `s4-baseline.md`              | —        |

What the fix does and does not change:

- It works where the tooltip really lies outside the anchor: the banned-subtitle desktop focus crop now shows the whole tooltip below the card.
- The hypothesis behind it was only partly right. The Craft 6 "tooltip text cut" findings on S4 forecast, budget and the three charts at 390 are NOT crop artefacts: the `info` bubble is an in-card `role="tooltip"` span (`WidgetHeader`'s `InfoGlyph`), and its box and text really overflow the card on a narrow card (the crop after the fix is identical to the one before). They stay as real findings.
- banned-subtitle Craft 6 (mobile: the focus tooltip covers the subtitle and cuts it at the card's bottom edge; desktop: the ring on the info icon abuts "Oct") is therefore real too, not noise, and so is Craft 7 (the card has an info glyph but no `data-shot-tooltip` target, so no tooltip crop). The seed still fails with its expected item.
- Hover crops of the S4 charts now show the chart tooltip, so the reviewer notes the separate tooltip-state `error` for those anchors: the `data-shot-tooltip` target the page declares and the tooltip that opens do not match.

## Iteration 4c (review round 2: no crop changed, no re-score)

`shot` fixes only: a tooltip is taken only if it became visible after a snapshot of the visible ones (or is the one the trigger names in `aria-describedby`); `hasFocusTarget` requires a rendered element; `scaleError` is set only when `scale` stayed empty; the stale-tmp sweep is per-entry safe and pid-aware. The reviewer treats `skipped` like `not-declared` and says exactly what a sheet holds. `shot /scenarios/calibrate-good` exits 0 and its 26 PNGs are byte-identical to the last scored run, so no board was re-scored.

## Method caveat

The shipped `basalt-design-reviewer` subagent has not yet run against these seeds. Its definition loads at session start and is not reloaded, so iteration 1 used the subagent with the old text, and iterations 2–4 used fresh general-purpose agents told to read the edited reviewer file and follow its body, tools limited to Read/Grep/Glob. The lead spawns a fresh-session confirmation with the real subagent type after merge. `/.claude/agents/basalt-design-reviewer.md` and `/.claude/skills/basalt-design/SKILL.md` are byte-identical to the package sources (`make sync-self`, then `cmp`).

## Baseline

`s4-metrics.json` stays committed: it is the S4 baseline that later waves diff against.

## Final result

5 of 5 bad seeds fail with their expected item; `calibrate-good` passes. Iterations used: 4 (plus 4b, a `shot` crop fix re-scoring two boards; the second ran through the stale subagent definition and does not count as a test of the edits; the reviewer-prompt budget of three counted iterations 1, 3 and 4 against genuinely different causes: reviewer numbering/cues, `shot`'s scale, coverage).
