# Evidence — w11-quiet

Partial run — lanes: lighthouse, charts-perf, otel.

## lighthouse

| Metric                    | Value | Unit |
| ------------------------- | ----- | ---- |
| / mobile score            | 56    |      |
| / mobile LCP              | 6943  | ms   |
| / mobile TBT              | 260   | ms   |
| / mobile CLS              | 0     |      |
| / desktop score           | 92    |      |
| / desktop LCP             | 1399  | ms   |
| / desktop TBT             | 26    | ms   |
| / desktop CLS             | 0     |      |
| /charts mobile score      | 59    |      |
| /charts mobile LCP        | 6723  | ms   |
| /charts mobile TBT        | 191   | ms   |
| /charts mobile CLS        | 0     |      |
| /charts desktop score     | 93    |      |
| /charts desktop LCP       | 1399  | ms   |
| /charts desktop TBT       | 14    | ms   |
| /charts desktop CLS       | 0     |      |
| /data mobile score        | 59    |      |
| /data mobile LCP          | 6041  | ms   |
| /data mobile TBT          | 151   | ms   |
| /data mobile CLS          | 0.104 |      |
| /data desktop score       | 90    |      |
| /data desktop LCP         | 1215  | ms   |
| /data desktop TBT         | 7     | ms   |
| /data desktop CLS         | 0.124 |      |
| runs per cell (median of) | 3     |      |

## charts-perf

| Metric                       | Value | Unit        |
| ---------------------------- | ----- | ----------- |
| first-paint @1x              | 227.7 | ms          |
| idle frame p50 (control) @1x | 99.9  | ms          |
| update p50 @1x               | 130.3 | ms          |
| update p95 @1x               | 210.5 | ms          |
| update frame p95 @1x         | 116.7 | ms          |
| update long tasks @1x        | 0     | /40 updates |
| hover p50 @1x                | 70.5  | ms          |
| hover p95 @1x                | 124.8 | ms          |
| hover misses @1x             | 0     | /40 moves   |
| first-paint @4x              | 913.4 | ms          |
| idle frame p50 (control) @4x | 66.6  | ms          |
| update p50 @4x               | 138.3 | ms          |
| update p95 @4x               | 212.5 | ms          |
| update frame p95 @4x         | 118.4 | ms          |
| update long tasks @4x        | 0     | /40 updates |
| hover p50 @4x                | 71.8  | ms          |
| hover p95 @4x                | 129.7 | ms          |
| hover misses @4x             | 0     | /40 moves   |
| runs per cell (N)            | 5     |             |

## otel

| Metric                        | Value | Unit    |
| ----------------------------- | ----- | ------- |
| runs                          | 3     |         |
| spans.route.navigate          | 10    | per run |
| spans.render.error            | 0     | per run |
| spans.window.error            | 0     | per run |
| route.navigate.p50            | 92.6  | ms      |
| errors                        | 0     |         |
| page errors                   | 0     |         |
| routes without a visible link | 6     |         |
