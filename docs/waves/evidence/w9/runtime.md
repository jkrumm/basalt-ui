# W9 runtime check — did the lint burn-down move anything?

W9 touched runtime code in two places: the React-compiler exemption burn-down (#161: chat, table, controls,
provider, content) and `styles.css` carrying the notifications and spotlight layer bundles (#165). Measured on
`master` after #173 with `make evidence LANES=bundle,chat-profile,table-perf` (timing lanes re-run alone on a
quiet host, the first pass overlapped a merge train).

## chat-profile (vs `w8/chat-profile-sweep.md`)

| Cell                        | W8 commits | W9 commits | W8 frame p95 | W9 frame p95 |
| --------------------------- | ---------- | ---------- | ------------ | ------------ |
| @1x, throttle 0             | 235        | 235        | 116.7        | 133.3        |
| @4x, throttle 0             | 235        | 233        | 125          | 133.3        |
| @1x, throttle 100 (default) | 125        | 126        | 116.7        | 133.3        |
| @4x, throttle 100 (default) | 85         | 86         | 128.3        | 126.7        |

Commit counts are within ±2 of W8; frame p95 moves by at most one rAF quantum (16.7 ms), inside the band W8 called
noise. Stream duration @1x t=100 is 6 882 ms (W8 lane: ~6.4–6.9 s).

## table-perf, 10k rows (vs `w6/table-v9-10k.md`, master v9)

| Metric                            | W6         | W9         | Change         |
| --------------------------------- | ---------- | ---------- | -------------- |
| first render                      | 1 606.7    | 1 490.3    | −7 %           |
| sort Name p50 over control        | 1 665.6    | 1 533.1    | −8 %           |
| sort MRR p50 over control         | 1 492.2    | 1 301.9    | −13 %          |
| search keystroke p50 over control | 328.5      | 307.1      | −7 %           |
| scroll frame p50 / p95            | 66.7/116.7 | 66.7/133.3 | p95 +1 quantum |
| misses, long tasks                | 0          | 0          | —              |

The `data-table.tsx` compiler fixes (#161) did not slow the table; the gains are within run-to-run spread for a
5-run lane, so read them as "no regression", not as a win.

## bundle (vs `w2/w5.md`, the last committed bundle table)

`pkg ./styles.css` 5 889 → 6 146 B gzip (+257 B: the notifications/spotlight `@import`s, #165); the playground's
`app total css` 61 342 → 59 599 B gzip, because it no longer imports those bundles a second time. The other package
deltas since W5 (`./agent` +2.8 KB, `./table` +0.7 KB) belong to W6–W8; W8 committed no bundle table, so W9's
own share is not separable beyond `styles.css`.
