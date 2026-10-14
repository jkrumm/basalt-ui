# W10 evidence — server render cost of dense charts

Measured with `renderToString` (react-dom 19.3.0, `@tanstack/charts` 1.1.0, bun 1.4.3, Apple silicon), one
warm-up render, then one timed render. Data: 1-minute samples, two lines / two bars, SSR width 640.
Gate: `packages/basalt-ui/src/charts/ssr-budget.test.tsx`.

## Before / after (ms)

| Kind             | 5k before | 5k after | 10k before | 10k after |
| ---------------- | --------- | -------- | ---------- | --------- |
| Lines            | 47        | 18       | 45         | 26        |
| Bars             | 73        | 56       | 101        | 69        |
| StackedArea      | 59        | 41       | 64         | 52        |
| DualPanel        | 10,458    | 129      | > 100,000  | 131       |
| MirroredBars     | 19,393    | 19,501   | not run    | not run   |
| BandStrip        | 69        | 34       | 80         | 99        |
| Sparkline (line) | 22        | 7        | 17         | 21        |
| Heatmap          | 30        | 12       | 27         | 28        |
| Donut            | 12        | 2        | 3          | 5         |

"Before" is `af79408e`; the cold first render is in the before column, so the small kinds improve only by
JIT warm-up (not by the change). `MirroredBars` (both panes) and `Sparkline` `mark="bar"` had the same
unkeyed `barY` and got the same `y1: 0`; the 300-row SSR output of both is byte-identical before and
after (`cmp`, with absent fractions, bar opacity, negative values, `emphasizeLast`).

## Profile

`bun --cpu-prof`, DualPanel at 2,500 rows (1,971 ms), self time:

| Self ms | Frame                                                    |
| ------- | -------------------------------------------------------- |
| 573     | `stack` (`d3-shape/src/stack.js:21`)                     |
| 546     | anonymous, `@tanstack/charts/dist/stack-internal.js:66`  |
| 286     | anonymous, `stack-internal.js:76`                        |
| 233     | anonymous, `stack-internal.js:52`                        |
| 187     | `stackOffsetDivergingZeroAware` (`stack-internal.js:74`) |

Time is quadratic in rows (500 → 124 ms, 1,000 → 293, 2,000 → 1,238).

## Cause

`barY` stacks unless it is given an explicit extent (`y1`/`y2`, `bar.js:44-55`). With no `z`/`color`
channel, `stackValues(..., "index")` gives every row its own series (`stack-internal.js:28`), so the
engine builds an N-series by N-position matrix (`stack-internal.js:25-60`, `d3Stack().keys(...)`) for
what is a single series. `Bars` was never affected: it passes `z: 'series'`. `DualPanel`'s bar pane,
`MirroredBars`' two panes and `Sparkline` bars passed neither. Audit of every other stack-prone mark in
`src/charts`: `BandStrip.tsx:257` `barY` has `y1`/`y2`; `Lines.tsx:123` `areaY` has `y1`; `StackedArea.tsx:61`
`areaY` has `z: 'series'` and a real `stack()` layout. No other site.

## Fix

1. `DualPanel.tsx`, `MirroredBars.tsx`, `Sparkline.tsx`: the `barY` gets `y1: 0`. An explicit extent skips the stack. The 300-row
   SSR output is byte-identical before and after (`cmp`), negative values and null gaps included.
2. `DualPanel.tsx`: with `fillBetween`, `differenceY` builds two child line marks and per-segment areas
   (`difference.js:136-250`), about 160 ms of scene work at 10k rows. The fill is decorative (no focus,
   `mark-decorative-internal.js:23`), so `thinFill` buckets its rows per plot pixel and keeps each
   bucket's first, last and the extremes of `from`, `to` and `to - from`, once a series has more than
   4 rows per pixel. At 10k rows the fill's shaded area differs by 0.03% (15,640.7 vs 15,635.5 px²
   positive, 13,192.6 vs 13,190.8 negative) with an identical bounding box; sub-pixel sign crossings
   merge (32 → 55 fill segments, noise-driven). Lines and bars keep every row, so the cursor, the
   tooltip and keyboard focus index the full series (`panels.test.tsx`, "a dense series"). The thinning is
   a pure function of `(rows, width)`, so the server render and the first client render agree.

Not done: thinning the lines or bars. They are not the cost any more (Lines 10k: 26 ms; DualPanel
without the fill: ~100 ms) and they are the cursor's targets.

## Gate (`ssr-budget.test.tsx`)

Per kind, medians of three warm renders: `t(10k) / t(2.5k) < 8` (linear ~4, quadratic ~16; the denominator
is floored at 5 ms) AND `t(10k)` under a cap of at least 3x the local median (ceiling 500 ms). The ratio
catches the bug class on any runner; the cap catches a constant-factor blow-up.

| Kind             | 2.5k ms | 10k ms | Cap |
| ---------------- | ------- | ------ | --- |
| Lines            | 9       | 29     | 150 |
| Bars             | 23      | 90     | 400 |
| StackedArea      | 14      | 55     | 250 |
| DualPanel        | 70      | 140    | 500 |
| MirroredBars     | 38      | 170    | 500 |
| BandStrip        | 16      | 71     | 300 |
| Heatmap          | 5       | 17     | 150 |
| Donut            | 1       | 2      | 50  |
| Sparkline (line) | 3       | 11     | 60  |
| Sparkline (bar)  | 4       | 19     | 80  |

`MirroredBars` sits at 2.9x because the ceiling is 500. The file runs in about 2.5 s locally.
