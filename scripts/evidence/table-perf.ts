/**
 * Evidence lane: `BasaltDataTable` over 10 000 rows on the playground `/table-perf` route
 * (`apps/playground/src/demo/TablePerfPage.tsx`; pagination off, every row in the DOM, scrolling
 * inside the table's capped container).
 *
 *  - first render   navigation start → the 10 000th `<tr>` is in the DOM (+ one rAF to paint it)
 *  - sort           click a header → the rAF in which the sort state (`aria-sort`) or the order of
 *                   the first rows changes. Name (string) and MRR (number), each driven through two
 *                   full asc → desc → off cycles. A click that shows no change within the timeout is
 *                   a MISS, counted per column — never silently dropped
 *  - search         one keystroke → the rAF in which the row count changes. Names are `acct-0NNNN`,
 *                   so once the `acct-0` prefix is in (it matches every row) `4`, `2`, `1`, `7` each
 *                   strictly narrow the set; the last sample is the clear (back to 10 000 rows)
 *  - scroll         the scroll container is moved through its full height in `SCROLL_FRAMES` rAF
 *                   steps; frame-time p50/p95 and long tasks over that window
 *  - control        idle rAF frame in the same run. Headless Chrome here idles at ~66 ms, which
 *                   quantises every latency above — each `over control` row is the median of the
 *                   per-run (metric − that run's control), never median(metric) − median(control)
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
  medianOrNull,
  percentile,
  readProbe,
  round,
  sortKeys,
  summarizeWindow,
} from './perf-util'
import type { SummaryRow } from './perf-util'

export { medianOrNull }

/** What the fixture page (`TablePerfPage.tsx`) must provide; `table-perf.test.ts` pins it. */
export const FIXTURE = {
  route: '/table-perf',
  rows: 10_000,
  sortColumns: ['Name', 'MRR'],
  searchPrefix: 'acct-0',
  searchTerm: 'acct-04217',
} as const

type SortColumn = (typeof FIXTURE.sortColumns)[number]

const SCROLL_FRAMES = 120
const SORT_CYCLES = 2
const SORT_STATES_PER_CYCLE = 3
/** Rows compared (in order) to tell that a sort changed the view; with `aria-sort`, never row 1 alone. */
const SORT_SIGNATURE_ROWS = 5
const STEP_TIMEOUT_MS = 10_000
const SCROLLER_ATTR = 'data-perf-scroller'

// ── Pure helpers (unit-tested; no browser) ────────────────────────────────────────────────────

/** The input values to type after `prefix`, one character at a time: `acct-0` → `acct-04`, `acct-042`… */
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

/** p50 of a sample, or `null` when there is none (an all-miss burst) — never NaN. */
export const p50OrNull = (values: readonly number[]): number | null =>
  values.length === 0 ? null : round(percentile(values, 50))

export type RunMetrics = {
  firstRenderMs: number
  idleFrameP50Ms: number
  sortP50Ms: Record<SortColumn, number | null>
  sortMisses: Record<SortColumn, number>
  searchP50Ms: number | null
  searchMisses: number
  scrollFrameP50Ms: number
  scrollFrameP95Ms: number
  scrollLongTasks: number
}

type Row = SummaryRow

/** Median of each run's own `pick(run) − run.idleFrameP50Ms`; `null` when no run has a value. */
export function medianOverControl(
  runs: readonly RunMetrics[],
  pick: (run: RunMetrics) => number | null,
): number | null {
  return medianOrNull(
    runs.map((run) => {
      const value = pick(run)
      return value === null ? null : value - run.idleFrameP50Ms
    }),
  )
}

/** The summary table for a set of runs. A metric with no sample reads `n/a`, never `NaN`/`null`. */
export function summaryRows(runs: readonly RunMetrics[]): Row[] {
  const num = (value: number | null): number | string => value ?? 'n/a'
  const med = (pick: (r: RunMetrics) => number | null) => num(medianOrNull(runs.map(pick)))
  const over = (pick: (r: RunMetrics) => number | null) => num(medianOverControl(runs, pick))
  const searchSteps = keystrokeValues(FIXTURE.searchTerm, FIXTURE.searchPrefix).length + 1
  const rows: Row[] = [
    { metric: 'rows', value: FIXTURE.rows },
    { metric: 'idle frame p50 (control)', value: med((r) => r.idleFrameP50Ms), unit: 'ms' },
    { metric: 'first render (10k rows)', value: med((r) => r.firstRenderMs), unit: 'ms' },
  ]
  for (const header of FIXTURE.sortColumns) {
    rows.push(
      { metric: `sort ${header} p50`, value: med((r) => r.sortP50Ms[header]), unit: 'ms' },
      {
        metric: `sort ${header} p50 over control`,
        value: over((r) => r.sortP50Ms[header]),
        unit: 'ms',
      },
      {
        metric: `sort ${header} misses`,
        value: med((r) => r.sortMisses[header]),
        unit: `/${SORT_CYCLES * SORT_STATES_PER_CYCLE} clicks`,
      },
    )
  }
  rows.push(
    { metric: 'search keystroke p50', value: med((r) => r.searchP50Ms), unit: 'ms' },
    {
      metric: 'search keystroke p50 over control',
      value: over((r) => r.searchP50Ms),
      unit: 'ms',
    },
    { metric: 'search misses', value: med((r) => r.searchMisses), unit: `/${searchSteps} steps` },
    { metric: 'scroll frame p50', value: med((r) => r.scrollFrameP50Ms), unit: 'ms' },
    { metric: 'scroll frame p95', value: med((r) => r.scrollFrameP95Ms), unit: 'ms' },
    {
      metric: 'scroll long tasks',
      value: med((r) => r.scrollLongTasks),
      unit: `/${SCROLL_FRAMES} frames`,
    },
    { metric: 'runs (N)', value: runs.length },
  )
  return rows
}

// ── In-page pieces ────────────────────────────────────────────────────────────────────────────

/** Stamps the first frame after the last row exists. Installed before any page script. */
const FIRST_RENDER_INIT = `(() => {
  const poll = () => {
    if (document.querySelector('tbody tr:nth-child(${FIXTURE.rows})')) {
      requestAnimationFrame(() => { window.__tableFirstRender = performance.now(); });
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
})();`

type Burst = { latencies: number[]; misses: number }

async function measureSort(page: Page, header: SortColumn): Promise<Burst> {
  return page.evaluate(
    async ([name, cycles, perCycle, signatureRows, timeout]) => {
      const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
      const th = [...document.querySelectorAll<HTMLElement>('thead th')].find(
        (h) => h.textContent?.trim() === name,
      )
      if (!th) throw new Error(`table-perf: no "${name}" column header`)
      // The sort state AND the order of the first rows: an asc click can leave row 1 untouched
      // (the data may already start at the minimum) while `aria-sort` and rows 2..N still move.
      const signature = () =>
        `${th.getAttribute('aria-sort')}|` +
        [...document.querySelectorAll('tbody tr')]
          .slice(0, signatureRows)
          .map((tr) => tr.textContent)
          .join('|')
      const latencies: number[] = []
      let misses = 0
      for (let i = 0; i < cycles * perCycle; i++) {
        const previous = signature()
        const start = performance.now()
        th.click()
        let seen = false
        while (performance.now() - start < timeout) {
          await raf()
          if (signature() !== previous) {
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
      return { latencies, misses }
    },
    [header, SORT_CYCLES, SORT_STATES_PER_CYCLE, SORT_SIGNATURE_ROWS, STEP_TIMEOUT_MS] as [
      string,
      number,
      number,
      number,
      number,
    ],
  )
}

async function measureSearch(page: Page): Promise<Burst> {
  const typed = keystrokeValues(FIXTURE.searchTerm, FIXTURE.searchPrefix)
  return page.evaluate(
    async ([prefix, values, rowCount, timeout]) => {
      const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
      const input = document.querySelector<HTMLInputElement>(
        'input[type="text"], input:not([type])',
      )
      if (!input) throw new Error('table-perf: no search input')
      const rows = () => document.querySelectorAll('tbody tr').length
      // React tracks the value itself: bypass its setter shadow, then fire the event it listens to.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!setter) throw new Error('table-perf: HTMLInputElement has no native value setter')
      const put = (value: string) => {
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
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
      // Setup (not measured): the prefix matches every row, so the count must settle at the full set.
      put(prefix)
      const deadline = performance.now() + timeout
      while (rows() !== rowCount && performance.now() < deadline) await raf()
      if (rows() !== rowCount) {
        throw new Error(`table-perf: "${prefix}" left ${rows()} rows, expected ${rowCount}`)
      }
      await raf()
      const latencies: number[] = []
      let misses = 0
      for (const value of [...values, '']) {
        const ms = await timed(value)
        if (ms === null) misses++
        else latencies.push(ms)
        await raf()
        await raf()
      }
      return { latencies, misses }
    },
    [FIXTURE.searchPrefix, typed, FIXTURE.rows, STEP_TIMEOUT_MS] as [
      string,
      string[],
      number,
      number,
    ],
  )
}

/** Tags the table's vertical scroller (the nearest scrolling ancestor) and returns its range. */
async function tagScroller(page: Page): Promise<number> {
  return page.evaluate((attr) => {
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
    node.setAttribute(attr, '')
    return node.scrollHeight - node.clientHeight
  }, SCROLLER_ATTR)
}

/** Drive the tagged scroller top → bottom, one step per rAF; returns the window bounds. */
async function measureScroll(page: Page, offsets: number[]): Promise<{ t0: number; t1: number }> {
  return page.evaluate(
    async ([targets, attr]) => {
      const raf = () => new Promise<number>((r) => requestAnimationFrame(r))
      const node = document.querySelector<HTMLElement>(`[${attr}]`)
      if (!node) throw new Error('table-perf: scroller was not tagged')
      node.scrollTop = 0
      await raf()
      const t0 = performance.now()
      for (const top of targets) {
        node.scrollTop = top
        await raf()
      }
      return { t0, t1: performance.now() }
    },
    [offsets, SCROLLER_ATTR] as [number[], string],
  )
}

// ── One run ───────────────────────────────────────────────────────────────────────────────────

async function loadRoute(page: Page, baseUrl: string): Promise<number> {
  await page.goto(`${baseUrl}${FIXTURE.route}`, { waitUntil: 'load' })
  await page.waitForFunction(
    () => (window as unknown as { __tableFirstRender?: number }).__tableFirstRender !== undefined,
  )
  const firstRenderMs = await page.evaluate(
    () => (window as unknown as { __tableFirstRender: number }).__tableFirstRender,
  )
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  return firstRenderMs
}

/** The host's own frame cadence with nothing happening; every latency is quantised to it. */
async function idleFrameP50(page: Page): Promise<number> {
  const t0 = await page.evaluate(() => performance.now())
  await page.waitForTimeout(1000)
  const probe = await readProbe(page, t0, await page.evaluate(() => performance.now()))
  return round(percentile(probe.frames, 50))
}

async function oneRun(browser: Browser, baseUrl: string): Promise<RunMetrics> {
  const { context, page } = await freshPage(browser, 1, [PROBE_INIT, FIRST_RENDER_INIT])
  try {
    page.setDefaultTimeout(120_000)
    const firstRenderMs = await loadRoute(page, baseUrl)
    const idleFrameP50Ms = await idleFrameP50(page)

    const sortP50Ms = {} as RunMetrics['sortP50Ms']
    const sortMisses = {} as RunMetrics['sortMisses']
    for (const header of FIXTURE.sortColumns) {
      const sort = await measureSort(page, header)
      sortP50Ms[header] = p50OrNull(sort.latencies)
      sortMisses[header] = sort.misses
    }

    const search = await measureSearch(page)
    await page.waitForTimeout(500)

    const offsets = scrollOffsets(await tagScroller(page), SCROLL_FRAMES)
    const scroll = await measureScroll(page, offsets)
    const scrollProbe = await readProbe(page, scroll.t0, scroll.t1)
    const scrollWindow = summarizeWindow(scrollProbe.frames, scrollProbe.longTasks)

    return {
      firstRenderMs: round(firstRenderMs),
      idleFrameP50Ms,
      sortP50Ms,
      sortMisses,
      searchP50Ms: p50OrNull(search.latencies),
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
  return {
    lane: 'table-perf',
    summary: summaryRows(runs),
    detail: sortKeys({
      route: FIXTURE.route,
      runs: RUNS,
      scrollFrames: SCROLL_FRAMES,
      sortClicksPerColumn: SORT_CYCLES * SORT_STATES_PER_CYCLE,
      perRun: runs,
    }),
  }
}
