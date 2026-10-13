# W2 evidence — perf lanes (chart render, chat streaming)

Two `Lane`s (`scripts/evidence/types.ts`) loaded by `scripts/evidence/index.ts` as
`chartsPerf` (`charts-perf.ts`) and `chatProfile` (`chat-profile.ts`); shared helpers in
`perf-util.ts` (order statistics, the in-page frame/long-task probe, the CDP throttle seam;
unit-tested by `perf-util.test.ts`). Both lanes take Chrome from `ctx.openBrowser()` and close only
their own contexts. Neither touches playground source.

## Method (both lanes)

- Fixed 1280×800 viewport, DPR 1, light scheme, a **fresh browser context per run**.
- Each cell is run **N = 5** times; the reported value is the **median of the per-run values**. Cells
  are CPU `1x` (unthrottled) and `4x` (`Emulation.setCPUThrottlingRate` over CDP). Per-run values
  are in `<lane>.json` (`detail`, sorted keys).
- Frame times are rAF deltas, long tasks are `PerformanceObserver('longtask')` entries, both sampled
  by an init-script probe for the whole page life and sliced to the measured window.
- **Control row `idle frame p50`:** the host's own rAF cadence with nothing happening. On the
  headless mini it is ~50–80 ms (not 16.7 ms), so every rAF-based latency below is **quantised to
  that cadence** — read them against the control, compare only across runs on the same host, and
  expect ±1 frame of noise on a 5-run median.
- FCP is not reported: Chrome emits no `first-contentful-paint` entry in this headless setup.

## `charts-perf` — playground `/charts` (default "Linked series" group)

| Metric      | Definition                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| first-paint | navigation start → rAF after the first `svg:has(rect[role=slider]) path` has a box                                                                                                                                                                                                         |
| update      | **`/charts` has no streaming-data chart.** The update driver is the legend toggle (`button[data-legend-key]` of the first legend with ≥2 entries): hide/show re-derives y-domain, tooltip rows and marks. `click()` → second rAF, 40 per run; frame p95 and long-task count over the burst |
| hover       | synthetic `pointermove` (mouse) on the first `rect[role=slider]` overlay → rAF in which `[role=tooltip]` text first changes; 40 moves per run, consecutive moves 7/31 of the plot apart (all distinct points). `misses` = no change within 1 s                                             |

N is in the table: 5 runs × (40 updates, 40 hovers) per cell.

## `chat-profile` — playground `/agent` (Core tab)

The stream is deterministic: `AgentDemoPage` runs `useAgentStream` over
`scenarioTransport(AGENT_SCENARIOS[0], 'normal')` — the in-memory `rich` scenario (reasoning, then
markdown with a code fence, a mermaid block and an alert), one delta per 28 ms; no network, no
model. Only `crypto.randomUUID()` part ids differ between runs.

- **Commits:** an `addInitScript` stub of `__REACT_DEVTOOLS_GLOBAL_HOOK__` (`inject`,
  `onCommitFiberRoot`, …) counts `onCommitFiberRoot` calls. React invokes it from production builds,
  so the production `dist` is measured. It counts commits, it does not time them — frame times and
  long tasks over the same window carry cost.
- **Window:** Enter in the composer → the "Assistant is typing" indicator attached then detached.
- **Control:** commits over 1 s of idle before the send (must be 0).
- Prompt is fixed; it only seeds the reply text.

## Sample run (this host, N = 5, production playground build)

Machine-dependent — a template for the diff `make evidence` produces, not a budget.

| `charts-perf` metric               | 1x    | 4x    |
| ---------------------------------- | ----- | ----- |
| first-paint (ms)                   | 298.6 | 776   |
| idle frame p50, control (ms)       | 66.6  | 83.3  |
| update p50 (ms)                    | 137.6 | 124.3 |
| update p95 (ms)                    | 237.6 | 220.7 |
| update frame p95 (ms)              | 133.3 | 133.2 |
| update long tasks (per 40 updates) | 0     | 0     |
| hover p50 (ms)                     | 65.3  | 62.6  |
| hover p95 (ms)                     | 134.2 | 135.1 |
| hover misses (per 40 moves)        | 0     | 0     |

| `chat-profile` metric         | 1x                 | 4x                   |
| ----------------------------- | ------------------ | -------------------- |
| commits per reply             | 209                | 187                  |
| commits per 100 ms            | 7.36               | 6.43                 |
| idle commits, control (1 s)   | 0                  | 0                    |
| idle frame p50, control (ms)  | 50                 | 50                   |
| stream duration (ms)          | 2847.8             | 2875.6               |
| frame p50 / p95 / max (ms)    | 50 / 115.8 / 133.3 | 83.3 / 183.3 / 283.3 |
| long tasks (count / total ms) | 2 / 119            | 7 / 1074             |

Reading it: first paint scales with the throttle (2.6×) and so do the chat long tasks (2 → 7), so
the throttle is applied. Update and hover latency do **not** move with it: they sit at 2–3 idle
frames (hover ≈ 1 frame at p50), i.e. frame-cadence-bound on this host, not CPU-bound — the
sensitive signals for a chart-engine diff are first paint, the long-task counts and the commit
counts. Commits per reply track the delta count (~1 commit per streamed delta plus the settle).

## Reproduce

```sh
bun install
(cd packages/basalt-ui && bun run build) && (cd apps/playground && bun run build)
bun test scripts/evidence                    # pure helpers
ROOT=$PWD bun <runner>.ts both               # the runner below, kept outside the repo
```

The standalone runner is the whole `LaneCtx` by hand (until `index.ts` lands): serve
`apps/playground/dist` with SPA fallback, launch Chrome by channel, call the lanes.

```ts
import { chromium } from 'playwright-core'
import { join } from 'node:path'
const root = process.env.ROOT!
const dist = join(root, 'apps/playground/dist')
const server = Bun.serve({
  port: 0,
  async fetch(r) {
    const p = new URL(r.url).pathname
    const f = Bun.file(join(dist, p))
    if (p !== '/' && (await f.exists())) return new Response(f)
    return new Response(Bun.file(join(dist, 'index.html')), {
      headers: { 'content-type': 'text/html' },
    })
  },
})
const procs: Array<{ kill(): Promise<void> }> = []
const ctx = {
  label: 'standalone',
  outDir: '/tmp',
  distDir: dist,
  baseUrl: server.url.origin.replace(/\/$/, ''),
  openBrowser: async () => {
    const s = await chromium.launchServer({ channel: 'chrome' })
    procs.push(s)
    return chromium.connect(s.wsEndpoint())
  },
}
const { chartsPerf } = await import(join(root, 'scripts/evidence/charts-perf.ts'))
const { chatProfile } = await import(join(root, 'scripts/evidence/chat-profile.ts'))
try {
  for (const lane of [chartsPerf, chatProfile])
    console.log(JSON.stringify((await lane(ctx)).summary, null, 1))
} finally {
  for (const p of procs) await p.kill()
  server.stop(true)
}
```
