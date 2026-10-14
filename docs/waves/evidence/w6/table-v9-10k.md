# Table v9, 10k rows — against the 1.41.0 baseline

Lane `table-perf`, same `/table-perf` fixture and method as `table-baseline-1.41.md`: N = 5 fresh
contexts, medians, `over control` = median of each run's (metric − its own idle frame). `master` @
`b53ac15`, Table 9.2.8. Unthrottled; idle frame 58.3 ms here against 58.4 ms in the baseline run.

| Metric                            |  1.41.0 (v8) |  master (v9) |           Change |
| --------------------------------- | -----------: | -----------: | ---------------: |
| first render (10k rows)           |   1 477.8 ms |   1 606.7 ms |           +8.7 % |
| sort Name p50 over control        |   2 081.2 ms |   1 665.6 ms |          −20.0 % |
| sort MRR p50 over control         |   1 935.9 ms |   1 492.2 ms |          −22.9 % |
| search keystroke p50 over control |      28.4 ms |     328.5 ms |          +300 ms |
| scroll frame p50 / p95            | 83.2 / 116.7 | 66.7 / 116.7 | flat (quantised) |
| misses, long tasks                |            0 |            0 |                — |

## Reading it

- **Sort is faster** (−20 %, −23 %); the same-code noise check on the baseline run was ~4 %.
- **First render is +8.7 %**, about twice that noise. v9 builds the table store on mount; accepted,
  nothing in the framework left to trim without dropping a feature.
- **Search +300 ms is the debounce, not the render.** The 250 ms `useDebouncedCallback`
  (`SEARCH_DEBOUNCE_MS`, V2-SPEC § 8 Pacer verdict) did not exist in 1.x, where every keystroke filtered
  10k rows synchronously. The input itself stays instant (local draft); only the filtered rows land
  250 ms after the last keystroke. Net of the debounce the commit is
  ~78 ms (328 − 250) against the baseline's 28 ms, a gap of about one idle frame (58 ms), so not separable
  here.
- **Scroll** does not discriminate (the baseline file says why); no regression.
- **Bytes:** see `store-dedupe.md`: `./table` + Router +3 429 B, playground +2 673 B, both inside the
  accepted +4 070 B, one Store copy.
