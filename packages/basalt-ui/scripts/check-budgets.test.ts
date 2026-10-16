/**
 * `check-budgets` — the provider-only budget's two seams: which module ids count as basalt's own
 * graph (everything else is an external peer), and how an unmeasurable provider-only row exits.
 *
 * The exit-code tests point the fixture at a TEMP dist (absent, or a syntax error) rather than
 * moving the real `dist/`, which other suites read concurrently.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { devOnlyChunks, featureRuntimeChunks, isOwnGraphId, runBudgets } from './check-budgets'

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
