/**
 * Spike S5 (docs/v3/concepts/data-table.md section 9 S5, Contract Exception E1). Throwaway harness, no tests.
 *
 * Bytes, by the method of docs/v3/concepts/quality-contract.md section 6 (Vite 8 production build,
 * peers bundled, `gzipSync` over every chunk, minus `base0` built in the same run):
 *   engineFixtureGz  the 10-feature engine through `createTableHook` (`scripts/fixtures/table-engine.tsx`)
 *   ownCodeGz        `fixture/table.tsx` (a shipped `DataTable`) minus `fixture/floor.tsx` (the engine plus
 *                    every `ui/*` symbol the table imports, with the `core/*` those pull in)
 * Both on the version `packages/basalt-ui` pins and on TanStack Table 9.3.1 (`*931`).
 *
 * Time, real Chrome, 10k rows in a windowed body, sort click to second animation frame, 1 warm-up and
 * 11 measured runs per arm, arms interleaved round by round so host load hits all three alike:
 *   direct      `flexRender(columnDef.cell, ...)`, stable columns   (virtual10kMs)
 *   app         the same cell inside `<table.AppCell>`              (appCellMs)
 *   perRender   direct cell, a new column array every render
 * Spread = (max - min) / median; above 20% on any arm reruns the measurement once; still above 20%
 * voids the run: exit 1, no verdict. Prints ONE JSON object on stdout; exit 0 means the harness ran,
 * not that the hypothesis held. Progress goes to stderr.
 */
import { loadavg } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser } from 'playwright-core'
import { build } from 'vite'
import type { Plugin } from 'vite'
import { BASE0, gzipBytes } from '../../../packages/basalt-ui/scripts/check-budgets/provider-v3'
import type { AppBundle } from '../../../packages/basalt-ui/scripts/check-budgets/provider-v3'

const ROOT = import.meta.dir
const PKG = resolve(ROOT, '../../../packages/basalt-ui')
const RUNS = 11
const SPREAD_LIMIT = 20
const OWN_LIMIT = 18_000
const APP_CELL_LIMIT_PCT = 10
const VIRTUAL_LIMIT_MS = 150
const TIMED = 'Name'
const RESET = 'Amount'

const log = (msg: string): void => void process.stderr.write(`${msg}\n`)
const r2 = (n: number): number => Math.round(n * 100) / 100
const median = (xs: number[]): number => {
  const s = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}
const spreadPct = (xs: number[]): number => ((Math.max(...xs) - Math.min(...xs)) / median(xs)) * 100
/** Section 6: measured +5%, rounded up to 0.5 KB (1 KB is 1000 B). */
const ceiling = (bytes: number): number => Math.ceil((bytes * 1.05) / 500) * 500

const table931 = join(ROOT, 'node_modules/table-931')

type Version = 'pinned' | '931'

async function bundle(entry: string, version: Version): Promise<AppBundle> {
  // The fixtures sit outside the package, so React and the engine are resolved as if from the package:
  // one copy each (the package's own) in both arms, and 9.3.1 swapped in for the engine alone. A plugin,
  // not an alias, so the package's `exports` conditions apply and the bytes match `scripts/fixtures`.
  const fromPackage: Plugin = {
    name: 'from-package',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      // The 9.3.1 arm swaps the engine for every importer; React is pinned to the package's copy for what
      // lives under the harness (its fixtures and the 9.3.1 copy). The package otherwise resolves itself.
      if (version === '931' && id === '@tanstack/react-table')
        return this.resolve(table931, undefined, options)
      if (importer?.startsWith(ROOT) !== true) return null
      if (!/^(react|react-dom|@tanstack\/react-table)(\/|$)/.test(id)) return null
      return this.resolve(id, join(PKG, 'index.ts'), { ...options, skipSelf: true })
    },
  }
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PKG,
    plugins: [fromPackage],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry, formats: ['es'] } },
  })
  const out = Array.isArray(result) ? result[0] : result
  if (out === undefined || !('output' in out)) throw new Error(`no output for ${entry}`)
  const chunks = out.output.flatMap((o) => (o.type === 'chunk' ? [o] : []))
  if (chunks.length === 0) throw new Error(`no chunk for ${entry}`)
  return { chunks, graph: [] }
}

const ENGINE = join(PKG, 'scripts/fixtures/table-engine.tsx')
const TABLE = join(ROOT, 'fixture/table.tsx')
const FLOOR = join(ROOT, 'fixture/floor.tsx')

async function bytesFor(version: Version): Promise<{ engine: number; own: number; table: number }> {
  const base0 = gzipBytes(await bundle(BASE0, version))
  const engine = gzipBytes(await bundle(ENGINE, version)) - base0
  const floor = gzipBytes(await bundle(FLOOR, version)) - base0
  const table = gzipBytes(await bundle(TABLE, version)) - base0
  return { engine, own: table - floor, table }
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:14px/1.4 system-ui,sans-serif;color:#222;background:#fff}
.scroller{height:480px;overflow:auto;width:900px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
tr{height:32px}
th,td{padding:0 8px;text-align:left;overflow:hidden;white-space:nowrap}
`

const ARMS = {
  direct: 'cell=direct&cols=stable',
  app: 'cell=app&cols=stable',
  perRender: 'cell=direct&cols=render',
} as const
type Arm = keyof typeof ARMS
type Samples = Record<Arm, number[]>

async function measureAll(browser: Browser, baseUrl: string): Promise<Samples> {
  const arms = Object.keys(ARMS) as Arm[]
  const pages = new Map<Arm, Awaited<ReturnType<Browser['newPage']>>>()
  for (const arm of arms) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
    page.on('pageerror', (e) => log(`pageerror ${arm}: ${e.message}`))
    await page.goto(`${baseUrl}/?${ARMS[arm]}`)
    await page.waitForSelector('th button')
    pages.set(arm, page)
  }
  const run = async (arm: Arm): Promise<number> => {
    const page = pages.get(arm)
    if (page === undefined) throw new Error(arm)
    await page.bringToFront()
    const sort = (h: string): Promise<number> =>
      page.evaluate(
        (x) => (window as never as { sortOnce(h: string): Promise<number> }).sortOnce(x),
        h,
      )
    await sort(RESET)
    return sort(TIMED)
  }
  for (const arm of arms) await run(arm) // warm-up
  const samples: Samples = { direct: [], app: [], perRender: [] }
  for (let i = 0; i < RUNS; i++) for (const arm of arms) samples[arm].push(r2(await run(arm)))
  for (const page of pages.values()) await page.close()
  return samples
}

const worstSpread = (s: Samples): number =>
  Math.max(spreadPct(s.direct), spreadPct(s.app), spreadPct(s.perRender))

async function main(): Promise<void> {
  log('bytes: pinned')
  const pinned = await bytesFor('pinned')
  log('bytes: 9.3.1')
  const v931 = await bytesFor('931')

  const app = await bundle(join(ROOT, 'fixture/app.tsx'), 'pinned')
  const code = app.chunks.map((c) => c.code).join('\n')
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      if (new URL(req.url).pathname === '/app.js')
        return new Response(code, { headers: { 'content-type': 'text/javascript' } })
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>S5</title><style>${CSS}</style></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>`,
        { headers: { 'content-type': 'text/html' } },
      )
    },
  })
  const baseUrl = `http://localhost:${server.port}`
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'],
  })
  try {
    const chrome = browser.version()
    const loadAvg1m = r2(loadavg()[0] ?? 0)
    log(`load ${loadAvg1m}, Chrome ${chrome}`)
    let samples = await measureAll(browser, baseUrl)
    let rerun = false
    if (worstSpread(samples) > SPREAD_LIMIT) {
      log(`spread ${r2(worstSpread(samples))}% > ${SPREAD_LIMIT}%: rerun once`)
      rerun = true
      samples = await measureAll(browser, baseUrl)
    }
    const direct = median(samples.direct)
    const appCell = median(samples.app)
    const perRender = median(samples.perRender)
    const spread = r2(worstSpread(samples))
    const voided = spread > SPREAD_LIMIT
    const appCellVsDirectPct = r2(((appCell - direct) / direct) * 100)
    const pass =
      pinned.own <= OWN_LIMIT &&
      appCellVsDirectPct <= APP_CELL_LIMIT_PCT &&
      direct <= VIRTUAL_LIMIT_MS
    const result = {
      tanstackTable: { pinned: '9.2.8', compared: '9.3.1' },
      engineFixtureGz: pinned.engine,
      engineFixtureGz931: v931.engine,
      ownCodeGz: pinned.own,
      ownCodeGz931: v931.own,
      tableTotalGz: pinned.table,
      appCellMs: r2(appCell),
      directCellMs: r2(direct),
      appCellVsDirectPct,
      virtual10kMs: r2(direct),
      perRenderColumnsMs: r2(perRender),
      perRenderColumnsVsStablePct: r2(((perRender - direct) / direct) * 100),
      spreadPct: spread,
      spreadPctByArm: {
        direct: r2(spreadPct(samples.direct)),
        app: r2(spreadPct(samples.app)),
        perRender: r2(spreadPct(samples.perRender)),
      },
      proposedRows: {
        engineFixtureBytes: ceiling(Math.max(pinned.engine, v931.engine)),
        ownCodeBytes: ceiling(Math.max(pinned.own, v931.own)),
      },
      samples,
      loadAvg1m,
      rerun,
      chrome,
      ...(voided ? { voided: true } : { verdict: pass ? 'S5: PASS' : 'S5: REFUTED' }),
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (voided) process.exitCode = 1
  } finally {
    await browser.close()
    server.stop(true)
  }
}

await main()
