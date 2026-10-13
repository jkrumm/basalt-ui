/**
 * The `otel` evidence lane: drives the served playground through a fixed route list with an
 * in-process OTLP receiver attached and summarises the spans the consumer-side telemetry emitted.
 *
 * The build under test MUST be made with `VITE_TELEMETRY=1` (see `apps/playground/src/main.tsx`);
 * the exporter URL is injected at runtime through `window.__BASALT_OTLP__`, so no endpoint is
 * baked into the build.
 */
import { median, round } from './perf-util'
import { startOtelReceiver } from './otel-receiver'
import type { CollectedSpan } from './otel-receiver'
import type { Lane } from './types'

/** Fixed order, fixed viewport: the same navigation script every run. */
export const OTEL_ROUTES = [
  '/dashboard',
  '/charts',
  '/components',
  '/data',
  '/forms',
  '/content',
  '/commands',
  '/notifications',
  '/agent',
  '/cbbi',
  '/settings',
] as const
export const OTEL_RUNS = 3
const VIEWPORT = { width: 1280, height: 800 }

/** Pure summary of one run's spans — the part the unit test pins. */
export function summarise(spans: CollectedSpan[]): {
  counts: Record<string, number>
  navigateDurations: number[]
  errors: number
} {
  const counts: Record<string, number> = {}
  for (const s of spans) counts[s.name] = (counts[s.name] ?? 0) + 1
  return {
    counts: Object.fromEntries(Object.entries(counts).toSorted(([a], [b]) => a.localeCompare(b))),
    navigateDurations: spans.filter((s) => s.name === 'route.navigate').map((s) => s.duration),
    errors: spans.filter((s) => s.failed).length,
  }
}

/** Zero spans means the build under test was made without `VITE_TELEMETRY=1` — fail, don't report 0s. */
export function assertSpansObserved(count: number): void {
  if (count === 0) {
    throw new Error('otel: no spans received — was the playground built with VITE_TELEMETRY=1?')
  }
}

export const otel: Lane = async (ctx) => {
  const browser = await ctx.openBrowser()
  const receiver = startOtelReceiver()
  const perRunNavigate: number[] = []
  const countsPerRun: Array<Record<string, number>> = []
  let errors = 0
  let pageErrors = 0
  const missedLinks: string[] = []
  try {
    for (let run = 0; run < OTEL_RUNS; run++) {
      const before = receiver.spans().length
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
      await context.addInitScript((url) => {
        Object.assign(window, { __BASALT_OTLP__: url })
      }, receiver.url)
      const page = await context.newPage()
      page.on('pageerror', () => pageErrors++)
      await page.goto(ctx.baseUrl, { waitUntil: 'networkidle' })
      await page.locator('a:visible').first().waitFor()
      for (const route of OTEL_ROUTES) {
        // Real in-app navigation: a sidebar/nav anchor, never a full page load.
        const link = page.locator(`a:is([href="${route}"],[href^="${route}?"]):visible`).first()
        if ((await link.count()) === 0) {
          missedLinks.push(route)
          continue
        }
        await link.click()
        await page.waitForURL((u) => u.pathname === route)
        await page.waitForLoadState('networkidle')
      }
      // Batch processor flushes every 300 ms; leave room for the last batch.
      await page.waitForTimeout(1000)
      await context.close()
      const mine = receiver.spans().slice(before)
      const s = summarise(mine)
      errors += s.errors
      countsPerRun.push(s.counts)
      perRunNavigate.push(median(s.navigateDurations))
    }
  } finally {
    receiver.stop()
  }
  assertSpansObserved(receiver.spans().length)
  const all = summarise(receiver.spans())
  const perRun = (n: string): number => median(countsPerRun.map((c) => c[n] ?? 0))
  return {
    lane: 'otel',
    summary: [
      { metric: 'runs', value: OTEL_RUNS },
      { metric: 'spans.route.navigate', value: perRun('route.navigate'), unit: 'per run' },
      { metric: 'spans.render.error', value: perRun('render.error'), unit: 'per run' },
      { metric: 'spans.window.error', value: perRun('window.error'), unit: 'per run' },
      {
        metric: 'route.navigate.p50',
        value: round(median(perRunNavigate)),
        unit: 'ms',
      },
      { metric: 'errors', value: errors },
      { metric: 'page errors', value: pageErrors },
      { metric: 'routes without a visible link', value: missedLinks.length },
    ],
    detail: {
      counts: all.counts,
      missedLinks,
      countsPerRun,
      perRunNavigateP50: perRunNavigate,
      routes: OTEL_ROUTES,
    },
  }
}
