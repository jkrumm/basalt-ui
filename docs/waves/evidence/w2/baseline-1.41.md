# Evidence — baseline-1.41

## bundle

| Metric                                 | Value   | Unit   |
| -------------------------------------- | ------- | ------ |
| pkg .                                  | 183139  | B gzip |
| pkg ./agent                            | 61085   | B gzip |
| pkg ./agent-chat                       | 96763   | B gzip |
| pkg ./charts                           | 112148  | B gzip |
| pkg ./commands                         | 42674   | B gzip |
| pkg ./content                          | 122541  | B gzip |
| pkg ./controls                         | 97997   | B gzip |
| pkg ./controls-dates                   | 2130    | B gzip |
| pkg ./data/table                       | 110067  | B gzip |
| pkg ./data/virtual                     | 41681   | B gzip |
| pkg ./format                           | 2944    | B gzip |
| pkg ./forms                            | 45563   | B gzip |
| pkg ./guard                            | 20857   | B gzip |
| pkg ./notifications                    | 40611   | B gzip |
| pkg ./router-tanstack                  | 11657   | B gzip |
| pkg ./state                            | 5623    | B gzip |
| pkg ./styles.css                       | 5614    | B gzip |
| pkg ./theme-lab                        | 45221   | B gzip |
| pkg ./tokens                           | 34360   | B gzip |
| pkg ./tokens.css                       | 2706    | B gzip |
| pkg ./vite                             | 28220   | B gzip |
| app total js                           | 1388798 | B gzip |
| app total css                          | 55639   | B gzip |
| app initial load                       | 403324  | B gzip |
| route agent chunk                      | 27442   | B gzip |
| route agent beyond initial             | 45374   | B gzip |
| route cbbi chunk                       | 7278    | B gzip |
| route cbbi beyond initial              | 99090   | B gzip |
| route charts chunk                     | 18315   | B gzip |
| route charts beyond initial            | 81705   | B gzip |
| route commands chunk                   | 2157    | B gzip |
| route commands beyond initial          | 3447    | B gzip |
| route components chunk                 | 4463    | B gzip |
| route components beyond initial        | 29157   | B gzip |
| route content chunk                    | 10268   | B gzip |
| route content beyond initial           | 34239   | B gzip |
| route dashboard chunk                  | 85      | B gzip |
| route dashboard beyond initial         | 85      | B gzip |
| route dashboard/index chunk            | 4313    | B gzip |
| route dashboard/index beyond initial   | 93312   | B gzip |
| route dashboard/revenue chunk          | 716     | B gzip |
| route dashboard/revenue beyond initial | 28573   | B gzip |
| route data chunk                       | 11024   | B gzip |
| route data beyond initial              | 99094   | B gzip |
| route forms chunk                      | 10629   | B gzip |
| route forms beyond initial             | 14420   | B gzip |
| route notifications chunk              | 2936    | B gzip |
| route notifications beyond initial     | 2936    | B gzip |
| route settings chunk                   | 12181   | B gzip |
| route settings beyond initial          | 22222   | B gzip |

## screens

| Metric      | Value                            | Unit |
| ----------- | -------------------------------- | ---- |
| routes      | 13                               |      |
| screenshots | 52                               |      |
| failed      | 0                                |      |
| viewports   | desktop 1280x800, mobile 390x844 |      |

## lighthouse

| Metric                    | Value | Unit |
| ------------------------- | ----- | ---- |
| / mobile score            | 58    |      |
| / mobile LCP              | 6645  | ms   |
| / mobile TBT              | 227   | ms   |
| / mobile CLS              | 0     |      |
| / desktop score           | 92    |      |
| / desktop LCP             | 1451  | ms   |
| / desktop TBT             | 36    | ms   |
| / desktop CLS             | 0.001 |      |
| /charts mobile score      | 58    |      |
| /charts mobile LCP        | 6464  | ms   |
| /charts mobile TBT        | 249   | ms   |
| /charts mobile CLS        | 0.003 |      |
| /charts desktop score     | 92    |      |
| /charts desktop LCP       | 1373  | ms   |
| /charts desktop TBT       | 4     | ms   |
| /charts desktop CLS       | 0.006 |      |
| /data mobile score        | 51    |      |
| /data mobile LCP          | 6362  | ms   |
| /data mobile TBT          | 120   | ms   |
| /data mobile CLS          | 0.221 |      |
| /data desktop score       | 88    |      |
| /data desktop LCP         | 1416  | ms   |
| /data desktop TBT         | 6     | ms   |
| /data desktop CLS         | 0.113 |      |
| runs per cell (median of) | 3     |      |

## charts-perf

| Metric                       | Value | Unit        |
| ---------------------------- | ----- | ----------- |
| first-paint @1x              | 194.1 | ms          |
| idle frame p50 (control) @1x | 66.6  | ms          |
| update p50 @1x               | 133.3 | ms          |
| update p95 @1x               | 215.6 | ms          |
| update frame p95 @1x         | 117.5 | ms          |
| update long tasks @1x        | 0     | /40 updates |
| hover p50 @1x                | 67.6  | ms          |
| hover p95 @1x                | 134.8 | ms          |
| hover misses @1x             | 0     | /40 moves   |
| first-paint @4x              | 768.7 | ms          |
| idle frame p50 (control) @4x | 83.4  | ms          |
| update p50 @4x               | 128.9 | ms          |
| update p95 @4x               | 208.8 | ms          |
| update frame p95 @4x         | 116.7 | ms          |
| update long tasks @4x        | 0     | /40 updates |
| hover p50 @4x                | 69.1  | ms          |
| hover p95 @4x                | 128.4 | ms          |
| hover misses @4x             | 0     | /40 moves   |
| runs per cell (N)            | 5     |             |

## chat-profile

| Metric                        | Value  | Unit    |
| ----------------------------- | ------ | ------- |
| commits per reply @1x         | 210    | commits |
| commits per 100ms @1x         | 7.34   |         |
| idle commits (1s control) @1x | 0      | commits |
| idle frame p50 (control) @1x  | 66.6   | ms      |
| stream duration @1x           | 2856.5 | ms      |
| frame p50 @1x                 | 66.6   | ms      |
| frame p95 @1x                 | 116.7  | ms      |
| frame max @1x                 | 133.4  | ms      |
| long tasks @1x                | 2      | tasks   |
| long-task time @1x            | 122    | ms      |
| commits per reply @4x         | 190    | commits |
| commits per 100ms @4x         | 7.19   |         |
| idle commits (1s control) @4x | 0      | commits |
| idle frame p50 (control) @4x  | 83.3   | ms      |
| stream duration @4x           | 2657.1 | ms      |
| frame p50 @4x                 | 75     | ms      |
| frame p95 @4x                 | 169.2  | ms      |
| frame max @4x                 | 233.3  | ms      |
| long tasks @4x                | 6      | tasks   |
| long-task time @4x            | 895    | ms      |
| runs per cell (N)             | 5      |         |

## otel

| Metric                        | Value | Unit    |
| ----------------------------- | ----- | ------- |
| runs                          | 3     |         |
| spans.route.navigate          | 12    | per run |
| spans.render.error            | 0     | per run |
| spans.window.error            | 0     | per run |
| route.navigate.p50            | 79.2  | ms      |
| errors                        | 0     |         |
| page errors                   | 0     |         |
| routes without a visible link | 0     |         |
