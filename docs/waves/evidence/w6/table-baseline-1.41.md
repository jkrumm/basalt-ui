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
| idle frame p50 (control)          | 58.4   | ms          |
| first render (10k rows)           | 1477.8 | ms          |
| sort Name p50                     | 2139.6 | ms          |
| sort Name p50 over control        | 2081.2 | ms          |
| sort Name misses                  | 0      | /6 clicks   |
| sort MRR p50                      | 1994.3 | ms          |
| sort MRR p50 over control         | 1935.9 | ms          |
| sort MRR misses                   | 0      | /6 clicks   |
| search keystroke p50              | 78.3   | ms          |
| search keystroke p50 over control | 28.4   | ms          |
| search misses                     | 0      | /5 steps    |
| scroll frame p50                  | 83.2   | ms          |
| scroll frame p95                  | 116.7  | ms          |
| scroll long tasks                 | 0      | /120 frames |
| runs (N)                          | 5      |             |

## Reading it

- **Control.** The idle rAF frame is ~58–67 ms in this headless Chrome, so every latency is quantised to
  it. Compare versions by the `over control` rows: each is the median of the per-run (metric − that run's
  own control), not a difference of two medians.
- **sort** is click → the rAF in which `aria-sort` or the order of the first five rows changes, over 6
  clicks per column (two asc/desc/off cycles) per run. A click with no change in 10 s is a miss, counted
  in `sort <col> misses`; a column with no sample at all reads `n/a`. It is a full 10 000-row re-render,
  hence seconds.
- **search** is keystroke → the rAF in which the row count changes (`acct-0` typed as setup and asserted
  to leave all 10 000 rows, then `4 2 1 7` and the clear). It measures the DOM commit reaching the next
  rAF, not paint, so a delta can read below zero (a sub-frame commit).
- **scroll** drives the scroll container top to bottom in 120 rAF steps; frame p50/p95 are the rAF deltas
  in that window and sit on the 1- and 2-frame quantisation of the control, so they separate versions only
  on a gross regression.
- **Noise.** The same lane on the current tree's (unchanged 1.x) table: first render 1 543 vs 1 478 ms,
  Name sort 2 159 vs 2 140 ms, MRR sort 2 046 vs 1 994 ms — within ~4 %.
- Unthrottled only (a 10k-row mount at 4x CPU slowdown is a minutes-long load); N = 5 fresh contexts.
