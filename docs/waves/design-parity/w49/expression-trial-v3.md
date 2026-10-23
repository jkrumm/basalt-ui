# Expression trial v3 (Wave 49)

**Setup:** as v2 ([../w48/expression-trial-v2.md](../w48/expression-trial-v2.md) § Setup): `bun create vite roastery
--template react-ts` in a `mktemp -d` directory outside every repo (never committed), the same five dataset shapes in
`data/` (60 days of orders, October revenue against €60,000, four sales channels, 12 products, a 15-entry operations
log), regenerated with a seeded script because v2's directory was gone. `bun add` a tarball packed from `master` at
`524b3b41` (#528–#534, unreleased, `2.28.0` + Waves 48–49), then `basalt-ui init`. A fresh headless Claude Code on
Sonnet (`claude -p --model sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` so its reviewer ran on Sonnet too) got one
prompt naming no component, skill or procedure (the five questions in plain words, "make it look professional",
`build`/`lint:basalt`/`doctor` as gates, at most three screenshot rounds). Scored by a fresh `basalt-design-reviewer` on
Sonnet over `basalt-ui shot /overview` of the final build (224 shots, 0 failed; `shot detect` 90, one P1).

**Fixture flaw (not scored):** the regenerated channels sum to €39.5k against €36.7k of daily revenue, and log notes are
drawn at random. The agent flagged both on the page instead of picking one — the right call, and a reason to keep the
datasets consistent in v4 (commit the generator next to this file's successor).

## Result

| Question                    | Answer                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init` on stock Vite        | Did everything (row 186 closed): router plugin wired, install run, `routeTree.gen.ts` built by `init` itself                                                                                                              |
| Found the procedure?        | Yes: read `/basalt-design` and the catalogue, wrote `docs/design/overview.md` first, shot each round to a fresh `--out` (`r1`–`r3`, row 188), two `basalt-design-reviewer` passes                                         |
| Trend (orders, 60 days)     | `Lines` in a `ChartCard`, daily line neutral, 7-day average the accent; answers the question                                                                                                                              |
| Target (revenue vs €60k)    | Cumulative `Lines` with a dashed target and a labelled forecast, plus a strip `Meter`: right encoding, answered twice                                                                                                     |
| Parts (4 channels)          | `Meter` `segments` with a series colour per part, legend with name, share and value: **no fallback** (v2 fell back to `BarList`; row 180)                                                                                 |
| Ranking (12 products)       | `BarList`, best first, accent on the leader                                                                                                                                                                               |
| Events (operations log)     | `EventList` grouped by day with a dot-plus-word severity                                                                                                                                                                  |
| Fallback to a default?      | None                                                                                                                                                                                                                      |
| `dist` look-ups             | 14 shell greps over `dist/**/*.d.ts` (v2 8, v1 17): `StatStripCell`, `ChartSeries`, `EventList`, `Meter`, `QueryState` error props                                                                                        |
| The four repeated defects   | One anchor declaring states: **gone** (11 anchors). Fixed-height feed: **gone**. Generic title: **gone** ("Roastery · October"). Qualifier run-on: **back in basalt's form** — the `EventList` chip after the note (#530) |
| Calibrated score (argo bar) | **32**: P1 ×4, P2 ×7, P3 ×7; basalt 8, app 10. v2 scored 31                                                                                                                                                               |

The score barely moved because the defect mix changed rather than shrank: the guidance closed the four repeated app
defects and the parts fallback, and the scorer then found the next layer: one figure stated three or four times on one
surface (€36.7k ×4, €51.7k ×3, the target answered by a meter and a chart), a bare "Could not load" on every `Section`
that wraps a `QueryState`, and skeletons far shorter than the loaded body.

## Friction (ledger rows 190–197, `docs/waves/argo-friction.md`)

| #   | Wrong turn                                                                                                    | Source to fix                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 190 | The `EventList` chip after the note reads as the note's next sentence ("…depend on it. ● Warning")            | #530's chip flow; the chip's place must not depend on whether a row has a note                            |
| 191 | `EventList` renders four font sizes (11/12/13/15), `craft-2/font-sizes` P1                                    | The `EventList` type ladder                                                                               |
| 192 | A `Section` around a `QueryState` shows a bare "Could not load"; the section title never reaches it           | `Section`/`QueryState` (the playground audit names the same on six cards)                                 |
| 193 | Skeletons far shorter than the loaded body (log 2–3 bars vs 667 px, products 3 bars vs 13 rows)               | `QueryState`'s loading default inside a `Section`; `BarList`/`EventList` skeleton row counts              |
| 194 | One figure stated three or four times on the page                                                             | `/basalt-design`: a pre-round check that each figure appears once per surface (app-owned, a guidance gap) |
| 195 | At 390 the scope line collapses into an info icon whose tooltip covers the first row; the period leaves touch | `WidgetHeader`'s narrow scope fallback                                                                    |
| 196 | A KPI sparkline with no window or range at rest                                                               | `StatCard`/strip sparkline caption                                                                        |
| 197 | 14 `.d.ts` greps (`StatStripCell`, `ChartSeries`, `QueryState` error props) despite #534's option types       | `llms.txt`: the props of the composite slot types an agent builds first                                   |
