/**
 * Evidence lane: chart render timings on the playground `/charts` route.
 *
 *  - first paint   navigation start → first painted chart `<path>` (rAF after it gets a box)
 *  - update        the route has NO streaming-data chart, so an "update" is the legend toggle —
 *                  `button[data-legend-key]` hides/shows a series, which re-derives the y-domain,
 *                  tooltip rows and marks (a full chart re-render). Click → second rAF, plus rAF
 *                  frame times and long tasks over the whole burst.
 *  - hover         synthetic `pointermove` on the hover overlay → the rAF in which the tooltip
 *                  text first changes. Consecutive moves land on different data points.
 *
 * Median of RUNS fresh-context runs per CPU throttle (unthrottled and 4x). N is in every output.
 */
import type { Page } from 'playwright-core'
import type { Lane, LaneResult } from './types'
import {
  PROBE_INIT,
  RUNS,
  THROTTLES,
  cell,
  freshPage,
  median,
  percentile,
  readProbe,
  round,
  sortKeys,
  summarizeWindow,
} from './perf-util'
import type { Throttle } from './perf-util'

const UPDATES_PER_RUN = 40
const HOVERS_PER_RUN = 40
const HOVER_TIMEOUT_MS = 1000

/** The chart `<svg>` is identified by its hover overlay; `data-testid="chart-frame"` exists only in
 * the layout-suite fixture, not in the playground build. */
const CHART_PATH = 'svg:has(rect[role="slider"]) path'

/** Marks the first frame in which any chart path has a real box. Runs before page scripts. */
const FIRST_PAINT_INIT = `(() => {
  const poll = () => {
    for (const p of document.querySelectorAll('${CHART_PATH}')) {
      const r = p.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        requestAnimationFrame(() => { window.__chartFirstPaint = performance.now(); });
        return;
      }
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
})();`

type RunMetrics = {
  firstPaintMs: number
  idleFrameP50Ms: number
  updateP50Ms: number
  updateP95Ms: number
  updateFrameP95Ms: number
  updateLongTasks: number
  hoverP50Ms: number
  hoverP95Ms: number
  hoverMisses: number
}

type Burst = { t0: number; t1: number; latencies: number[]; misses?: number }

async function measureUpdates(page: Page): Promise<Burst> {
  return page.evaluate(async (n) => {
    const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
    // First legend with two or more entries: that is when toggling is enabled (and a hide can
    // never empty the plot).
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>('button[data-legend-key]'),
    ].find((b) => b.parentElement!.querySelectorAll('button[data-legend-key]').length >= 2)
    if (!button) throw new Error('charts-perf: no chart with a toggleable legend on /charts')
    const latencies: number[] = []
    const t0 = performance.now()
    for (let i = 0; i < n; i++) {
      const start = performance.now()
      button.click()
      await raf()
      await raf()
      latencies.push(performance.now() - start)
    }
    return { t0, t1: performance.now(), latencies }
  }, UPDATES_PER_RUN)
}

async function measureHover(page: Page): Promise<Burst> {
  return page.evaluate(
    async ([n, timeout]) => {
      const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
      const overlay = document.querySelector<SVGRectElement>('rect[role="slider"]')
      if (!overlay) throw new Error('charts-perf: no hover overlay on /charts')
      const box = overlay.getBoundingClientRect()
      const signature = () =>
        [...document.querySelectorAll('[role="tooltip"]')].map((t) => t.textContent).join('|')
      const fire = (type: string, x: number) =>
        overlay.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: box.top + box.height / 2,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        )
      const latencies: number[] = []
      let misses = 0
      let previous = signature()
      const t0 = performance.now()
      for (let i = 0; i < n; i++) {
        // 7 is coprime with 31, so consecutive moves are far apart and every slot is visited.
        const slot = (i * 7) % 31
        const x = box.left + box.width * ((slot + 0.5) / 31)
        const start = performance.now()
        if (i === 0) {
          fire('pointerover', x)
          fire('pointerenter', x)
        }
        fire('pointermove', x)
        let seen = false
        while (performance.now() - start < timeout) {
          await raf()
          const now = signature()
          if (now !== previous && now !== '') {
            previous = now
            seen = true
            break
          }
        }
        if (seen) latencies.push(performance.now() - start)
        else misses++
      }
      return { t0, t1: performance.now(), latencies, misses }
    },
    [HOVERS_PER_RUN, HOVER_TIMEOUT_MS] as [number, number],
  )
}

async function oneRun(
  browser: import('playwright-core').Browser,
  baseUrl: string,
  rate: Throttle,
): Promise<RunMetrics> {
  const { context, page } = await freshPage(browser, rate, [PROBE_INIT, FIRST_PAINT_INIT])
  try {
    page.setDefaultTimeout(60_000)
    await page.goto(`${baseUrl}/charts`, { waitUntil: 'load' })
    await page.waitForFunction(
      () => (window as unknown as { __chartFirstPaint?: number }).__chartFirstPaint !== undefined,
    )
    const firstPaintMs = await page.evaluate(
      () => (window as unknown as { __chartFirstPaint: number }).__chartFirstPaint,
    )
    // Let fonts/lazy chunks settle so the bursts below measure the chart, not the page load.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Control: the host's own frame cadence with nothing happening. Update/hover latencies are
    // quantised to it (rAF → paint), so read them against this row.
    const idle0 = await page.evaluate(() => performance.now())
    await page.waitForTimeout(1000)
    const idleProbe = await readProbe(page, idle0, await page.evaluate(() => performance.now()))

    const update = await measureUpdates(page)
    const updateProbe = await readProbe(page, update.t0, update.t1)
    const updateWindow = summarizeWindow(updateProbe.frames, updateProbe.longTasks)

    await page.waitForTimeout(300)
    const hover = await measureHover(page)

    return {
      firstPaintMs: round(firstPaintMs),
      idleFrameP50Ms: round(percentile(idleProbe.frames, 50)),
      updateP50Ms: round(percentile(update.latencies, 50)),
      updateP95Ms: round(percentile(update.latencies, 95)),
      updateFrameP95Ms: updateWindow.frameP95,
      updateLongTasks: updateWindow.longTasks,
      hoverP50Ms: round(percentile(hover.latencies, 50)),
      hoverP95Ms: round(percentile(hover.latencies, 95)),
      hoverMisses: hover.misses ?? 0,
    }
  } finally {
    await context.close()
  }
}

export const chartsPerf: Lane = async (ctx): Promise<LaneResult> => {
  const browser = await ctx.openBrowser()
  const summary: LaneResult['summary'] = []
  const detail: Record<string, unknown> = {
    hoversPerRun: HOVERS_PER_RUN,
    route: '/charts',
    runs: RUNS,
    updatesPerRun: UPDATES_PER_RUN,
    updateDriver: 'legend toggle (no streaming-data chart on the route)',
  }
  for (const rate of THROTTLES) {
    const runs: RunMetrics[] = []
    for (let i = 0; i < RUNS; i++) runs.push(await oneRun(browser, ctx.baseUrl, rate))
    const med = (pick: (r: RunMetrics) => number) => round(median(runs.map(pick)))
    const c = cell(rate)
    summary.push(
      { metric: `first-paint @${c}`, value: med((r) => r.firstPaintMs), unit: 'ms' },
      { metric: `idle frame p50 (control) @${c}`, value: med((r) => r.idleFrameP50Ms), unit: 'ms' },
      { metric: `update p50 @${c}`, value: med((r) => r.updateP50Ms), unit: 'ms' },
      { metric: `update p95 @${c}`, value: med((r) => r.updateP95Ms), unit: 'ms' },
      { metric: `update frame p95 @${c}`, value: med((r) => r.updateFrameP95Ms), unit: 'ms' },
      {
        metric: `update long tasks @${c}`,
        value: med((r) => r.updateLongTasks),
        unit: `/${UPDATES_PER_RUN} updates`,
      },
      { metric: `hover p50 @${c}`, value: med((r) => r.hoverP50Ms), unit: 'ms' },
      { metric: `hover p95 @${c}`, value: med((r) => r.hoverP95Ms), unit: 'ms' },
      {
        metric: `hover misses @${c}`,
        value: med((r) => r.hoverMisses),
        unit: `/${HOVERS_PER_RUN} moves`,
      },
    )
    detail[c] = runs
  }
  summary.push({ metric: 'runs per cell (N)', value: RUNS })
  return { lane: 'charts-perf', summary, detail: sortKeys(detail) }
}
