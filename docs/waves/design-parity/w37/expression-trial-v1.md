# Expression trial v1 (Wave 37)

**Setup:** `bun create vite basalt-expr-trial-v1 --template react-ts` outside the repo, three argo-shaped JSON files in
`data/` (a decision queue of 14 items with states and ages, a service health score with four named zones, contributors
and 30 days of history, an 18-day cost ledger over five projects against a €1,800 monthly cap), `bun add` a tarball
packed from `master` at `a646a081` (the batch-1 PRs #392–#400, the 2.22.0 content), then `basalt-ui init`. A fresh
Claude Code agent (`rd wave` in the scratch repo, the owner's global layer loaded) got one prompt naming no component,
skill or procedure ("one page at /operations … which decisions wait on them, how long each has waited and which are
blocked; how healthy our services are against the score bands; whether this month's cost is on track against the budget
and which projects drive it … make it look professional"), with `build`, `lint:basalt` and `doctor` as the gates. It
never saw this plan. Scored with the calibrated setup ([setup.md](setup.md)) by a fresh `basalt-design-reviewer` over
`basalt-ui shot /operations` (70 shots, 0 failed; detector B clean, score 100).

## Result

| Question                       | Answer                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Found the procedure?           | Yes: invoked `/basalt-design`, wrote `docs/design/operations.md` from the concept template first, ran five shot rounds with the reviewer subagent until it reported no failing item                                                                                   |
| `init` on a stock Vite app     | Seeded `main.tsx` and the peers (#398; v0's friction row 2 closed); the agent still added the router plugin to `vite.config.ts` because `doctor` asked                                                                                                                |
| Decision queue (states + ages) | `BasaltDataTable`, grouped by state, oldest first, the blocked reason in the row; folds to one card per row below 800 px                                                                                                                                              |
| Health score with zones        | Zoned bar `Meter` with a marker, a contributor grid of Meters with a target tick, a 30-day line                                                                                                                                                                       |
| Cost against a budget          | Committed + forecast `Meter` segments with a target tick; daily spend as bars against an allowance line; `BarList` by project                                                                                                                                         |
| Fallback to a default?         | Two: the daily ledger as a bar per day (the catalogue names a line for a value over time and lists "a bar per day" under "Not this"; the agent dropped a cumulative line because three lines overlapped); the queue's card-per-row fold at 390 (catalogue "Not this") |
| `dist` look-ups                | ~17 shell greps over `dist/**/*.d.ts` for prop shapes (`MeterZone`, `StatStripCell`, `ChartState`, `BasaltColumnDef`, `MoneyOptions`), down from 72 reads in v0; no colour hunting                                                                                    |
| Calibrated score (argo bar)    | **38**, every component fails: P1 ×2 (the two fallbacks above), P2 ×12, P3 ×6; owner basalt 7, app 13. v0 scored 97 under the Wave 36 bar                                                                                                                             |

The app-owned defects are the same classes the playground showed at r0: a figure stated two or three times (€1,030,
€1,774, 41 %, the queue counts in the subtitle), two different month-end projections on one surface, counts shown
while the rows are loading or failed, a duration wrapping at 390.

## Friction (ledger rows)

| #   | Wrong turn                                                                                          | Source to fix                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The heading face draws slashed zeros ("3Ø days", "€1,Ø3Ø") although #394 shipped a `'zero' 0` reset | Hubot Sans has no `zero` feature; its default `0` is slashed. `w37/head-digits` takes the digits from the sans face                                                                |
| 2   | The decision queue folds to a card per row at 390                                                   | `BasaltDataTable`'s responsive fold — Wave 38 (tables, responsive) owns the pin-and-scroll default                                                                                 |
| 3   | A zoned Meter leaves its narrowest zone ("Excellent", 90–100) unnamed                               | The zone `short` label exists but the agent did not find it; the catalogue's zoned-bar row should name `short`                                                                     |
| 4   | Loading draws an accent spinner where a skeleton belongs (health and cost sections)                 | The section/query loading state: a skeleton of the pattern's shape (SPEC § 6.11)                                                                                                   |
| 5   | The forecast caption sits at the committed boundary                                                 | `w37/meter-r2` (captions at their marks)                                                                                                                                           |
| 6   | Sibling section titles at two sizes                                                                 | The `Section` tier default                                                                                                                                                         |
| 7   | A bar per day for a value over time                                                                 | The catalogue row's "Not this" is right; the agent's reason (three overlapping lines) points at a missing recipe: one cumulative line with a pace reference and a forecast segment |
