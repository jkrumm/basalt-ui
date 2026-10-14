# Table 10k-row baseline — 1.41.0

Lane `table-perf` (`scripts/evidence/table-perf.ts`) against the playground `/table-perf` route built from
tag `v1.41.0`: `BasaltDataTable` over 10 000 seeded rows (8 columns: number, string, ISO date), sorting and
global search on, pagination off — all 10 000 rows are in the DOM inside the table's `maxHeight` (600 px)
scroll container; 1.41 has no table virtualisation. The route and page are the lane's own fixture, copied
unchanged into the 1.41 tree apart from the import (`basalt-ui/data/table` there, `basalt-ui/table` now).

Reproduce: `make evidence LABEL=<label> LANES=table-perf [DIST=<dir> ROUTES=<file with /table-perf>]`.

| Metric                            | Value  | Unit        |
| --------------------------------- | ------ | ----------- |
| rows                              | 10000  |             |
| idle frame p50 (control)          | 66.7   | ms          |
| first render (10k rows)           | 1481.5 | ms          |
| sort Name p50                     | 2253   | ms          |
| sort Name p50 over control        | 2186.3 | ms          |
| sort MRR p50                      | 2082   | ms          |
| sort MRR p50 over control         | 2015.3 | ms          |
| search keystroke p50              | 42     | ms          |
| search keystroke p50 over control | -24.7  | ms          |
| search misses                     | 0      | /5 steps    |
| scroll frame p50                  | 66.7   | ms          |
| scroll frame p95                  | 133.3  | ms          |
| scroll long tasks                 | 0      | /120 frames |
| runs (N)                          | 5      |             |

## Reading it

- **Control.** The idle rAF frame is ~66 ms in this headless Chrome, so every latency is quantised to it.
  Compare versions by the `over control` rows measured in the same run, never by absolute values.
- **sort** is click → the rAF in which the first body row changes, median over 6 clicks per column
  (two asc/desc/off cycles) per run. It is a full 10 000-row re-render, hence seconds.
- **search** is keystroke → the rAF in which the row count changes (`acct-0` typed as setup, then `4 2 1 7`
  and the clear). It measures the DOM commit reaching the next rAF, not paint, so it can read below the
  control: a negative delta means a sub-frame commit, not a faster-than-zero latency.
- **scroll** drives the scroll container top to bottom in 120 rAF steps; frame p50/p95 are the rAF deltas
  in that window. Both sit on the 66.7 / 133.3 ms quantisation of the control, i.e. 1 and 2 frames.
- **Noise.** The same lane on the current tree's (unchanged 1.x) table reads within ~3 % of this on
  first render and sort (1 530 vs 1 481 ms first render, 2 313 vs 2 253 ms Name sort).
- Unthrottled only (a 10k-row mount at 4x CPU slowdown is a minutes-long load); N = 5 fresh contexts.
