# Wave 48 — the re-audit after the 2.28 friction fixes

Validator: the playground, every scenario (S1–S8) with its empty, loading and error toggles, built from `master` at
`7dc15621` (#523–#526 merged). Setup: `docs/waves/design-parity/w37/setup.md`, unchanged (`basalt-ui shot … --dist
apps/playground/dist --out .design-parity/w48/r1`, then `shot detect`): 1390 shots, 0 failed, `shot detect` 100 (0
findings). Two fresh `basalt-design-reviewer` subagents on Sonnet, one per half, each told to open every contact sheet.
One round (the scoring round, not an iteration). Boards stay in the gitignored `.design-parity/w48/`.

| Route       | W46 r3 | W48 r1                |
| ----------- | ------ | --------------------- |
| S1 ops      | 96     | 91 (P2 2, P3 4)       |
| S2 training | 99     | 94                    |
| S3 agents   | 99     | 93                    |
| S4 spend    | 100    | 92 (P2 2, P3 2)       |
| S5 learning | 79     | 74 (P1 2, P2 1, P3 3) |
| S6 settings | 97     | 95                    |
| S7 body     | 97     | 58 (P1 1, P2 9, P3 5) |
| S8 map      | 99     | 98 (P3 2)             |

Combined: S1 S2 S3 S6 **73**, S4 S5 S7 S8 **14** (the formula over every finding of four routes; the per-route scores
are the finer read). The drop on S7 is read depth, not a regression from #523–#526 (no component code changed): the
reviewer opened all 16 S7 sheets and found playground copy gaps plus basalt layout defects the W46 reviewers passed.

## Basalt-owned (Wave 49 candidates)

- **P1 S5 `EventList` 390 wrap**: the journal note and the "rated 3/5" chip drop to a third line (11 Oct, 25 Sep).
  W47 #519 fixed one shape of it; this one remains.
- **P1 S5 journal skeleton** ~312 px against ~2,670 px loaded.
- **P2 every error title is a bare "Could not load"** on KPI, chart, meter, strip and settings cards (S1–S7); the
  board, summary, timeline and sky map name their thing. The state template needs the noun (`stateNoun`) or refuses
  the bare title.
- **P2 S7 Meter track stops at ~48 % of the card** and the current-value tick is barely readable on a fully dark track.
- **P2 S4 the "Budget €1,500" reference label is struck through by its own dashed line.**
- **P2 S7 weight-trend focus ring** draws only partial edges at the chart's right and bottom.
- **P2/P3 chart ticks off their step** (S7 weight 77/76/74/72/70; e1RM 220 above 200/150/100).
- **P3** `BarList` name runs into its value ("Support bot€321"), a delta offset in `top-drivers`, the "PR" label over the
  sparkline, a tooltip fragment from the chart above inside a hover crop (shot harness), the table's "+N" hidden-column
  header unexplained, autofill highlight on a focused select, the strip cell's wrapped delta flush to its bottom edge,
  the slider fill in the accent.

## Playground-owned

S7 meter kickers without scope or period ("WEIGHT", "low/high" without a definition), the weight figure stated three
times on one page, INOL undefined, sparkline periods unstated, S1 "Last 7 days 1.07%" without a noun, S3 untitled
footer meters, S5 question-as-title and a summary repeating the header, S6 "Notes" twice, uneven S1 KPI heights.

## Verdict

Not converged: a fresh scorer still finds work against basalt's rubric on every route, and the expression trial
([expression-trial-v2.md](expression-trial-v2.md)) scores 31 with one guidance-caused fallback. Wave 49 is appended in
the same shape.
