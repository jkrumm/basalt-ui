/**
 * Shared pieces of the two perf lanes: order statistics, the in-page frame/long-task probe, and
 * the CPU-throttle seam. Everything here is deterministic in SHAPE (fixed keys, fixed rounding);
 * the measured values are of course machine-dependent, which is why a lane records N and the
 * throttle with every number.
 */
import type { BrowserContext, Page } from 'playwright-core'

/** Fixed so a diff between two runs is never a viewport change. */
export const VIEWPORT = { width: 1280, height: 800 } as const
export const DEVICE_SCALE_FACTOR = 1

/** `1` is unthrottled; `4` is Chrome DevTools' "4x slowdown" mid-tier-mobile preset. */
export const THROTTLES = [1, 4] as const
export type Throttle = (typeof THROTTLES)[number]

/** Runs per (lane, throttle) cell. The reported value is the median of the per-run values. */
export const RUNS = 5

export function round(value: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Linear-interpolated percentile, `p` in 0..100. NaN for an empty sample. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const rank = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (rank - lo)
}

export const median = (values: readonly number[]): number => percentile(values, 50)

/** Rejects with `<what> timed out after <ms> ms` if `work` has not settled in time. */
export function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/** Sorted-key copy of a plain record — the committed detail JSON diffs cleanly. */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T
  if (value === null || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeys((value as Record<string, unknown>)[key])
  }
  return out as T
}

/** Window digest of one measured interval: frame-time order statistics plus long-task census. */
export type WindowStats = {
  frames: number
  frameP50: number
  frameP95: number
  frameMax: number
  longTasks: number
  longTaskMs: number
}

export function summarizeWindow(
  frames: readonly number[],
  longTasks: readonly number[],
): WindowStats {
  return {
    frames: frames.length,
    frameP50: round(percentile(frames, 50)),
    frameP95: round(percentile(frames, 95)),
    frameMax: round(frames.length === 0 ? Number.NaN : Math.max(...frames)),
    longTasks: longTasks.length,
    longTaskMs: round(longTasks.reduce((sum, d) => sum + d, 0)),
  }
}

/**
 * Installed BEFORE any page script (`addInitScript`). Samples rAF deltas and `longtask` entries for
 * the whole page life; a lane then reads the slice that falls inside `[t0, t1]` (both
 * `performance.now()` stamps), so setup noise never leaks into a measured window.
 */
export const PROBE_INIT = `(() => {
  const P = { frames: [], long: [], last: null };
  window.__probe = P;
  const loop = (t) => {
    if (P.last !== null) P.frames.push([t, t - P.last]);
    P.last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) P.long.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
})();`

export type ProbeSlice = { frames: number[]; longTasks: number[] }

/** Read the probe samples that FINISHED inside `[t0, t1]`. */
export async function readProbe(page: Page, t0: number, t1: number): Promise<ProbeSlice> {
  return page.evaluate(
    ([from, to]) => {
      const P = (
        window as unknown as { __probe: { frames: [number, number][]; long: [number, number][] } }
      ).__probe
      return {
        frames: P.frames.filter(([t]) => t >= from && t <= to).map(([, d]) => d),
        longTasks: P.long.filter(([s, d]) => s + d >= from && s <= to).map(([, d]) => d),
      }
    },
    [t0, t1] as [number, number],
  )
}

/** CPU throttle through CDP. `1` clears it. Must be applied per page, before navigation. */
export async function throttleCpu(
  context: BrowserContext,
  page: Page,
  rate: Throttle,
): Promise<void> {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
}

/** A fresh, fixed-viewport context — one per run so no run inherits another's storage or cache. */
export async function freshPage(
  browser: import('playwright-core').Browser,
  rate: Throttle,
  initScripts: readonly string[],
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  for (const script of initScripts) await page.addInitScript(script)
  await throttleCpu(context, page, rate)
  return { context, page }
}

/** Cell label for the summary table: `1x` / `4x`. */
export const cell = (rate: Throttle): string => `${rate}x`

/** The visible tooltip(s). Portalled (top layer / under `<body>`), so read it document-wide; a
 * hidden tooltip (cleared focus) reads as `''`. */
export const TOOLTIP_SELECTOR = '.ts-chart-tooltip:not([hidden])'
