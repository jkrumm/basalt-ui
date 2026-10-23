# Expression trial v5 (Wave 51)

**Setup:** v4's, unchanged ([../w50/expression-trial-v4.md](../w50/expression-trial-v4.md)): `scripts/trial-data.ts`
(seed 50) and [../w50/trial-prompt.md](../w50/trial-prompt.md) as committed, a `mktemp -d` app outside every repo, a
tarball packed from `master` at `98fdcdc8` (#542–#544, unreleased, `2.28.0` + Waves 48–51 package fixes; #545 and the
follow-ups are playground or later), `basalt-ui init`. A fresh headless Claude Code on Sonnet (`claude -p --model
sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`), ~57 min. Scored by a fresh `basalt-design-reviewer` on Sonnet over
`basalt-ui shot /overview` of the final build: 102 shots, 0 failed, every one of the five blocks anchored (v4: three had
no anchor, row 198); `shot detect` 100, 0 findings.

## Result

| Question                    | Answer                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Found the procedure?        | Yes: `/basalt-design` first, a concept doc in `docs/design/overview.md`, shot rounds to fresh `--out`s (r1, r3 kept), a reviewer on each |
| Trend (orders, 60 days)     | `Lines` in a `ChartCard`, daily line and 7-day average, the 7-day delta with its glyph                                                   |
| Target (revenue vs €60k)    | Cumulative `Lines` with a 7-day-pace forecast and the target line; the summary states the daily pace needed                              |
| Parts (4 channels)          | One segmented `Meter` in a `Section`: no fallback                                                                                        |
| Ranking (12 products)       | `BarList` in a `Section`, top 10                                                                                                         |
| Events (operations log)     | `EventList` in a `Section`, nine entries, no "Show earlier"; the open warning inline, not pulled out                                     |
| Fallback to a default?      | None                                                                                                                                     |
| `dist` look-ups             | 6 (v4 6): `EventListItem`, `PageSummaryProps`, `Meter`, the README, `RefLabelPosition`, `ChartCard`                                      |
| Currency                    | `$` on euro data (the data names none; the agent assumed USD)                                                                            |
| Calibrated score (argo bar) | **52** (v4 40)                                                                                                                           |

| Severity | basalt | app | total |
| -------- | ------ | --- | ----- |
| P1       | 0      | 0   | 0     |
| P2       | 2      | 3   | 5     |
| P3       | 6      | 6   | 12    |
| Total    | 8      | 9   | 17    |

v4: P1 1 (basalt 1), P2 8 (4/4), P3 10 (2/8). The one P1 (row 198) is gone; basalt's P2s are 2 (v4 4). The app's
P2s are the currency, the open warning not pulled out of the feed, and a cut log with no count or earlier control.

## Basalt-owned findings (ledger rows 205–211)

| #   | Finding                                                                                                                  | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| 205 | `ChartCard` headline at the card's far right, ~300 px from its title, its period on a line below; a sibling card differs | P2       |
| 206 | A `Section`'s loading default is three ~70 px bars where the loaded `BarList`/`EventList`/`Meter` is 230–280 px          | P2       |
| 207 | The focus tooltip at the first point still covers the y and first x tick labels (row 204 fixed the hover case only)      | P3       |
| 208 | `Section` blocks sit flat on the page beside carded `ChartCard`s                                                         | P3       |
| 209 | `Meter` empty state a cramped micro line with a leftover stripe; `BarList`/`EventList` use the bordered empty box        | P3       |
| 210 | Error "Retry" a pale ghost chip that reads as text (the row 203 control family)                                          | P3       |
| 211 | `EventList` rows each carry a mono timestamp line with no day grouping or dividers at nine rows                          | P3       |
