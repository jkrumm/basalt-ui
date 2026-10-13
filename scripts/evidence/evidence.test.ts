import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipBytes, routeChunks, routeOfKey, subpathEntries } from './bundle'
import type { Manifest } from './bundle'
import { renderSummary, stableStringify } from './index'
import type { LaneOutcome } from './index'
import {
  chartSlug,
  isInteractive,
  signatureOf,
  summaryRows,
  toSteps,
  uniqueNames,
  verdictOf,
} from './keyboard'
import type { Key, KeyStep } from './keyboard'
import { median } from './perf-util'
import { routeSlug } from './screens'
import { parseRoutes, routesFromDir } from './serve'

// The root bunfig registers happy-dom, which replaces the global `fetch`; `fetch` is the real one.
let dir: string
let origin: string
let server: Bun.Subprocess<'ignore', 'pipe', 'inherit'>

// The root bunfig registers happy-dom, which replaces `fetch` (use `Bun.fetch`) and `Response` — so the server
// runs in a child started outside the repo, where bun loads no preload.
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'evidence-test-'))
  mkdirSync(join(dir, 'dist/assets'), { recursive: true })
  writeFileSync(join(dir, 'dist/index.html'), '<!doctype html>shell')
  writeFileSync(join(dir, 'dist/assets/app.js'), 'export const a = 1')
  const entry = join(import.meta.dirname, 'serve.ts')
  server = Bun.spawn(
    [
      'bun',
      '-e',
      `import { serveDist } from ${JSON.stringify(entry)}; console.log(serveDist(process.argv[1]).origin)`,
      join(dir, 'dist'),
    ],
    { cwd: dir, stdout: 'pipe' },
  )
  const reader = server.stdout.getReader()
  origin = new TextDecoder().decode((await reader.read()).value).trim()
})
afterAll(() => {
  server.kill()
  rmSync(dir, { recursive: true, force: true })
})

describe('serveDist', () => {
  it('serves files, falls back to the shell for extensionless paths, 404s missing assets', async () => {
    expect(await (await Bun.fetch(`${origin}/assets/app.js`)).text()).toBe('export const a = 1')
    expect(await (await Bun.fetch(`${origin}/charts`)).text()).toContain('shell')
    expect((await Bun.fetch(`${origin}/assets/missing.js`)).status).toBe(404)
  })

  it('gzips text assets on request and never leaves the dist root', async () => {
    const gz = await Bun.fetch(`${origin}/assets/app.js`, {
      headers: { 'accept-encoding': 'gzip' },
    })
    expect(gz.headers.get('content-encoding')).toBe('gzip')
    expect(await gz.text()).toBe('export const a = 1')
    const escaped = await Bun.fetch(`${origin}/..%2f..%2fetc%2fpasswd.txt`)
    expect(escaped.status).toBe(404)
  })
})

describe('routes', () => {
  it('derives URL paths from route files, deduping layouts and skipping __root', () => {
    const routes = join(dir, 'routes')
    mkdirSync(join(routes, 'dashboard'), { recursive: true })
    for (const f of [
      '__root.tsx',
      'index.tsx',
      'charts.tsx',
      'dashboard.tsx',
      'dashboard/index.tsx',
      'dashboard/revenue.tsx',
    ]) {
      writeFileSync(join(routes, f), '')
    }
    expect(routesFromDir(routes)).toEqual(['/', '/charts', '/dashboard', '/dashboard/revenue'])
  })

  it('parses a routes file, ignoring blanks and comments', () => {
    expect(parseRoutes('# argo\n/overview\n\n  /metrics  \n')).toEqual(['/overview', '/metrics'])
  })

  it('slugs routes for file names', () => {
    expect(routeSlug('/')).toBe('root')
    expect(routeSlug('/dashboard/revenue')).toBe('dashboard-revenue')
  })
})

describe('bundle', () => {
  const manifest: Manifest = {
    'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_shared.js'] },
    '_shared.js': { file: 'assets/shared.js' },
    '_chart.js': { file: 'assets/chart.js', css: ['assets/chart.css'] },
    'src/routes/charts.tsx?tsr-split=component': {
      file: 'assets/charts.js',
      imports: ['_shared.js', '_chart.js'],
    },
  }
  const size: Record<string, number> = {
    'assets/index.js': 100,
    'assets/shared.js': 10,
    'assets/chart.js': 40,
    'assets/chart.css': 5,
    'assets/charts.js': 7,
  }

  it('splits a route into its own chunk and the cost beyond the initial load', () => {
    const { initialGz, routes } = routeChunks(manifest, (f) => size[f] ?? 0)
    expect(initialGz).toBe(110)
    expect(routes).toEqual([{ route: 'charts', ownGz: 7, incrementalGz: 52 }])
  })

  it('maps manifest keys to routes', () => {
    expect(routeOfKey('src/routes/dashboard/revenue.tsx?tsr-split=component')).toBe(
      'dashboard/revenue',
    )
    expect(routeOfKey('index.html')).toBeNull()
  })

  it('keeps only concrete js/css subpaths, sorted', () => {
    expect(
      subpathEntries({
        './z': { import: './dist/z.js' },
        '.': { import: './dist/index.js' },
        './configs/*': './configs/*',
        './llms.txt': './llms.txt',
        './styles.css': './dist/styles.css',
      }),
    ).toEqual([
      ['.', './dist/index.js'],
      ['./styles.css', './dist/styles.css'],
      ['./z', './dist/z.js'],
    ])
  })

  it('gzips deterministically', () => {
    const data = new TextEncoder().encode('x'.repeat(1000))
    expect(gzipBytes(data)).toBe(gzipBytes(data))
  })
})

describe('routeChunks ordering', () => {
  it('sorts multiple routes by name regardless of manifest order', () => {
    const manifest: Manifest = {
      'index.html': { file: 'assets/main.js', isEntry: true },
      'src/routes/zeta.tsx?tsr-split=component': { file: 'assets/zeta.js' },
      'src/routes/alpha.tsx?tsr-split=component': { file: 'assets/alpha.js' },
      'src/routes/mid/index.tsx?tsr-split=component': { file: 'assets/mid.js' },
    }
    const { routes } = routeChunks(manifest, () => 1)
    expect(routes.map((r) => r.route)).toEqual(['alpha', 'mid/index', 'zeta'])
  })
})

describe('output', () => {
  it('median of odd and even samples', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('renders non-finite values as n/a', () => {
    const outcomes = new Map<string, LaneOutcome>([
      [
        'otel',
        { status: 'ok', result: { lane: 'otel', summary: [{ metric: 'p50', value: Number.NaN }] } },
      ],
    ])
    expect(renderSummary('t', outcomes)).toContain('|p50|n/a||')
  })

  it('stableStringify sorts keys recursively', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: [{ z: 1, y: 2 }] } })).toBe(
      stableStringify({ a: { c: [{ y: 2, z: 1 }], d: 1 }, b: 1 }),
    )
  })

  it('renders absent, failed and ok lanes with minimum table separators', () => {
    const outcomes = new Map<string, LaneOutcome>([
      [
        'bundle',
        {
          status: 'ok',
          result: { lane: 'bundle', summary: [{ metric: 'a|b', value: 1, unit: 'B' }] },
        },
      ],
      ['otel', { status: 'absent' }],
      ['screens', { status: 'failed', error: 'boom\nstack' }],
    ])
    const md = renderSummary('t', outcomes)
    expect(md).toContain('|Metric|Value|Unit|\n|-|-|-|\n|a\\|b|1|B|')
    expect(md).toContain('## otel\n\nlane absent')
    expect(md).toContain('lane failed: boom')
    expect(md).not.toContain('stack')
    expect(renderSummary('t', outcomes)).toBe(md)
  })
})

const step = (key: Key, moved: boolean): KeyStep => ({ key, signature: key, moved })

describe('keyboard lane (pure parts)', () => {
  it('slugs labels and de-duplicates names', () => {
    expect(chartSlug('Revenue by day (EUR)')).toBe('revenue-by-day-eur')
    expect(chartSlug('***')).toBe('chart')
    expect(uniqueNames(['A', 'B', 'A', 'A'])).toEqual(['A', 'B', 'A #2', 'A #3'])
    expect(uniqueNames(['A', 'A #2', 'A'])).toEqual(['A', 'A #2', 'A #3'])
  })

  it('marks a step moved only when the signature differs from the previous one', () => {
    const steps = toSteps('s0', [
      { key: 'ArrowRight', signature: 's1' },
      { key: 'ArrowRight', signature: 's1' },
      { key: 'Home', signature: 's0' },
    ])
    expect(steps.map((s) => s.moved)).toEqual([true, false, true])
    expect(signatureOf(' a ', ' x\n y ')).toBe('a | x y')
  })

  it('FAILs a focusable chart that ignores ArrowRight but answers the pointer', () => {
    const still = [step('ArrowRight', false), step('Home', true)]
    const walk = { tabIndex: '0', focusable: true, hoverTooltip: true, steps: still }
    expect(verdictOf(walk)).toEqual({ status: 'FAIL', moved: 1, total: 2 })
    expect(verdictOf({ ...walk, hoverTooltip: null }).status).toBe('FAIL')
    expect(verdictOf({ ...walk, focusable: false }).status).toBe('FAIL')
    expect(verdictOf({ ...walk, steps: [step('ArrowRight', true)] }).status).toBe('PASS')
  })

  it('classifies non-interactive charts as N/A and reports them apart from failures', () => {
    expect(isInteractive('0')).toBe(true)
    expect(isInteractive('-1')).toBe(false)
    expect(isInteractive(null)).toBe(false)
    const still = [step('ArrowRight', false)]
    // Not tabbable, and the engine's tabindex=0 Sparkline (no keyboard, no tooltip) both read N/A.
    const untabbable = {
      name: 'T',
      view: 'v',
      tabIndex: '-1',
      focusable: false,
      hoverTooltip: null,
      steps: [],
    }
    const spark = {
      name: 'S',
      view: 'v',
      tabIndex: '0',
      focusable: true,
      hoverTooltip: false,
      steps: still,
    }
    const bad = {
      name: 'A',
      view: 'v',
      tabIndex: '0',
      focusable: true,
      hoverTooltip: true,
      steps: still,
    }
    expect(verdictOf(untabbable).status).toBe('N/A')
    expect(verdictOf(spark)).toEqual({ status: 'N/A', moved: 0, total: 1 })
    expect(summaryRows([bad, spark, untabbable]).slice(0, 3)).toEqual([
      { metric: 'charts walked', value: 3 },
      { metric: 'charts failing', value: 1 },
      { metric: 'charts N/A (non-interactive)', value: 2 },
    ])
  })
})
