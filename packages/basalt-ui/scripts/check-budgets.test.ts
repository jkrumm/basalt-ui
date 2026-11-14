/**
 * `check-budgets` — the provider-only budget's two seams: which module ids count as basalt's own
 * graph (everything else is an external peer), and how an unmeasurable provider-only row exits.
 *
 * The exit-code tests point the fixture at a TEMP dist (absent, or a syntax error) rather than
 * moving the real `dist/`, which other suites read concurrently.
 */
import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { devOnlyChunks, featureRuntimeChunks, isOwnGraphId, runBudgets } from './check-budgets'
import { areaFiles } from './check-budgets/index'
import { ratchetViolations } from './check-budgets/ratchet'

const REAL_AREAS = join(import.meta.dir, 'check-budgets/areas')

// A full run builds every G1 fixture (the ui, cards, charts, data, router and table rows) as well.
setDefaultTimeout(180_000)

describe('isOwnGraphId', () => {
  test.each([
    ['POSIX absolute', '/repo/packages/basalt-ui/dist/index.js'],
    ['relative', './provider/index.js'],
    ['parent-relative', '../common/errors.js'],
    ['Windows drive letter, backslashes', 'C:\\repo\\dist\\index.js'],
    ['Windows drive letter, forward slashes', 'c:/repo/dist/index.js'],
    ['UNC path', '\\\\server\\share\\dist\\index.js'],
    ['Vite virtual id', '\0vite/preload-helper.js'],
  ])('%s is basalt’s own graph', (_, id) => {
    expect(isOwnGraphId(id)).toBe(true)
  })

  test.each([
    ['bare package', 'react'],
    ['scoped package', '@mantine/core'],
    ['package subpath', 'react/jsx-runtime'],
    ['dotted package name', 'lodash.debounce'],
  ])('%s stays external', (_, id) => {
    expect(isOwnGraphId(id)).toBe(false)
  })
})

async function runQuiet({
  reportOnly,
  providerOnlyDist,
}: {
  reportOnly: boolean
  providerOnlyDist: string
}) {
  const lines: string[] = []
  const code = await runBudgets({ reportOnly, providerOnlyDist, log: (l) => lines.push(l) })
  const row = lines.find((l) => l.includes('provider-only first paint'))
  const devRow = lines.find((l) => l.includes('dev-only chunks'))
  return { code, row, devRow }
}

describe('runBudgets with an unmeasurable provider-only row', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'check-budgets-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  const absent = join(scratch, 'no-dist', 'index.js')

  test('dist absent: --report prints a skipped row and exits 0', async () => {
    const { code, row } = await runQuiet({ reportOnly: true, providerOnlyDist: absent })
    expect(code).toBe(0)
    expect(row).toStartWith('- ')
    expect(row).toContain('skipped: dist/ missing')
  })

  test('dist absent: the dev-only row is reported unmeasured too', async () => {
    const { devRow } = await runQuiet({ reportOnly: true, providerOnlyDist: absent })
    expect(devRow).toContain('skipped: dist/ missing')
  })

  test('dist absent: the theme-only row is reported unmeasured too', async () => {
    const lines: string[] = []
    await runBudgets({ reportOnly: true, providerOnlyDist: absent, log: (l) => lines.push(l) })
    const row = lines.find((l) => l.includes('createBasaltTheme only'))
    expect(row).toStartWith('- ')
    expect(row).toContain('skipped: dist/ missing')
  })

  test('dist absent: the gate fails closed', async () => {
    expect((await runQuiet({ reportOnly: false, providerOnlyDist: absent })).code).toBe(1)
  })

  test('a bundler failure prints a readable failed row, not a stack', async () => {
    const broken = join(scratch, 'index.js')
    writeFileSync(broken, 'export const = ;\n')
    const report = await runQuiet({ reportOnly: true, providerOnlyDist: broken })
    expect(report.code).toBe(0)
    expect(report.row).toStartWith('✖ ')
    expect(report.row).toContain('failed: Build failed with 1 error: [PARSE_ERROR]')
    // ANSI stripped — the row is plain text.
    expect(report.row).not.toContain('\u001b[')
    expect(report.devRow).toStartWith('✖ ')
    expect(report.devRow).toContain('failed: Build failed')
    expect((await runQuiet({ reportOnly: false, providerOnlyDist: broken })).code).toBe(1)
  })
})

describe('devOnlyChunks', () => {
  const chunk = (
    fileName: string,
    moduleIds: string[] = [],
    dynamicImports: string[] = [],
    imports: string[] = [],
  ) => ({ fileName, moduleIds, imports, dynamicImports })

  test('flags the dock, the theme lab and devtools peers; spares the rest', () => {
    const flagged = devOnlyChunks([
      chunk('basalt-ui.js', ['/dist/provider/index.js', '/dist/tokens/derive.js']),
      chunk('a.js', ['/dist/dev-dock.js']),
      chunk('b.js', ['C:\\pkg\\dist\\theme-lab\\boot.js']),
      chunk('c.js', ['/dist/a.js'], ['@tanstack/react-router-devtools']),
    ])
    expect(flagged).toEqual(['a.js', 'b.js', 'c.js'])
  })

  test('a hashed fileName alone is enough', () => {
    expect(devOnlyChunks([chunk('assets/dev-dock-AbC123.js', ['/x/y.js'])])).toEqual([
      'assets/dev-dock-AbC123.js',
    ])
    expect(devOnlyChunks([chunk('theme-lab-D_4MCStT.js')])).toEqual(['theme-lab-D_4MCStT.js'])
  })

  test('near-misses do not match', () => {
    expect(
      devOnlyChunks([
        chunk('devtools-utils.js', ['/dist/devtools-utils.js']),
        chunk('x.js', ['/dist/xdevtools-helper.js', '/dist/my-dev-docker.js']),
      ]),
    ).toEqual([])
  })

  test('a clean production graph yields nothing', () => {
    expect(devOnlyChunks([chunk('basalt-ui.js', ['/dist/provider/index.js'])])).toEqual([])
  })

  // The two source shapes, as the bundler sees them: module-scope `lazy(import())` keeps the dock
  // chunk (the regression); the NODE_ENV-gated ternary folds it away in production.
  test('old module-scope lazy shape is caught; the gated shape is clean', async () => {
    const { build } = await import('vite')
    const emit = async (source: string) => {
      const dir = mkdtempSync(join(tmpdir(), 'dev-shape-'))
      try {
        writeFileSync(join(dir, 'dev-dock.js'), 'export const BasaltDevDock = () => null\n')
        writeFileSync(join(dir, 'entry.js'), source)
        const out = await build({
          configFile: false,
          logLevel: 'silent',
          root: dir,
          define: { 'process.env.NODE_ENV': '"production"' },
          build: {
            write: false,
            minify: true,
            lib: { entry: join(dir, 'entry.js'), formats: ['es'] },
            rolldownOptions: { external: ['react'] },
          },
        })
        const bundle = Array.isArray(out) ? out[0] : out
        if (bundle === undefined || !('output' in bundle)) throw new Error('no output')
        return devOnlyChunks(bundle.output.flatMap((o) => (o.type === 'chunk' ? [o] : [])))
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
    const old =
      "import { lazy } from 'react'\nexport const D = lazy(() => import('./dev-dock.js'))\nexport const on = process.env.NODE_ENV !== 'production' && D\n"
    const gated =
      "import { lazy } from 'react'\nexport const D = process.env.NODE_ENV !== 'production' ? lazy(() => import('./dev-dock.js')) : null\n"
    expect((await emit(old)).length).toBeGreaterThan(0)
    expect(await emit(gated)).toEqual([])
  })
})

describe('featureRuntimeChunks', () => {
  const chunk = (fileName: string, moduleIds: string[] = []) => ({ fileName, moduleIds })

  test('flags a chunk holding spotlight, modals or either hotkeys package, in any install layout', () => {
    expect(
      featureRuntimeChunks([
        chunk('entry.js', ['/repo/node_modules/@mantine/spotlight/esm/Spotlight.mjs']),
        chunk('a.js', [
          '/repo/node_modules/.bun/@mantine+modals@9/node_modules/@mantine/modals/esm/x.mjs',
        ]),
        chunk('b.js', ['/r/node_modules/@tanstack/hotkeys/dist/manager.js']),
        chunk('c.js', ['C:\\r\\node_modules\\@tanstack\\react-hotkeys\\dist\\index.js']),
      ]),
    ).toEqual(['entry.js', 'a.js', 'b.js', 'c.js'])
  })

  test('spares basalt’s own modules and neighbouring packages', () => {
    expect(
      featureRuntimeChunks([
        chunk('entry.js', [
          '/dist/provider/index.js',
          '/dist/provider/spotlight-mount.js',
          '/repo/node_modules/@mantine/core/esm/index.mjs',
          '/repo/node_modules/@mantine/notifications/esm/index.mjs',
          '/repo/node_modules/@tanstack/react-query/build/index.js',
        ]),
      ]),
    ).toEqual([])
  })
})

/** A self-contained area file: one row `r` at `ceiling`, plus raw `raises` source. */
const fixtureArea = (ceiling: number, raises = '[]') =>
  `export const rows = [{ id: 'r', order: 1, label: 'r', ceiling: ${ceiling}, measure: () => 1 }]\n` +
  `export const raises = ${raises}\n`

const raiseRow = (repo: string, { from = 100, to = 120, consumer = 'a screen' } = {}) =>
  `[{ ceiling: 'r', from: ${from}, to: ${to}, consumer: '${consumer}', repo: '${repo}' }]`

describe('ratchet', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'check-budgets-ratchet-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  /**
   * Write `current` as an area file and ratchet it against `base` (`null` = no base file). Each
   * file gets a fresh directory: Bun caches a directory's listing, so a file added to one that was
   * already imported from is not found.
   */
  async function ratchet(current: string, base: string | null) {
    const file = join(mkdtempSync(join(scratch, 'f-')), 'fix.ts')
    writeFileSync(file, current)
    return ratchetViolations({ files: [file], readBase: () => base })
  }

  test('a raised ceiling with no row fails', async () => {
    const [violation, ...rest] = await ratchet(fixtureArea(120), fixtureArea(100))
    expect(rest).toEqual([])
    expect(violation).toContain('ceiling 100 → 120')
    expect(violation).toContain('no raise row')
  })

  test('a row naming a repo other than argo passes', async () => {
    expect(await ratchet(fixtureArea(120, raiseRow('rollhook')), fixtureArea(100))).toEqual([])
  })

  test('a row naming argo fails, in any casing', async () => {
    for (const repo of ['argo', ' Argo ']) {
      const [violation] = await ratchet(fixtureArea(120, raiseRow(repo)), fixtureArea(100))
      expect(violation).toContain('names argo')
    }
  })

  test('a row without a repo or a consumer fails', async () => {
    const [noRepo] = await ratchet(fixtureArea(120, raiseRow('')), fixtureArea(100))
    expect(noRepo).toContain('names no repo')
    const noConsumer = raiseRow('rb', { consumer: ' ' })
    const [violation] = await ratchet(fixtureArea(120, noConsumer), fixtureArea(100))
    expect(violation).toContain('names no consumer')
  })

  test('a row for another step does not cover the raise', async () => {
    const stale = raiseRow('rb', { from: 90 })
    expect(await ratchet(fixtureArea(120, stale), fixtureArea(100))).toHaveLength(1)
  })

  test('a lowered or unchanged ceiling passes', async () => {
    expect(await ratchet(fixtureArea(80), fixtureArea(100))).toEqual([])
    expect(await ratchet(fixtureArea(100), fixtureArea(100))).toEqual([])
  })

  test('no base file passes', async () => {
    expect(await ratchet(fixtureArea(999), null)).toEqual([])
  })

  test('a row new to an existing area passes', async () => {
    const extra = "rows.push({ id: 'n', order: 2, label: 'n', ceiling: 5000, measure: () => 1 })\n"
    expect(await ratchet(fixtureArea(100) + extra, fixtureArea(100))).toEqual([])
  })

  test('a row moved to another area file keeps its base ceiling', async () => {
    const dir = mkdtempSync(join(scratch, 'move-'))
    const from = join(dir, 'old.ts')
    const to = join(dir, 'new.ts')
    writeFileSync(from, 'export const rows = []\n')
    writeFileSync(to, fixtureArea(120))
    const readBase = (file: string) => (file === from ? fixtureArea(100) : null)
    const [violation, ...rest] = await ratchetViolations({ files: [from, to], readBase })
    expect(rest).toEqual([])
    expect(violation).toContain('new/r: ceiling 100 → 120')
  })

  test('the real area files load as their own base, imports resolved', async () => {
    const files = areaFiles(REAL_AREAS)
    expect(files.length).toBeGreaterThan(0)
    const readBase = (file: string) => readFileSync(file, 'utf8')
    expect(await ratchetViolations({ files, readBase })).toEqual([])
  })
})

describe('area discovery', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'check-budgets-areas-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  test('areas/zz-fixture.ts in a copy is picked up with index.ts and ratchet.ts unedited', async () => {
    const src = join(import.meta.dir, 'check-budgets')
    mkdirSync(join(scratch, 'areas'))
    for (const name of ['index.ts', 'ratchet.ts', 'lib.ts']) {
      copyFileSync(join(src, name), join(scratch, name))
    }
    writeFileSync(join(scratch, 'areas/zz-fixture.ts'), fixtureArea(7))

    const copy = (await import(pathToFileURL(join(scratch, 'index.ts')).href)) as {
      runBudgets: typeof runBudgets
    }
    const lines: string[] = []
    const code = await copy.runBudgets({ reportOnly: false, log: (l) => lines.push(l) })

    expect(code).toBe(0)
    expect(lines[0]).toStartWith('✓ r')
    expect(lines.at(-1)).toContain('all 1 budgets within ceiling')
  })

  test('rows print in `order` across areas; a repeated id is refused', async () => {
    const dir = mkdtempSync(join(scratch, 'order-'))
    const row = (id: string, order: number) =>
      `{ id: '${id}', order: ${order}, label: '${id}', ceiling: 1, measure: () => 1 }`
    writeFileSync(join(dir, 'a.ts'), `export const rows = [${row('late', 20)}]\n`)
    writeFileSync(join(dir, 'b.ts'), `export const rows = [${row('early', 10)}]\n`)
    const run = (lines: string[]) =>
      runBudgets({
        reportOnly: true,
        areasDir: dir,
        readBase: () => null,
        log: (l) => lines.push(l),
      })

    const lines: string[] = []
    await run(lines)
    expect(lines.slice(0, 2).map((l) => l.slice(2).trim().split(/\s+/)[0])).toEqual([
      'early',
      'late',
    ])

    writeFileSync(join(dir, 'c.ts'), `export const rows = [${row('early', 30)}]\n`)
    await expect(run([])).rejects.toThrow('defined twice')
  })

  test('a directory with no area files fails instead of passing empty', async () => {
    const dir = mkdtempSync(join(scratch, 'empty-'))
    const run = runBudgets({
      reportOnly: false,
      areasDir: dir,
      readBase: () => null,
      log: () => {},
    })
    await expect(run).rejects.toThrow('no area files')
  })
})
