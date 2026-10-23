# Expression trial v4 (Wave 50)

**Setup:** as v3 ([../w49/expression-trial-v3.md](../w49/expression-trial-v3.md)), with the datasets and the prompt
committed beside this file so every later trial runs the same task: `bun create vite roastery --template react-ts` in a
`mktemp -d` directory outside every repo, then `bun trial-data.ts data` ([trial-data.ts](trial-data.ts), seed 50: 60
days of orders ending 22 Oct, October revenue €36,330 to date against €60,000, four channels summing to exactly that,
12 products summing to October's 2,529 bags, a 15-entry log whose notes explain the low and the high day). `bun add` a
tarball packed from `master` at `435b971b` (#536–#539, unreleased, `2.28.0` + Waves 48–50), `basalt-ui init`. A fresh
headless Claude Code on Sonnet (`claude -p --model sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`) got
[trial-prompt.md](trial-prompt.md), which names no component, skill or procedure. Scored by a fresh
`basalt-design-reviewer` on Sonnet over `basalt-ui shot /overview` of the final build (48 shots, 0 failed; `shot
detect` 100, 0 findings) plus the four full-page shots, because three of the five blocks had no anchor (row 198).

The consistent data worked: the agent stated one revenue figure and did not have to flag a disagreement (v3 had to).

## Result

| Question                    | Answer                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Found the procedure?        | Yes: invoked `/basalt-design` first, read the rules, catalogue and encoding rules, wrote `docs/design/overview.md`, shot `r1`–`r3` to fresh `--out`s, one reviewer pass on r3                         |
| Trend (orders, 60 days)     | `Lines` in a `ChartCard`, faint daily line, 7-day average, a facts line with the 7-day delta                                                                                                          |
| Target (revenue vs €60k)    | Cumulative `Lines` with a dashed projection to 31 Oct and the target line; the summary states the daily pace needed                                                                                   |
| Parts (4 channels)          | One segmented `Meter`, each part named with share and value: no fallback                                                                                                                              |
| Ranking (12 products)       | `BarList`, top 10 of 12                                                                                                                                                                               |
| Events (operations log)     | `EventList`, latest four with "Show earlier", the open warning pulled out above it                                                                                                                    |
| Fallback to a default?      | None                                                                                                                                                                                                  |
| `dist` look-ups             | 6 (v3 14, v2 8, v1 17): `EventListItem` (an anonymous inline type), `Fact`, `Tone`, `ChartFactTone`, `ColorPair`                                                                                      |
| The repeated app defects    | One figure once per surface: mostly held (the warning is stated twice); declared states: on every anchor, but on blocks with no state design; no fixed-height feed; the title names subject and scope |
| Calibrated score (argo bar) | **40** (v3 32)                                                                                                                                                                                        |

| Severity | basalt | app | total |
| -------- | ------ | --- | ----- |
| P1       | 1      | 0   | 1     |
| P2       | 4      | 4   | 8     |
| P3       | 2      | 8   | 10    |
| Total    | 7      | 12  | 19    |

v3 for the trend: P1 ×4, P2 ×7, P3 ×7 (basalt 8, app 10). The P1s fell from 4 to 1, basalt's share from 8 to 7, and the
app's defects moved down to P3 polish (a bare unit, a kind badge as heavy chrome, an axis repeating a label).

## Friction (ledger rows 198–204, `docs/waves/argo-friction.md`)

| #   | Wrong turn                                                                                      | Source to fix                     |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| 198 | `Section` drops `data-shot`/`data-shot-states` into its header props: three blocks never scored | `Section` root props (P1)         |
| 199 | `ChartCard` empty default says "Widen the range" where no range control exists                  | the chart empty default           |
| 200 | Two `ChartCard`s in one row end at different heights; a grey strip under the card               | `ChartCard` height in a grid cell |
| 201 | `PageSummary`'s date qualifier ~480 px from the sentence it dates                               | `PageSummary` aside placement     |
| 202 | Facts tone colours the whole line; the delta has no glyph                                       | `ChartCard` facts                 |
| 203 | `EventList` "Show earlier" reads as body text                                                   | the earlier control               |
| 204 | A chart focus tooltip at the first point covers the axis tick labels                            | chart tooltip placement           |
