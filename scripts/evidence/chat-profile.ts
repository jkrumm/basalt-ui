/**
 * Evidence lane: React commit counts + frame cost while the playground `/agent` route streams a
 * reply. The playground source is NOT touched:
 *
 *  - Stream: `/agent` → "Stream" tab (`AgentStreamDemo`) drives `useAgentThreadRuns` over
 *    `richTransport` — a deterministic in-memory mock (~1500 words over ~3 s: reasoning, markdown
 *    with lists and a link, a ts fence, a mermaid block, an alert, a tool call), one delta per
 *    28 ms, rendered by `ThreadFeed` + `Composer`. No network, no model, content-stable part ids.
 *  - Commits: a `__REACT_DEVTOOLS_GLOBAL_HOOK__` stub installed by `addInitScript` counts every
 *    `onCommitFiberRoot` call (React calls it from production builds too). It is a counter, not a
 *    Profiler: it says HOW MANY commits, not how long each took — frame times and long tasks over
 *    the same window carry the cost.
 *  - Window: send (Enter in the composer) → the "Assistant is typing" indicator has appeared and
 *    then gone. Idle commits for 1 s before the send are recorded as the control.
 *
 * Median of RUNS fresh-context runs per CPU throttle (unthrottled and 4x), once per runtime
 * `throttle` value (W8 sweep: the demo reads `?throttle=<ms>`). `CHAT_THROTTLES=0,50` overrides the
 * list. The page text after the reply is hashed per run, so "final text identical" is a number.
 */
import type { Lane, LaneResult } from './types'
import {
  PROBE_INIT,
  RUNS,
  THROTTLES,
  cell,
  freshPage,
  median,
  readProbe,
  round,
  sortKeys,
  summarizeWindow,
} from './perf-util'
import type { Throttle } from './perf-util'

const PROMPT = 'How do deep modules reduce coupling?'
const TYPING = '[aria-label="Assistant is typing"]'
const COMPOSER = 'textarea[placeholder^="Send a message"]'
const STREAM_TIMEOUT_MS = 90_000
const IDLE_CONTROL_MS = 1000
/** The runtime `throttle` values swept, in ms (0 = off, the runtime default). */
export const SWEEP_MS: readonly number[] = (process.env['CHAT_THROTTLES'] ?? '0,50,100,200')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v >= 0)

/** FNV-1a over the rendered text: enough to tell "identical" from "different", not a digest. */
export function hashText(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Minimal React DevTools hook: enough for `injectInternals` to accept it and for commits to count. */
const HOOK_INIT = `(() => {
  window.__commits = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    onCommitFiberRoot() { window.__commits++; },
    onPostCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    checkDCE() {},
  };
})();`

type RunMetrics = {
  textHash: string
  commits: number
  commitsPer100ms: number
  idleCommits: number
  idleFrameP50Ms: number
  streamMs: number
  frameP50Ms: number
  frameP95Ms: number
  frameMaxMs: number
  longTasks: number
  longTaskMs: number
}

async function oneRun(
  browser: import('playwright-core').Browser,
  baseUrl: string,
  rate: Throttle,
  throttleMs: number,
): Promise<RunMetrics> {
  const { context, page } = await freshPage(browser, rate, [PROBE_INIT, HOOK_INIT])
  try {
    page.setDefaultTimeout(STREAM_TIMEOUT_MS)
    await page.goto(`${baseUrl}/agent?throttle=${throttleMs}`, { waitUntil: 'load' })
    await page.getByRole('tab', { name: 'Stream' }).click()
    await page.waitForSelector(COMPOSER)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const commits = () =>
      page.evaluate(() => (window as unknown as { __commits: number }).__commits)
    const idleStart = await commits()
    const idle0 = await page.evaluate(() => performance.now())
    await page.waitForTimeout(IDLE_CONTROL_MS)
    const idleCommits = (await commits()) - idleStart
    const idleProbe = await readProbe(page, idle0, await page.evaluate(() => performance.now()))

    await page.fill(COMPOSER, PROMPT)
    const before = await commits()
    const t0 = await page.evaluate(() => performance.now())
    await page.press(COMPOSER, 'Enter')
    await page.waitForSelector(TYPING, { state: 'attached' })
    await page.waitForSelector(TYPING, { state: 'detached' })
    const t1 = await page.evaluate(() => performance.now())
    const streamCommits = (await commits()) - before

    const textHash = hashText(await page.evaluate(() => document.body.innerText))
    const probe = await readProbe(page, t0, t1)
    const win = summarizeWindow(probe.frames, probe.longTasks)
    const streamMs = t1 - t0
    return {
      textHash,
      commits: streamCommits,
      commitsPer100ms: round((streamCommits / streamMs) * 100, 2),
      idleCommits,
      idleFrameP50Ms: summarizeWindow(idleProbe.frames, []).frameP50,
      streamMs: round(streamMs),
      frameP50Ms: win.frameP50,
      frameP95Ms: win.frameP95,
      frameMaxMs: win.frameMax,
      longTasks: win.longTasks,
      longTaskMs: win.longTaskMs,
    }
  } finally {
    await context.close()
  }
}

export const chatProfile: Lane = async (ctx): Promise<LaneResult> => {
  const browser = await ctx.openBrowser()
  const summary: LaneResult['summary'] = []
  const detail: Record<string, unknown> = {
    idleControlMs: IDLE_CONTROL_MS,
    prompt: PROMPT,
    route: '/agent (Stream tab, scenario "rich")',
    runs: RUNS,
    sweepMs: SWEEP_MS,
  }
  const hashes = new Set<string>()
  for (const throttleMs of SWEEP_MS) {
    for (const rate of THROTTLES) {
      const runs: RunMetrics[] = []
      for (let i = 0; i < RUNS; i++) {
        runs.push(await oneRun(browser, ctx.baseUrl, rate, throttleMs))
      }
      for (const r of runs) hashes.add(r.textHash)
      const med = (pick: (r: RunMetrics) => number) => round(median(runs.map(pick)), 2)
      const c = `${cell(rate)} throttle=${throttleMs}ms`
      summary.push(
        { metric: `commits per reply @${c}`, value: med((r) => r.commits), unit: 'commits' },
        { metric: `commits per 100ms @${c}`, value: med((r) => r.commitsPer100ms) },
        {
          metric: `idle commits (1s control) @${c}`,
          value: med((r) => r.idleCommits),
          unit: 'commits',
        },
        {
          metric: `idle frame p50 (control) @${c}`,
          value: med((r) => r.idleFrameP50Ms),
          unit: 'ms',
        },
        { metric: `stream duration @${c}`, value: med((r) => r.streamMs), unit: 'ms' },
        { metric: `frame p50 @${c}`, value: med((r) => r.frameP50Ms), unit: 'ms' },
        { metric: `frame p95 @${c}`, value: med((r) => r.frameP95Ms), unit: 'ms' },
        { metric: `frame max @${c}`, value: med((r) => r.frameMaxMs), unit: 'ms' },
        { metric: `long tasks @${c}`, value: med((r) => r.longTasks), unit: 'tasks' },
        { metric: `long-task time @${c}`, value: med((r) => r.longTaskMs), unit: 'ms' },
      )
      detail[c] = runs
    }
  }
  summary.push(
    { metric: 'runs per cell (N)', value: RUNS },
    { metric: 'distinct final-text hashes (all runs)', value: hashes.size },
  )
  return { lane: 'chat-profile', summary, detail: sortKeys(detail) }
}
