/**
 * SSR lane (V2-SPEC § 9, Wave 10) — a streaming server render of the dashboard shapes, measured twice.
 *
 * The fixture (`ssr-fixture/`) is the pattern under test: `BasaltProvider` + a TanStack Router instance
 * rendered by `renderToReadableStream` through the router's own `createRequestHandler` /
 * `renderRouterToStream`; the shell holds no promise, each of four sections (KPI row, line chart, bar
 * chart, `BasaltDataTable`) gets an UNAWAITED loader promise with a fixed artificial delay
 * (`SECTION_DELAYS_MS`) rendered through `<Await>` inside `<Suspense>` with a fixed-height fallback.
 *
 *  - server    Node-free: `fetch` the page and time every chunk. Shell flush = ms to the first chunk that
 *              carries the shell; per-section completion = ms to the chunk that carries its content.
 *              Median of `RUNS`.
 *  - browser   real Chrome, fresh context per run, at 1x and 4x CPU. TTFB, shell visible, per-section
 *              in-DOM (the streamed content has arrived, still in React's hidden `S:n` div) and reveal
 *              (outside any `[hidden]` ancestor; React batches reveals), both from a MutationObserver,
 *              CLS (layout-shift entries without recent input), hydration (mark before `hydrateRoot` →
 *              first effect after commit) and the console errors the page raised. Median of `RUNS`.
 *
 * The fixture is built from `packages/basalt-ui/dist` (`basalt-ui` resolves to the package), so the
 * lane measures the published artifact; `make evidence` builds it first.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Page } from 'playwright-core'
import {
  FALLBACK_ATTR,
  MARK_HYDRATE_END,
  MARK_HYDRATE_START,
  READY_ATTR,
  SECTION_DELAYS_MS,
  SECTION_KEYS,
  SHELL_ATTR,
} from './ssr-fixture/contract'
import type { SectionKey } from './ssr-fixture/contract'
import { startFixtureServer } from './ssr-fixture/serve'
import { RUNS, THROTTLES, freshPage, medianOrNull, round, sortKeys } from './perf-util'
import type { SummaryRow, Throttle } from './perf-util'
import type { Lane } from './types'

const DIST_ENTRY = resolve(import.meta.dirname, '../../packages/basalt-ui/dist/index.js')
/** Not a bot: `renderRouterToStream` buffers the whole document for crawlers (`isbot`) — curl, Bun's fetch and headless Chrome's own `HeadlessChrome` UA included. */
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
/** Quiet time after the last section is in and hydration has committed, so late layout shifts count. */
const SETTLE_MS = 500
const RUN_TIMEOUT_MS = 20_000
/** Errors kept per run in the detail JSON, and how much of each. */
const ERROR_SAMPLES = 3
const ERROR_SAMPLE_CHARS = 200

// ── Pure helpers (unit-tested; no browser, no server) ─────────────────────────────────────────

export type Chunk = { ms: number; text: string; bytes: number }

export type StreamStats = {
  chunks: number
  bytes: number
  firstChunkMs: number
  /** Ms to the chunk that completes the shell marker; `null` if none did. */
  shellMs: number | null
  /** Ms to the chunk that completes each section's marker; `null` when it never arrived. */
  sectionMs: Record<SectionKey, number | null>
  totalMs: number
}

const readyMarker = (key: SectionKey): string => `${READY_ATTR}="${key}"`

/**
 * Chunk list (time-ordered) → the stream's shape. Markers are searched in the CONCATENATED text, so
 * one split across two reads still counts, at the time of the chunk that completes it; the first
 * occurrence wins. An empty stream reports `NaN` times, never a guess.
 */
export function analyzeStream(chunks: readonly Chunk[]): StreamStats {
  const full = chunks.map((c) => c.text).join('')
  const ends: number[] = []
  let total = 0
  for (const chunk of chunks) ends.push((total += chunk.text.length))
  const completedAt = (marker: string): number | null => {
    const at = full.indexOf(marker)
    if (at < 0) return null
    const end = at + marker.length
    return chunks[ends.findIndex((e) => e >= end)]?.ms ?? null
  }
  return {
    chunks: chunks.length,
    bytes: chunks.reduce((sum, c) => sum + c.bytes, 0),
    firstChunkMs: chunks[0]?.ms ?? Number.NaN,
    shellMs: completedAt(SHELL_ATTR),
    sectionMs: Object.fromEntries(
      SECTION_KEYS.map((k) => [k, completedAt(readyMarker(k))]),
    ) as Record<SectionKey, number | null>,
    totalMs: chunks.at(-1)?.ms ?? Number.NaN,
  }
}

export type LayoutShift = { value: number; hadRecentInput: boolean }

/** CLS as the sum of the shifts the user did not cause. */
export const clsOf = (shifts: readonly LayoutShift[]): number =>
  shifts.reduce((sum, s) => (s.hadRecentInput ? sum : sum + s.value), 0)

/** What the in-page probe hands back. Times are `performance.now()` stamps (ms since navigation start). */
export type BrowserRaw = {
  ttfb: number | null
  fcp: number | null
  shellMs: number | null
  arrived: Record<SectionKey, number | null>
  revealed: Record<SectionKey, number | null>
  shifts: LayoutShift[]
  hydrateStart: number | null
  hydrateEnd: number | null
  errors: string[]
}

export type BrowserRun = {
  ttfbMs: number | null
  fcpMs: number | null
  shellMs: number | null
  arrivedMs: Record<SectionKey, number | null>
  revealedMs: Record<SectionKey, number | null>
  cls: number
  hydrateStartMs: number | null
  hydrationMs: number | null
  errors: number
  /** First lines of the first few errors, for the detail JSON. */
  errorSamples: string[]
}

/** A finite number, rounded; anything else (`undefined`, `NaN`, a non-number) reads as `null`. */
const roundOrNull = (v: unknown, digits = 1): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? round(v, digits) : null

const roundTimes = (times: Record<SectionKey, number | null>): Record<SectionKey, number | null> =>
  Object.fromEntries(SECTION_KEYS.map((k) => [k, roundOrNull(times[k])])) as Record<
    SectionKey,
    number | null
  >

export function foldBrowserRun(raw: BrowserRaw): BrowserRun {
  const hydrateStart = roundOrNull(raw.hydrateStart)
  const hydrateEnd = roundOrNull(raw.hydrateEnd)
  return {
    ttfbMs: roundOrNull(raw.ttfb),
    fcpMs: roundOrNull(raw.fcp),
    shellMs: roundOrNull(raw.shellMs),
    arrivedMs: roundTimes(raw.arrived),
    revealedMs: roundTimes(raw.revealed),
    cls: round(clsOf(raw.shifts), 4),
    hydrateStartMs: hydrateStart,
    hydrationMs:
      hydrateStart === null || hydrateEnd === null ? null : round(hydrateEnd - hydrateStart),
    errors: raw.errors.length,
    errorSamples: raw.errors
      .slice(0, ERROR_SAMPLES)
      .map((e) => e.split('\n')[0]!.slice(0, ERROR_SAMPLE_CHARS)),
  }
}

/** Per-section median over runs. */
const medianBySection = <T>(
  runs: readonly T[],
  pick: (run: T) => Record<SectionKey, number | null>,
): Record<SectionKey, number | null> =>
  Object.fromEntries(
    SECTION_KEYS.map((k) => [k, medianOrNull(runs.map((r) => pick(r)[k]))]),
  ) as Record<SectionKey, number | null>

export type ServerAgg = {
  firstChunkMs: number | null
  shellMs: number | null
  sectionMs: Record<SectionKey, number | null>
  totalMs: number | null
  chunks: number | null
  bytes: number | null
}

const finite = (v: number): number | null => (Number.isFinite(v) ? v : null)

export function aggregateServer(runs: readonly StreamStats[]): ServerAgg {
  return {
    firstChunkMs: medianOrNull(runs.map((r) => finite(r.firstChunkMs))),
    shellMs: medianOrNull(runs.map((r) => r.shellMs)),
    sectionMs: medianBySection(runs, (r) => r.sectionMs),
    totalMs: medianOrNull(runs.map((r) => finite(r.totalMs))),
    chunks: medianOrNull(
      runs.map((r) => r.chunks),
      0,
    ),
    bytes: medianOrNull(
      runs.map((r) => r.bytes),
      0,
    ),
  }
}

export type BrowserAgg = {
  ttfbMs: number | null
  fcpMs: number | null
  shellMs: number | null
  arrivedMs: Record<SectionKey, number | null>
  revealedMs: Record<SectionKey, number | null>
  cls: number | null
  hydrateStartMs: number | null
  hydrationMs: number | null
  errors: number
  /** Runs in which every section was revealed and hydration finished. */
  complete: number
  runs: number
}

export function aggregateBrowser(runs: readonly BrowserRun[]): BrowserAgg {
  return {
    ttfbMs: medianOrNull(runs.map((r) => r.ttfbMs)),
    fcpMs: medianOrNull(runs.map((r) => r.fcpMs)),
    shellMs: medianOrNull(runs.map((r) => r.shellMs)),
    arrivedMs: medianBySection(runs, (r) => r.arrivedMs),
    revealedMs: medianBySection(runs, (r) => r.revealedMs),
    cls: medianOrNull(
      runs.map((r) => r.cls),
      4,
    ),
    hydrateStartMs: medianOrNull(runs.map((r) => r.hydrateStartMs)),
    hydrationMs: medianOrNull(runs.map((r) => r.hydrationMs)),
    errors: runs.reduce((sum, r) => sum + r.errors, 0),
    complete: runs.filter(
      (r) => r.hydrationMs !== null && SECTION_KEYS.every((k) => r.revealedMs[k] !== null),
    ).length,
    runs: runs.length,
  }
}

/** `n/a` for a metric no run produced; the md renderer prints non-finite as `n/a`, so `NaN` carries that. */
const val = (v: number | null): number => v ?? Number.NaN

export function summaryRows(
  server: ServerAgg,
  browser: ReadonlyMap<Throttle, BrowserAgg>,
): SummaryRow[] {
  const rows: SummaryRow[] = SECTION_KEYS.map((k) => ({
    metric: `floor: ${k} loader delay`,
    value: SECTION_DELAYS_MS[k],
    unit: 'ms',
  }))
  rows.push(
    { metric: 'server: first chunk', value: val(server.firstChunkMs), unit: 'ms' },
    { metric: 'server: shell flush', value: val(server.shellMs), unit: 'ms' },
    ...SECTION_KEYS.map((k) => ({
      metric: `server: ${k} complete`,
      value: val(server.sectionMs[k]),
      unit: 'ms',
    })),
    { metric: 'server: stream end', value: val(server.totalMs), unit: 'ms' },
    { metric: 'server: stream chunks', value: val(server.chunks), unit: 'chunks' },
    { metric: 'server: document size', value: val(server.bytes), unit: 'bytes' },
  )
  for (const [rate, agg] of browser) {
    const at = `${rate}x`
    rows.push(
      { metric: `browser ${at}: TTFB`, value: val(agg.ttfbMs), unit: 'ms' },
      { metric: `browser ${at}: FCP`, value: val(agg.fcpMs), unit: 'ms' },
      { metric: `browser ${at}: shell visible`, value: val(agg.shellMs), unit: 'ms' },
      ...SECTION_KEYS.map((k) => ({
        metric: `browser ${at}: ${k} in DOM`,
        value: val(agg.arrivedMs[k]),
        unit: 'ms',
      })),
      ...SECTION_KEYS.map((k) => ({
        metric: `browser ${at}: ${k} revealed`,
        value: val(agg.revealedMs[k]),
        unit: 'ms',
      })),
      { metric: `browser ${at}: hydration start`, value: val(agg.hydrateStartMs), unit: 'ms' },
      { metric: `browser ${at}: hydration`, value: val(agg.hydrationMs), unit: 'ms' },
      { metric: `browser ${at}: CLS`, value: val(agg.cls), unit: 'score' },
      { metric: `browser ${at}: console errors`, value: agg.errors, unit: 'count (all runs)' },
      { metric: `browser ${at}: complete runs`, value: `${agg.complete}/${agg.runs}` },
    )
  }
  return rows
}

// ── Server-side measurement ───────────────────────────────────────────────────────────────────

async function measureStream(origin: string): Promise<StreamStats> {
  const t0 = performance.now()
  const response = await fetch(`${origin}/`, {
    headers: { 'user-agent': CHROME_UA },
    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
  })
  if (!response.ok || !response.body) throw new Error(`ssr: GET / answered ${response.status}`)
  const decoder = new TextDecoder()
  const chunks: Chunk[] = []
  for await (const value of response.body) {
    chunks.push({
      ms: round(performance.now() - t0),
      text: decoder.decode(value, { stream: true }),
      bytes: value.byteLength,
    })
  }
  return analyzeStream(chunks)
}

// ── Browser-side measurement ──────────────────────────────────────────────────────────────────

/**
 * Installed before any page script. Records, against `performance.now()`: when the shell element and
 * each section's content first appear in the DOM (`arrived`) and first sit outside every `[hidden]`
 * ancestor (`revealed` — React streams a boundary into a hidden `S:n` div and then moves it).
 */
const PROBE = `(() => {
  const keys = ${JSON.stringify(SECTION_KEYS)};
  const S = { shellMs: null, arrived: {}, revealed: {}, shifts: [] };
  for (const k of keys) { S.arrived[k] = null; S.revealed[k] = null; }
  window.ssrProbe = S;
  const scan = () => {
    const t = performance.now();
    if (S.shellMs === null && document.querySelector('[${SHELL_ATTR}]')) S.shellMs = t;
    for (const k of keys) {
      const el = document.querySelector('[${READY_ATTR}="' + k + '"]');
      if (!el) continue;
      if (S.arrived[k] === null) S.arrived[k] = t;
      if (S.revealed[k] === null && !el.closest('[hidden]')) S.revealed[k] = t;
    }
  };
  new MutationObserver(scan).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'],
  });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) S.shifts.push({ value: e.value, hadRecentInput: e.hadRecentInput });
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
})();`

async function measureBrowserRun(
  browser: import('playwright-core').Browser,
  origin: string,
  rate: Throttle,
): Promise<BrowserRun> {
  const { context, page } = await freshPage(browser, rate, [PROBE])
  await context.setExtraHTTPHeaders({ 'user-agent': CHROME_UA })
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.goto(`${origin}/`, { waitUntil: 'commit' })
    // A run whose sections or hydration never finish is kept, as an incomplete run: the missing
    // times read `null` and the `complete runs` row counts it out.
    await page
      .waitForFunction(
        ([end, keys]) => {
          const s = (window as unknown as { ssrProbe: { revealed: Record<string, number | null> } })
            .ssrProbe
          return (
            performance.getEntriesByName(end).length > 0 &&
            keys.every((k) => s.revealed[k] !== null)
          )
        },
        [MARK_HYDRATE_END, [...SECTION_KEYS]] as [string, string[]],
        { timeout: RUN_TIMEOUT_MS },
      )
      .catch((error: unknown) => {
        errors.push(`run incomplete: ${error instanceof Error ? error.message : String(error)}`)
      })
    await page.waitForTimeout(SETTLE_MS)
    return foldBrowserRun(await readRaw(page, errors))
  } finally {
    await context.close().catch(() => undefined)
  }
}

async function readRaw(page: Page, errors: string[]): Promise<BrowserRaw> {
  const raw = await page.evaluate(
    ([startMark, endMark]) => {
      const s = (
        window as unknown as {
          ssrProbe: Pick<BrowserRaw, 'shellMs' | 'arrived' | 'revealed' | 'shifts'>
        }
      ).ssrProbe
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      const mark = (name: string): number | null =>
        performance.getEntriesByName(name)[0]?.startTime ?? null
      return {
        ttfb: nav?.responseStart ?? null,
        fcp: fcp?.startTime ?? null,
        shellMs: s.shellMs,
        arrived: s.arrived,
        revealed: s.revealed,
        shifts: s.shifts,
        hydrateStart: mark(startMark!),
        hydrateEnd: mark(endMark!),
      }
    },
    [MARK_HYDRATE_START, MARK_HYDRATE_END] as const,
  )
  return { ...raw, errors }
}

// ── Lane ──────────────────────────────────────────────────────────────────────────────────────

export const ssr: Lane = async (ctx) => {
  if (!existsSync(DIST_ENTRY)) {
    throw new Error(
      'ssr: packages/basalt-ui/dist is missing — run `bun run build` in the package first',
    )
  }
  const buildDir = join(ctx.outDir, 'ssr-fixture')
  await mkdir(buildDir, { recursive: true })
  const server = await startFixtureServer(buildDir)
  try {
    // Warm-up: the first render pays module and JIT cost no later request does.
    await measureStream(server.origin)
    const streams: StreamStats[] = []
    for (let i = 0; i < RUNS; i++) streams.push(await measureStream(server.origin))

    const browser = await ctx.openBrowser()
    const runs = new Map<Throttle, BrowserRun[]>()
    for (const rate of THROTTLES) {
      const list: BrowserRun[] = []
      for (let i = 0; i < RUNS; i++)
        list.push(await measureBrowserRun(browser, server.origin, rate))
      runs.set(rate, list)
    }

    const serverAgg = aggregateServer(streams)
    const browserAgg = new Map<Throttle, BrowserAgg>(
      [...runs].map(([rate, list]) => [rate, aggregateBrowser(list)]),
    )
    return {
      lane: 'ssr',
      summary: summaryRows(serverAgg, browserAgg),
      detail: sortKeys({
        runs: RUNS,
        fallbackSelector: `[${FALLBACK_ATTR}]`,
        server: { aggregate: serverAgg, runs: streams },
        browser: Object.fromEntries([...runs].map(([rate, list]) => [`${rate}x`, list])),
      }),
    }
  } finally {
    server.stop()
  }
}
