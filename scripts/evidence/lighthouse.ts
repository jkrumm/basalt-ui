/**
 * Lighthouse lane — performance score, LCP, TBT and CLS for three routes, mobile and desktop
 * presets, median of N runs (`EVIDENCE_LH_RUNS`, default 3). Launches its own headless Google
 * Chrome through chrome-launcher because Lighthouse needs a plain CDP port, which a Playwright
 * server does not expose; it is the same installed Chrome.
 */
import { launch } from 'chrome-launcher'
import { loadRoutes } from './serve'
import type { Lane } from './types'

const DEFAULT_ROUTES = ['/', '/charts', '/data']
const RUN_TIMEOUT_MS = 120_000
const METRICS = ['score', 'lcp', 'tbt', 'cls'] as const
type Metric = (typeof METRICS)[number]
type Sample = Record<Metric, number>

export function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

const withTimeout = <T>(work: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

export const lighthouse: Lane = async ({ baseUrl }) => {
  const runs = Number(process.env['EVIDENCE_LH_RUNS'] ?? 3)
  const configured = process.env['EVIDENCE_ROUTES'] ? (await loadRoutes()).slice(0, 3) : []
  const routes = configured.length ? configured : DEFAULT_ROUTES

  const { default: run } = await import('lighthouse')
  const { default: desktopConfig } = await import('lighthouse/core/config/desktop-config.js')
  const presets = [
    { name: 'mobile', config: undefined },
    { name: 'desktop', config: desktopConfig },
  ] as const

  const chrome = await launch({
    chromeFlags: ['--headless=new', ...(process.env['CI'] ? ['--no-sandbox'] : [])],
  })
  const summary: Array<{ metric: string; value: number | string; unit?: string }> = []
  const detail: Record<string, unknown> = {}
  try {
    for (const route of routes) {
      for (const preset of presets) {
        const samples: Sample[] = []
        for (let i = 0; i < runs; i++) {
          const result = await withTimeout(
            run(
              baseUrl + route,
              {
                port: chrome.port,
                output: 'json',
                logLevel: 'error',
                onlyCategories: ['performance'],
              },
              preset.config,
            ),
            RUN_TIMEOUT_MS,
            `lighthouse ${preset.name} ${route}`,
          )
          const lhr = result?.lhr
          if (!lhr) throw new Error(`lighthouse returned no result for ${route}`)
          samples.push({
            score: (lhr.categories['performance']?.score ?? 0) * 100,
            lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
            tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
            cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? 0,
          })
        }
        const med = (m: Metric): number => median(samples.map((s) => s[m]))
        const prefix = `${route} ${preset.name}`
        summary.push(
          { metric: `${prefix} score`, value: Math.round(med('score')) },
          { metric: `${prefix} LCP`, value: Math.round(med('lcp')), unit: 'ms' },
          { metric: `${prefix} TBT`, value: Math.round(med('tbt')), unit: 'ms' },
          { metric: `${prefix} CLS`, value: Number(med('cls').toFixed(3)) },
        )
        detail[prefix] = samples
      }
    }
  } finally {
    chrome.kill()
  }
  summary.push({ metric: 'runs per cell (median of)', value: runs })
  return { lane: 'lighthouse', summary, detail: { runs, samples: detail } }
}
