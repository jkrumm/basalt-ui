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
JIT warm-up (not by the change). `MirroredBars` is unchanged: its `barY` is in `MirroredBars.tsx`, which
this PR does not own. With the same one-line change DualPanel took (`y1: 0`) it measures 102 ms at 5k and
182 ms at 10k (tried locally, not committed). `Sparkline` `mark="bar"` has the same shape (untimed).

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
what is a single series. `Bars` was never affected: it passes `z: 'series'`. `DualPanel`'s bar pane and
`MirroredBars`' two panes pass neither.

## Fix

1. `DualPanel.tsx`: the bar pane's `barY` gets `y1: 0`. An explicit extent skips the stack. The 300-row
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

## Budgets (`ssr-budget.test.tsx`, 10k points, median of three warm renders)

| Kind             | Local median | Budget |
| ---------------- | ------------ | ------ |
| Lines            | 30           | 100    |
| Bars             | 114          | 250    |
| StackedArea      | 59           | 180    |
| DualPanel        | 148          | 250    |
| BandStrip        | 67           | 200    |
| Heatmap          | 23           | 100    |
| Donut            | 2            | 30     |
| Sparkline (line) | 12           | 40     |

`Bars` and `DualPanel` sit at the 250 ms cap, which is 2.2x and 1.7x their median, below the 3x asked for.
The whole file runs in about 2 s locally. `MirroredBars` and `Sparkline` `mark="bar"` are `test.todo`.
