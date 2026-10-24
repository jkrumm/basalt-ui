# Expression trial v6 (Wave 52)

**Setup:** v5's, unchanged ([../w51/expression-trial-v5.md](../w51/expression-trial-v5.md)): `scripts/trial-data.ts`
(seed 50) and [../w50/trial-prompt.md](../w50/trial-prompt.md) as committed, a `mktemp -d` app outside every repo, a
tarball packed from `master` at `68d7d9ee` (#548–#550, every Wave 52 package fix; #551 is playground only), `basalt-ui
init`. A fresh headless Claude Code on Sonnet (`claude -p --model sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`), ~12
min. Scored by a fresh `basalt-design-reviewer` on Sonnet over `basalt-ui shot /overview` of the final build: 124 shots,
0 failed, every block anchored; `shot detect` 100, 0 findings.

## Result

| Question                    | Answer                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Found the procedure?        | Yes: `/basalt-design` first, a concept doc in `docs/design/overview.md`, three shot rounds with a reviewer |
| Trend (orders, 60 days)     | `Lines` in a `ChartCard`, muted daily line and a 7-day average; 30-day delta with its glyph                |
| Target (revenue vs €60k)    | Cumulative `Lines` with a dashed run-rate projection and a labelled target line; short-by in the headline  |
| Parts (4 channels)          | Segmented `Meter` in a `ChartCard`, values in the legend: no fallback                                      |
| Ranking (12 products)       | `BarList` in a `ChartCard`, all 12, the leader in accent                                                   |
| Events (operations log)     | `EventList` in a `ChartCard`, day-grouped, 7 of 15, no "Show earlier"                                      |
| Fallback to a default?      | None                                                                                                       |
| `dist` look-ups             | 9 (v5 6): `EventListItem` ×3, `DeltaBadgeProps`/`ChartCardProps`, `AxisConfig`, tokens, `ChartCard` CSS/JS |
| Currency                    | `€` (v5 `$`)                                                                                               |
| Calibrated score (argo bar) | **58** (v5 52); the scorer's strict count (one more basalt P3) reads ~56                                   |

| Severity | basalt | app | total |
| -------- | ------ | --- | ----- |
| P1       | 0      | 0   | 0     |
| P2       | 2      | 2   | 4     |
| P3       | 7      | 6   | 13    |
| Total    | 9      | 8   | 17    |

v5: P1 0, P2 5 (basalt 2, app 3), P3 12 (6/6). Counted strictly (the scorer folded one basalt P3 to keep v5's total).
Rows 205, 207 (first-point ticks clear), 209, 210 and 211 are fixed in the trial's crops; 206 and 208 were not
exercised (every block is a `ChartCard`, no `Section`).

## Basalt-owned findings (ledger rows 212–218)

| #   | Finding                                                                                                                                                                       | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 212 | A pending `ChartCard` around a `Meter`/`BarList`/`EventList` body renders the real body; only the headline becomes a skeleton                                                 | P2       |
| 213 | `EventList` at 390 ellipsises one row's message ("…Seasonal Blen…") while its neighbours wrap                                                                                 | P2       |
| 214 | `PageSummary` period chip floats at the headline's far right and orphans onto its own line at 390                                                                             | P3       |
| 215 | A wrapped `ChartCard` headline starts its second line with a lone "·" separator                                                                                               | P3       |
| 216 | Three date forms on one page: tooltip US long form ("Mon, Sep 21, 2026"), axis "21 Sept" (#546's one `Sep` form did not reach this consumer path), summary "22 Oct"           | P3       |
| 217 | Focus tooltip at the first point clears the ticks but hides the line's opening segment (row 207's residual)                                                                   | P3       |
| 218 | `EventList`: the bold category runs into the message as one sentence; a mono day band repeats for single-event days; the fourth `Meter` segment is the brightest mark in dark | P3       |
