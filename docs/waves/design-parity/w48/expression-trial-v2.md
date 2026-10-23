# Expression trial v2 (Wave 48)

**Setup:** `bun create vite roastery --template react-ts` in a `mktemp -d` directory outside every repo (never committed),
five JSON files in `data/`, one per catalogue shape: 60 days of online orders (trend), October revenue to date against a
€60,000 target (target), revenue by four sales channels (parts), bags sold for 12 products (ranking), a 15-entry
operations log with severities (events). `bun add` a tarball packed from `master` at `7dc15621` (Wave 48's friction
fixes #523–#526, unreleased, `2.28.0` + those), then `basalt-ui init`. A fresh headless Claude Code on Sonnet
(`claude -p --model sonnet` in the scratch dir, the reviewer subagent forced onto Sonnet too) got one prompt that names
no component, skill or procedure ("one page at /overview that tells me, at a glance, how the business is doing this
month", the five questions in plain words, "make it look professional"), with `build`, `lint:basalt` and `doctor` as
gates and at most three screenshot rounds. It never saw this plan. Scored with the calibrated setup
([../w37/setup.md](../w37/setup.md)) by a fresh `basalt-design-reviewer` on Sonnet over `basalt-ui shot /overview` of the
final build (174 shots, 0 failed; `shot detect` 100, 0 findings).

## Result

| Question                    | Answer                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Found the procedure?        | Yes: invoked `/basalt-design` first, read the rules, the catalogue and the encoding router, wrote `docs/design/overview.md` (concept table: question → data shape → encoding → component → why, then pass criteria) before code |
| Shot rounds                 | 3 of 3 (r1 eyeballed, r2 reviewer 76, r3 reviewer 66 + detect 100); its last two fixes went un-shot                                                                                                                             |
| Trend (orders, 60 days)     | `Lines` in a `ChartCard`, daily line neutral, 7-day average the one accent line, facts slot with the delta and its period: catalogue "Value over time"                                                                          |
| Target (revenue vs €60k)    | `StatGroup` strip, first cell carries a `Meter` (to-date + lighter run-rate forecast segment + target tick), projection and required daily pace as cells: catalogue "Committed vs forecast"                                     |
| Parts (4 channels)          | Planned right (`Meter` `segments`, "Part of a whole, 2–6 parts"); rendered as one slab (leader un-inked, three `tone: 'muted'` parts share one fill), so after r3 it **fell back to `BarList`** (the ranking row): a fallback   |
| Ranking (12 products)       | `BarList`, top 8 + "4 other products", accent on the leader: catalogue "Ranked list, top N"                                                                                                                                     |
| Events (operations log)     | `EventList` feed, day groups, kind + severity word with a dot: catalogue "Event sequence"                                                                                                                                       |
| Fallback to a default?      | One (parts → `BarList`), caused by guidance, not by the agent skipping the catalogue                                                                                                                                            |
| `dist` look-ups             | 8 shell greps over `dist/**/*.d.ts` (v1 17, v0 72): `date()` options, legend `placement`, chart `height` keys each cost a failed `tsc`                                                                                          |
| Calibrated score (argo bar) | **31**: P1 ×5, P2 ×4, P3 ×2; owner basalt-involved 6, app-only 5. v1 scored 38                                                                                                                                                  |

The app-owned defects repeat v1's classes: state crops identical to rest because only one anchor declares states, a
fixed-height feed that clips its last row, a generic page title ("Overview"), a qualifier run into the next sentence.

## Friction (ledger rows 180–189, `docs/waves/argo-friction.md`)

| #   | Wrong turn                                                                                                     | Source to fix                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 180 | Parts `Meter`: a neutral leader plus `tone: 'muted'` parts reads as one slab; the agent fell back to `BarList` | The catalogue/recipe row for parts says nothing about telling parts apart (leader colour, per-part fills) |
| 181 | `forecastCaption` sits under the committed boundary tick; the forecast end is unmarked, the actual uncaptioned | w37 row 5 again: the caption belongs at the forecast end, the committed value at its own mark             |
| 182 | Meter captions "€56.4k" and "Target €60k" nearly touch at 390                                                  | Meter caption layout at narrow width                                                                      |
| 183 | `StatGroup` strip cell padding 12/12/0/12                                                                      | The strip cell's bottom inset                                                                             |
| 184 | `EventList` in a fixed-height section clips its last row with no cue                                           | A scroll fade or cue on a clipped feed; the recipe for a feed beside a taller column                      |
| 185 | `ChartCard` empty reads "Nothing recorded in this range": no cause, no next step                               | The default empty copy vs `states.md`                                                                     |
| 186 | `init` on stock Vite still leaves the router plugin, the chart peers and `routeTree.gen.ts` to the agent       | `init` prints the steps; it does not do them (v1 row, unchanged)                                          |
| 187 | Prop shapes by `.d.ts` grep: `date()` options, legend `placement`, chart `height` keys                         | `llms.txt` lists signatures, not the option shapes an agent reaches for first                             |
| 188 | `shot` empties its out dir each run, so the agent could not reshoot while the reviewer read the last round     | `/basalt-design`'s loop: a fresh `--out` per round                                                        |
| 189 | The series guard rejected a neutral grey twice (chroma floor, ΔE vs the trend blue) before `other` passed      | The series dictionary guidance for a neutral comparison series                                            |
