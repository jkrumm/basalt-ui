import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipBytes, routeChunks, routeOfKey, subpathEntries } from './bundle'
import type { Manifest } from './bundle'
import { renderSummary, stableStringify } from './index'
import type { LaneOutcome } from './index'
import { median } from './lighthouse'
import { routeSlug } from './screens'
import { parseRoutes, routesFromDir } from './serve'

// The root bunfig registers happy-dom, which replaces the global `fetch`; `fetch` is the real one.
let dir: string
let origin: string
let server: ReturnType<typeof Bun.spawn>

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

describe('output', () => {
  it('median of odd and even samples', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
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
