/**
 * Evidence lane: `BasaltDataTable` over 10 000 rows on the playground `/table-perf` route
 * (`apps/playground/src/demo/TablePerfPage.tsx`; pagination off, every row in the DOM, scrolling
 * inside the table's capped container).
 *
 *  - first render   navigation start → the 10 000th `<tr>` is in the DOM (+ one rAF to paint it)
 *  - sort           click a header → the rAF in which the first body row changes. Name (string) and
 *                   MRR (number), each driven through a full asc → desc → off cycle, twice
 *  - search         one keystroke → the rAF in which the row count changes. Names are `acct-0NNNN`,
 *                   so once the `acct-0` prefix is in (it matches every row) `4`, `2`, `1`, `7` each
 *                   strictly narrow the set; the last sample is the clear (back to 10 000 rows)
 *  - scroll         the scroll container is moved through its full height in `SCROLL_FRAMES` rAF
 *                   steps; frame-time p50/p95 and long tasks over that window
 *  - control        idle rAF frame in the same run. Headless Chrome here idles at ~66 ms, which
 *                   quantises every latency above — read each number as a delta against the control
 *                   of the SAME run, never as an absolute
 *
 * Median of RUNS fresh-context runs, unthrottled (a 10k-row mount at 4x is a minutes-long page load
 * and adds no signal over the delta). N is in every output.
 */
import type { Browser, Page } from 'playwright-core'
import type { Lane, LaneResult } from './types'
import {
  PROBE_INIT,
  RUNS,
  freshPage,
  median,
  percentile,
  readProbe,
  round,
  sortKeys,
  summarizeWindow,
} from './perf-util'

export const TABLE_ROUTE = '/table-perf'
export const ROW_COUNT = 10_000
export const SCROLL_FRAMES = 120
export const SORT_COLUMNS = ['Name', 'MRR'] as const
const SORT_CYCLES = 2
const SORT_STATES_PER_CYCLE = 3
const SEARCH_PREFIX = 'acct-0'
const SEARCH_TERM = 'acct-04217'
const STEP_TIMEOUT_MS = 10_000

// ── Pure helpers (unit-tested; no browser) ────────────────────────────────────────────────────

/** The input values to type after `prefix`, one character at a time: `acct-` → `acct-0`, `acct-04`… */
export function keystrokeValues(term: string, prefix: string): string[] {
  if (!term.startsWith(prefix) || term.length === prefix.length) {
    throw new Error(`table-perf: "${term}" does not extend "${prefix}"`)
  }
  return Array.from({ length: term.length - prefix.length }, (_, i) =>
    term.slice(0, prefix.length + i + 1),
  )
}

/** Evenly spaced scrollTop targets from the first step to the bottom; the last is always `max`. */
export function scrollOffsets(max: number, frames: number): number[] {
  if (max <= 0 || frames <= 0) return []
  return Array.from({ length: frames }, (_, i) => Math.round((max * (i + 1)) / frames))
}

/** `value` minus the same run's `control`, rounded — the only form of these numbers that compares. */
export const overControl = (value: number, control: number): number => round(value - control)

// ── In-page pieces ────────────────────────────────────────────────────────────────────────────

/** Stamps the first frame after the last row exists. Installed before any page script. */
const FIRST_RENDER_INIT = `(() => {
  const poll = () => {
    if (document.querySelector('tbody tr:nth-child(${ROW_COUNT})')) {
      requestAnimationFrame(() => { window.__tableFirstRender = performance.now(); });
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
})();`

type RunMetrics = {
  firstRenderMs: number
  idleFrameP50Ms: number
  sortP50Ms: Record<string, number>
  searchP50Ms: number
  searchMisses: number
  scrollFrameP50Ms: number
  scrollFrameP95Ms: number
  scrollLongTasks: number
}

type Burst = { t0: number; t1: number; latencies: number[]; misses: number }

async function measureSort(page: Page, header: string): Promise<Burst> {
  return page.evaluate(
    async ([name, cycles, perCycle, timeout]) => {
      const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
      const th = [...document.querySelectorAll<HTMLElement>('thead th')].find(
        (h) => h.textContent?.trim() === name,
      )
      if (!th) throw new Error(`table-perf: no "${name}" column header`)
      const firstRow = () => document.querySelector('tbody tr')?.textContent ?? ''
      const latencies: number[] = []
      let misses = 0
      const t0 = performance.now()
      for (let i = 0; i < cycles * perCycle; i++) {
        const previous = firstRow()
        const start = performance.now()
        th.click()
        let seen = false
        while (performance.now() - start < timeout) {
          await raf()
          if (firstRow() !== previous) {
            seen = true
            break
          }
        }
        if (seen) latencies.push(performance.now() - start)
        else misses++
        // Settle between clicks so one sort's commit never lands inside the next one's window.
        await raf()
        await raf()
      }
      return { t0, t1: performance.now(), latencies, misses }
    },
    [header, SORT_CYCLES, SORT_STATES_PER_CYCLE, STEP_TIMEOUT_MS] as [
      string,
      number,
      number,
      number,
    ],
  )
}

async function measureSearch(page: Page): Promise<Burst> {
  const typed = keystrokeValues(SEARCH_TERM, SEARCH_PREFIX)
  return page.evaluate(
    async ([prefix, values, timeout]) => {
      const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
      const input = document.querySelector<HTMLInputElement>(
        'input[type="text"], input:not([type])',
      )
      if (!input) throw new Error('table-perf: no search input')
      const rows = () => document.querySelectorAll('tbody tr').length
      // React tracks the value itself: bypass its setter shadow, then fire the event it listens to.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      const put = (value: string) => {
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const settle = async (expected: (n: number) => boolean) => {
        const deadline = performance.now() + timeout
        while (performance.now() < deadline) {
          await raf()
          if (expected(rows())) return
        }
      }
      const timed = async (value: string): Promise<number | null> => {
        const previous = rows()
        const start = performance.now()
        put(value)
        while (performance.now() - start < timeout) {
          await raf()
          if (rows() !== previous) return performance.now() - start
        }
        return null
      }
      input.focus()
      // Setup (not measured): the prefix matches every row, so the row count must not move.
      put(prefix)
      await raf()
      await raf()
      await settle((n) => n > 0)
      const latencies: number[] = []
      let misses = 0
      const t0 = performance.now()
      for (const value of [...values, '']) {
        const ms = await timed(value)
        if (ms === null) misses++
        else latencies.push(ms)
        await raf()
        await raf()
      }
      return { t0, t1: performance.now(), latencies, misses }
    },
    [SEARCH_PREFIX, typed, STEP_TIMEOUT_MS] as [string, string[], number],
  )
}

/** Drive the table's scroll container top → bottom, one step per rAF; returns the window bounds. */
async function measureScroll(page: Page, offsets: number[]): Promise<{ t0: number; t1: number }> {
  return page.evaluate(async (targets) => {
    const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
    // The scroller is whichever ancestor of the table actually scrolls vertically.
    let node: HTMLElement | null = document.querySelector('table')
    while (
      node &&
      !(
        node.scrollHeight > node.clientHeight &&
        /auto|scroll/.test(getComputedStyle(node).overflowY)
      )
    ) {
      node = node.parentElement
    }
    if (!node) throw new Error('table-perf: the table has no vertical scroll container')
    node.scrollTop = 0
    await raf()
    const t0 = performance.now()
    for (const top of targets) {
      node.scrollTop = top
      await raf()
    }
    return { t0, t1: performance.now() }
  }, offsets)
}

async function scrollRange(page: Page): Promise<number> {
  return page.evaluate(() => {
    let node: HTMLElement | null = document.querySelector('table')
    while (
      node &&
      !(
        node.scrollHeight > node.clientHeight &&
        /auto|scroll/.test(getComputedStyle(node).overflowY)
      )
    ) {
      node = node.parentElement
    }
    return node ? node.scrollHeight - node.clientHeight : 0
  })
}

async function oneRun(browser: Browser, baseUrl: string): Promise<RunMetrics> {
  const { context, page } = await freshPage(browser, 1, [PROBE_INIT, FIRST_RENDER_INIT])
  try {
    page.setDefaultTimeout(120_000)
    await page.goto(`${baseUrl}${TABLE_ROUTE}`, { waitUntil: 'load' })
    await page.waitForFunction(
      () => (window as unknown as { __tableFirstRender?: number }).__tableFirstRender !== undefined,
    )
    const firstRenderMs = await page.evaluate(
      () => (window as unknown as { __tableFirstRender: number }).__tableFirstRender,
    )
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const idle0 = await page.evaluate(() => performance.now())
    await page.waitForTimeout(1000)
    const idleProbe = await readProbe(page, idle0, await page.evaluate(() => performance.now()))

    const sortP50Ms: Record<string, number> = {}
    for (const header of SORT_COLUMNS) {
      const sort = await measureSort(page, header)
      sortP50Ms[header] = round(percentile(sort.latencies, 50))
    }

    const search = await measureSearch(page)
    await page.waitForTimeout(500)

    const offsets = scrollOffsets(await scrollRange(page), SCROLL_FRAMES)
    const scroll = await measureScroll(page, offsets)
    const scrollProbe = await readProbe(page, scroll.t0, scroll.t1)
    const scrollWindow = summarizeWindow(scrollProbe.frames, scrollProbe.longTasks)

    return {
      firstRenderMs: round(firstRenderMs),
      idleFrameP50Ms: round(percentile(idleProbe.frames, 50)),
      sortP50Ms,
      searchP50Ms: round(percentile(search.latencies, 50)),
      searchMisses: search.misses,
      scrollFrameP50Ms: scrollWindow.frameP50,
      scrollFrameP95Ms: scrollWindow.frameP95,
      scrollLongTasks: scrollWindow.longTasks,
    }
  } finally {
    await context.close()
  }
}

export const tablePerf: Lane = async (ctx): Promise<LaneResult> => {
  const browser = await ctx.openBrowser()
  const runs: RunMetrics[] = []
  for (let i = 0; i < RUNS; i++) runs.push(await oneRun(browser, ctx.baseUrl))
  const med = (pick: (r: RunMetrics) => number) => round(median(runs.map(pick)))
  const control = med((r) => r.idleFrameP50Ms)

  const summary: LaneResult['summary'] = [
    { metric: 'rows', value: ROW_COUNT },
    { metric: 'idle frame p50 (control)', value: control, unit: 'ms' },
    { metric: 'first render (10k rows)', value: med((r) => r.firstRenderMs), unit: 'ms' },
  ]
  for (const header of SORT_COLUMNS) {
    const value = med((r) => r.sortP50Ms[header]!)
    summary.push(
      { metric: `sort ${header} p50`, value, unit: 'ms' },
      { metric: `sort ${header} p50 over control`, value: overControl(value, control), unit: 'ms' },
    )
  }
  const search = med((r) => r.searchP50Ms)
  summary.push(
    { metric: 'search keystroke p50', value: search, unit: 'ms' },
    {
      metric: 'search keystroke p50 over control',
      value: overControl(search, control),
      unit: 'ms',
    },
    {
      metric: 'search misses',
      value: med((r) => r.searchMisses),
      unit: `/${keystrokeValues(SEARCH_TERM, SEARCH_PREFIX).length + 1} steps`,
    },
    { metric: 'scroll frame p50', value: med((r) => r.scrollFrameP50Ms), unit: 'ms' },
    { metric: 'scroll frame p95', value: med((r) => r.scrollFrameP95Ms), unit: 'ms' },
    {
      metric: 'scroll long tasks',
      value: med((r) => r.scrollLongTasks),
      unit: `/${SCROLL_FRAMES} frames`,
    },
    { metric: 'runs (N)', value: RUNS },
  )
  return {
    lane: 'table-perf',
    summary,
    detail: sortKeys({
      route: TABLE_ROUTE,
      runs: RUNS,
      scrollFrames: SCROLL_FRAMES,
      sortClicksPerColumn: SORT_CYCLES * SORT_STATES_PER_CYCLE,
      perRun: runs,
    }),
  }
}
