# W8 — `throttle` sweep

`useAgentThreadRuns({ throttle })` at 0 / 50 / 100 / 200 ms on the `/agent` Stream tab (`?throttle=<ms>`,
read by `AgentStreamDemo`), against the 1.41 baseline ([`../w2/baseline-1.41.md`](../w2/baseline-1.41.md))
and [`chat-profile-before.md`](chat-profile-before.md). Lane `chat-profile`, `LABEL=w8-after`, base
`ed550136` (Wave 8 runtime). Medians of 5 fresh-context runs per cell; definitions unchanged from
`chat-profile-before.md`. `t=0` is the runtime default and the control for the throttled columns.

### @1x

| Metric                   | 1.41   | w8-before | t=0    | t=50   | t=100 | t=200  |
| ------------------------ | ------ | --------- | ------ | ------ | ----- | ------ |
| commits per reply        | 210    | 235       | 235    | 189    | 125   | 83     |
| commits per 100ms        | 7.34   | 3.66      | 3.68   | 2.91   | 1.87  | 1.15   |
| idle frame p50 (control) | 66.6   | 58.4      | 66.6   | 50.1   | 50    | 66.7   |
| stream duration          | 2856.5 | 6428.7    | 6379.8 | 6347.2 | 6834  | 6838.6 |
| frame p50                | 66.6   | 66.7      | 66.7   | 66.6   | 66.7  | 66.7   |
| frame p95                | 116.7  | 116.7     | 116.7  | 116.7  | 116.7 | 116.7  |
| frame max                | 133.4  | 133.4     | 133.4  | 133.4  | 133.4 | 133.4  |
| long tasks               | 2      | 2         | 2      | 2      | 2     | 2      |
| long-task time           | 122    | 129       | 128    | 150    | 150   | 171    |

### @4x

| Metric                   | 1.41   | w8-before | t=0    | t=50  | t=100  | t=200  |
| ------------------------ | ------ | --------- | ------ | ----- | ------ | ------ |
| commits per reply        | 190    | 232       | 235    | 147   | 85     | 53     |
| commits per 100ms        | 7.19   | 5.49      | 5.5    | 3.55  | 2.04   | 1.27   |
| idle frame p50 (control) | 83.3   | 66.7      | 66.6   | 83.4  | 66.6   | 58.3   |
| stream duration          | 2657.1 | 4223.3    | 4239.6 | 4171  | 4202.5 | 4178.8 |
| frame p50                | 75     | 66.7      | 66.7   | 66.7  | 66.7   | 66.7   |
| frame p95                | 169.2  | 133.3     | 125    | 130.8 | 128.3  | 116.7  |
| frame max                | 233.3  | 283.4     | 250    | 233.4 | 350    | 399.9  |
| long tasks               | 6      | 5         | 5      | 4     | 4      | 3      |
| long-task time           | 895    | 759       | 771    | 774   | 670    | 650    |

- **Frame rows are compared with the idle control row only** (W2 caveat): headless rAF idles at 50-83 ms
  per frame, so frame p50 = idle means "no worse than idle", never a 16.7 ms budget. The control row
  itself moves between 50 and 83 ms across cells; frame differences of one rAF quantum (16.7 ms) or
  less are noise.
- **Final text:** the rendered page text after the reply hashed identically in all 40 runs (1 distinct
  hash across every throttle and CPU cell).
- **1.41 is a different scenario** (short reply, ~100 words); compare shape, not counts.

## Reading it

- **Commits fall monotonically with the window:** 235 → 189 → 125 → 83 @1x (-65% at 200 ms), 235 → 147 → 85 → 53
  @4x (-77%). That is the largest move; frame max @4x and long-task time (below) move too.
- **Stream duration does not drop.** It is render-bound, not commit-bound (6.4 s @1x for ~2.9 s of
  timers), so batching commits saves React work but not wall time; @1x it is +7% at 100/200 ms (the
  trailing commit waits out the window).
- **Frame p95:** @1x identical for every value (116.7). @4x t=0 is 125; t=50 130.8 and t=100 128.3 are
  worse (within one rAF quantum), t=200 is 116.7, better.
- **Frame max @4x is worse for every throttled value** except t=50 (233 vs 250): 350 at 100 ms, 400 at
  200 ms. One long frame in the run, most likely the deferred heavy blocks (fence, mermaid) landing in
  a larger batch. Long-task time @4x improves (771 → 650 at 200 ms), long tasks 5 → 3.
- **Not measured:** perceived text cadence. At 200 ms the reply updates ~5x per second; the lane
  measures cost, not smoothness of the visible flow, and there is no per-update timestamp.

## Selection rule and recommendation

Rule: pick the lowest commit count whose frame p95 is within the one-quantum noise band (16.7 ms) of
throttle 0 at both CPU rates, with identical final text; commit count is the tie-break.

| t   | p95 @1x (Δ vs t=0) | p95 @4x (Δ vs t=0) | in band   | commits @1x / @4x |
| --- | ------------------ | ------------------ | --------- | ----------------- |
| 0   | 116.7              | 125                | (control) | 235 / 235         |
| 50  | 116.7 (0)          | 130.8 (+5.8)       | yes       | 189 / 147         |
| 100 | 116.7 (0)          | 128.3 (+3.3)       | yes       | 125 / 85          |
| 200 | 116.7 (0)          | 116.7 (-8.3)       | yes       | 83 / 53           |

All three pass (final text: 1 distinct hash in 40 runs), and 200 ms has the fewest commits, so the
mechanical rule gives **RECOMMENDED DEFAULT: `throttle = 200`**. Under the stricter reading (p95 not
worse than t=0 at all), 200 is also the only survivor. This rule does not look at frame max, where
200 is worst @4x (400 ms vs 250).

## Decision

The lead set the package default to **100 ms**, not 200. 200 has the worst @4x frame max (400 ms vs
250), and about 5 updates per second reads as a choppy typewriter (cadence is unmeasured, so this is a
judgement, not a number). 100 ms still removes -47% commits @1x (235 → 125) and -64% @4x (235 → 85).
