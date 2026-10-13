# Evidence — argo-baseline-1.36

## bundle

| Metric                | Value                             | Unit   |
| --------------------- | --------------------------------- | ------ |
| pkg .                 | 183139                            | B gzip |
| pkg ./agent           | 61085                             | B gzip |
| pkg ./agent-chat      | 96763                             | B gzip |
| pkg ./charts          | 112148                            | B gzip |
| pkg ./commands        | 42674                             | B gzip |
| pkg ./content         | 122541                            | B gzip |
| pkg ./controls        | 97997                             | B gzip |
| pkg ./controls-dates  | 2130                              | B gzip |
| pkg ./data/table      | 110067                            | B gzip |
| pkg ./data/virtual    | 41681                             | B gzip |
| pkg ./format          | 2944                              | B gzip |
| pkg ./forms           | 45563                             | B gzip |
| pkg ./guard           | 20857                             | B gzip |
| pkg ./notifications   | 40611                             | B gzip |
| pkg ./router-tanstack | 11657                             | B gzip |
| pkg ./state           | 5623                              | B gzip |
| pkg ./styles.css      | 5614                              | B gzip |
| pkg ./theme-lab       | 45221                             | B gzip |
| pkg ./tokens          | 34360                             | B gzip |
| pkg ./tokens.css      | 2706                              | B gzip |
| pkg ./vite            | 28220                             | B gzip |
| app total js          | 2328705                           | B gzip |
| app total css         | 75783                             | B gzip |
| route chunks          | skipped: no vite manifest in dist |        |

## screens

| Metric      | Value                            | Unit |
| ----------- | -------------------------------- | ---- |
| routes      | 12                               |      |
| screenshots | 48                               |      |
| failed      | 0                                |      |
| viewports   | desktop 1280x800, mobile 390x844 |      |

## lighthouse

| Metric                    | Value | Unit |
| ------------------------- | ----- | ---- |
| / mobile score            | 60    |      |
| / mobile LCP              | 7184  | ms   |
| / mobile TBT              | 16    | ms   |
| / mobile CLS              | 0     |      |
| / desktop score           | 91    |      |
| / desktop LCP             | 1436  | ms   |
| / desktop TBT             | 0     | ms   |
| / desktop CLS             | 0     |      |
| runs per cell (median of) | 3     |      |

## charts-perf

lane failed: waitForFunction: Timeout 60000ms exceeded.

## chat-profile

lane failed: waitForSelector: Timeout 90000ms exceeded.

## otel

lane failed: waitFor: Timeout 30000ms exceeded.
