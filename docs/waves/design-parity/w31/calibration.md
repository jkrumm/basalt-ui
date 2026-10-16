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

## Method caveat

The `basalt-design-reviewer` subagent definition is loaded at session start and is not reloaded. Iteration 1 used the subagent; its iteration-2 re-runs still quoted the old prompt, so iterations 2 and 3 were scored by fresh general-purpose agents told to read the edited reviewer file and follow its body, tools limited to Read/Grep/Glob. A real-subagent confirmation runs in a fresh session after merge.

## Final result

5 of 5 bad seeds fail with their expected item; `calibrate-good` passes. Iterations used: 3 (the second ran through the stale subagent definition and does not count as a test of the edits).
