# W8 — chat-profile, before the runtime change

Lane `chat-profile` was blind from W3 (the `/agent` Core tab it drove was deleted). It now drives the
**Stream** tab on `/agent`: `useAgentThreadRuns` + `ThreadFeed` (inline row, with its `Composer`) over
a deterministic in-memory `richTransport` (`apps/playground/src/demo/agent-scenarios.ts`).

Run: `make evidence LABEL=w8-before LANES=chat-profile` on `w8/chat-profile-lane`, base `e161e81f`
(2.0 line, no `throttle`). Medians of 5 fresh-context runs per CPU cell. Metric definitions are
unchanged from 1.41 (`scripts/evidence/chat-profile.ts`).

| Metric                        | 1.41 baseline | w8-before | Unit    |
| ----------------------------- | ------------- | --------- | ------- |
| commits per reply @1x         | 210           | 235       | commits |
| commits per 100ms @1x         | 7.34          | 3.66      |         |
| idle commits (1s control) @1x | 0             | 0         | commits |
| idle frame p50 (control) @1x  | 66.6          | 58.4      | ms      |
| stream duration @1x           | 2856.5        | 6428.7    | ms      |
| frame p50 @1x                 | 66.6          | 66.7      | ms      |
| frame p95 @1x                 | 116.7         | 116.7     | ms      |
| frame max @1x                 | 133.4         | 133.4     | ms      |
| long tasks @1x                | 2             | 2         | tasks   |
| long-task time @1x            | 122           | 129       | ms      |
| commits per reply @4x         | 190           | 232       | commits |
| commits per 100ms @4x         | 7.19          | 5.49      |         |
| idle commits (1s control) @4x | 0             | 0         | commits |
| idle frame p50 (control) @4x  | 83.3          | 66.7      | ms      |
| stream duration @4x           | 2657.1        | 4223.3    | ms      |
| frame p50 @4x                 | 75            | 66.7      | ms      |
| frame p95 @4x                 | 169.2         | 133.3     | ms      |
| frame max @4x                 | 233.3         | 283.4     | ms      |
| long tasks @4x                | 6             | 5         | tasks   |
| long-task time @4x            | 895           | 759       | ms      |
| runs per cell (N)             | 5             | 5         |         |

## Reading it

- **The scenario is not the 1.41 scenario.** 1.41 streamed a short reply (~100 words, 2 words per
  delta). This one is ~1500 words in ~105 deltas (~14 words per delta), same 28 ms cadence, plus a
  tool call and a longer markdown body. Compare the shape, not the absolute counts.
- **Stream duration is render-bound, not timer-bound.** The transport emits 105 deltas at 28 ms
  (~2.9 s of timers). The measured 6.4 s @1x means each delta costs ~60 ms of main-thread time end to
  end, so deltas queue behind renders. That is the cost this lane exists to expose; commits per 100 ms
  is lower than 1.41 for the same reason.
- **Unit of comparison.** Headless rAF idles at ~66 ms per frame (idle control row: 58-67 ms @1x,
  67 ms @4x). Frame p50 equal to the control row means "no worse than idle": compare frame rows
  against the control row, never against a 16.7 ms budget.
- **Commits per reply:** 235 @1x (1.41: 210), about 2.2 commits per delta. This is the number the
  runtime throttle work should move.
- Part ids are content-stable (`rich-text-1`, ...), so runs differ only in timing.
- The `submitted -> streaming` edge is not measured: not part of the API on this base.
