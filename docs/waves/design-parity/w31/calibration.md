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
3. Craft 1 compared every gap to `scale.spacing` (11/13/18/20/26), but basalt's own components lay out on 8/12/6 gaps. SPEC § 5 calls 12 "already on the grid". Every board therefore failed Craft 1, the good one included. The `scale` that `shot` records does not describe the gaps the components emit; that is a flexibility gap (see s4-baseline.md).
4. `calibrate-good` seed defects (a seed bug, not a basalt defect): its `data-shot-tooltip` pointed at a sparkline with no tooltip (shot status `error`), its table had no focusable element (`enableSorting={false}`; focus shot `error`), and its definition lived in an `info` glyph the shot could not hover.

## Changes between iterations

- Reviewer (`packages/basalt-ui/agent/agents/basalt-design-reviewer.md`): Craft numbering aligned to SPEC § 8.1 (items 3+4 merged); Craft 4 says what to look for in crops (accent on tab underline, selected row, button, ring, solid-filled badge; accent only for the primary action and active-nav icons); Expression 3 states a delta is neutral text with a trend glyph; Craft 1 accepts the even-pixel layout grid (SPEC § 5) next to `scale`, and the named type tokens (10/11/22–24/26) next to `scale.fontSizes`. 81 → 80 lines, budget entry updated.
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

## Method caveat

Iteration 1 used the `basalt-design-reviewer` subagent. The agent definition is loaded at session start and is not reloaded, so the six iteration-2 `basalt-design-reviewer` runs still quoted the old prompt and reproduced the iteration-1 misses (accent-tab and the good board). Iteration 2 was therefore scored by six fresh general-purpose agents told to read the edited reviewer file and follow its body, tools limited to Read/Grep/Glob. Confirm once with the subagent type in a new session.

## Final result

5 of 5 bad seeds fail with their expected item; `calibrate-good` passes. Iterations used: 2 of 3.
