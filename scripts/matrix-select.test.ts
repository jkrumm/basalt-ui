import { describe, expect, test } from 'bun:test'
import {
  EXPRESSION_INDEX,
  routePaths,
  scenarioPaths,
} from '../packages/basalt-ui/tests/quality/matrix/routes'
import {
  CAP_CELLS,
  SMOKE_PARTS,
  SMOKE_ROUTES,
  astroModel,
  qualityModel,
  selectAstro,
  selectMatrix,
} from './matrix-select'
import type { PageModel, Selection } from './matrix-select'

const ROOT = new URL('..', import.meta.url).pathname
const quality = qualityModel(ROOT)
const astro = astroModel(ROOT)

const run = (
  changed: string[],
  { diffs = {}, model = quality }: { diffs?: Record<string, string>; model?: PageModel } = {},
): Selection => selectMatrix({ changed, model, exists: () => true, diffOf: (f) => diffs[f] ?? '' })

const pagesOf = (sel: Selection): string[] => (sel.mode === 'pages' ? sel.pages : [])
/** The routes whose render imports `file`, read from the model the selection reads. */
const rendering = (file: string): string[] =>
  [...quality.pages].filter(([, files]) => files.has(file)).map(([route]) => route)

describe('the graph of the real tree', () => {
  test('every import of the playgrounds resolves to a file or a dependency', () => {
    expect(quality.unresolved).toEqual([])
    expect(astro.unresolved).toEqual([])
  })

  test('its pages are the routes and scenarios the matrix runs', () => {
    expect(new Set(quality.pages.keys())).toEqual(
      new Set([...routePaths(), EXPRESSION_INDEX, ...scenarioPaths()]),
    )
  })

  test('its cells are the sampled matrix: two per route of routes.ts, two per page of the hover guard', () => {
    const pages = new Set([...routePaths(), EXPRESSION_INDEX, ...scenarioPaths()])
    const cells = [...quality.pages.keys()].reduce((sum, page) => sum + quality.cost(page), 0)
    expect(cells).toBe(2 * (routePaths().length + 1) + 2 * pages.size)
  })

  test('the smoke sets name real pages, one per family', () => {
    for (const route of SMOKE_ROUTES) expect(quality.pages.has(route)).toBe(true)
    expect(SMOKE_ROUTES.reduce((sum, route) => sum + quality.cost(route), 0)).toBeLessThanOrEqual(
      CAP_CELLS,
    )
    for (const part of SMOKE_PARTS) expect(astro.pages.has(part)).toBe(true)
    expect(
      new Set(
        SMOKE_PARTS.map((part) => [...astro.families].find(([, ids]) => ids.includes(part))?.[0]),
      ),
    ).toEqual(new Set(astro.families.keys()))
  })
})

describe('selectMatrix', () => {
  test('skips when no input changed', () => {
    expect(run(['docs/validation.md', 'scripts/layout-select.ts']).mode).toBe('skip')
  })

  test('one primitive runs every route that renders it', () => {
    // A primitive few pages render: radio-group joined every table with the manage-view panel.
    const file = 'packages/basalt-ui/src/ui/date-picker.tsx'
    const sel = run([file])
    expect(rendering(file)).toContain('/kit/forms/dates')
    expect(sel.mode).toBe('pages')
    expect(pagesOf(sel)).toEqual(rendering(file).toSorted())
  })

  test.each([
    ['a token sheet', 'packages/basalt-ui/src/css/tokens.css'],
    ['a token module', 'packages/basalt-ui/src/tokens/derive.ts'],
    ['table.css', 'packages/basalt-ui/src/table/table.css'],
    ['the lockfile', 'bun.lock'],
    ['a deleted file', 'gone'],
  ])('%s runs the smoke set', (_, file) => {
    const changed = file === 'gone' ? 'packages/basalt-ui/src/ui/gone.tsx' : file
    const sel = selectMatrix({
      changed: [changed],
      model: quality,
      exists: (f) => f !== 'packages/basalt-ui/src/ui/gone.tsx',
      diffOf: () => '',
    })
    expect(pagesOf(sel)).toEqual([...SMOKE_ROUTES])
  })

  test.each([
    'packages/basalt-ui/tests/quality/matrix/known.ts',
    'packages/basalt-ui/tests/support/test-browser.ts',
    'packages/basalt-ui/src/testing/quality.ts',
  ])('the harness runs everything: %s', (file) => {
    expect(run(['packages/basalt-ui/src/ui/radio-group.tsx', file]).mode).toBe('all')
  })

  test('a scenario runs its own route', () => {
    expect(pagesOf(run(['apps/expression/src/scenarios/expr/n87/ExprN87.tsx']))).toEqual([
      '/scenarios/expr-n87',
    ])
  })

  test("a fixture of the expression app runs the routes that import it, none of the playground's", () => {
    const file = 'apps/expression/src/scenarios/expr/c12/fixture.ts'
    const sel = run([file])
    expect(rendering(file)).toContain('/scenarios/expr-c12')
    expect(pagesOf(sel)).toEqual(rendering(file).toSorted())
    expect(pagesOf(sel).every((route) => route.startsWith('/scenarios/expr-'))).toBe(true)
  })

  test('a module of the expression shell runs the smoke set, which carries the expression index', () => {
    expect(pagesOf(run(['apps/expression/src/routes/__root.tsx']))).toEqual([...SMOKE_ROUTES])
    expect(SMOKE_ROUTES).toContain(EXPRESSION_INDEX)
  })

  test('the playground keeps no expression scenario to run', () => {
    expect(pagesOf(run(['apps/playground/src/scenarios/mdx-scenario.tsx']))).toEqual([
      '/scenarios/mdx',
    ])
  })

  test('a branch of new scenarios runs those routes only', () => {
    const sel = run(
      [
        'apps/expression/src/scenarios/expr/n87/ExprN87.tsx',
        'apps/expression/src/scenarios/expr/n88/DESIGN.md',
        'apps/expression/src/scenarios/registry.tsx',
        'apps/expression/src/scenarios/scenario-info.ts',
        'apps/expression/src/demo/series.ts',
      ],
      {
        diffs: {
          'apps/expression/src/scenarios/registry.tsx':
            "+import { ExprN87Scenario } from './expr/n87/ExprN87'\n",
          'apps/expression/src/scenarios/scenario-info.ts': "+  {\n+    id: 'expr-n88',\n",
          'apps/expression/src/demo/series.ts': '+export const N87_SERIES = {}\n',
        },
      },
    )
    expect(pagesOf(sel)).toEqual(['/scenarios/expr-n87', '/scenarios/expr-n88'])
  })

  test('a changed line in the registry reaches every scenario: the smoke set', () => {
    const sel = run(['apps/expression/src/scenarios/registry.tsx'], {
      diffs: {
        'apps/expression/src/scenarios/registry.tsx': "-  'expr-c10': a,\n+  'expr-c10': b,\n",
      },
    })
    expect(pagesOf(sel)).toEqual([...SMOKE_ROUTES])
  })

  test('a deleted test runs nothing', () => {
    const sel = selectMatrix({
      changed: ['packages/basalt-ui/src/ui/gone.test.tsx'],
      model: quality,
      exists: () => false,
      diffOf: () => '',
    })
    expect(sel.mode).toBe('skip')
  })

  test('a source no page imports runs nothing', () => {
    expect(
      run(['packages/basalt-ui/src/cli/index.ts', 'packages/basalt-ui/src/ui/button.test.tsx'])
        .mode,
    ).toBe('skip')
  })

  test('a file the graph cannot read runs the smoke set', () => {
    expect(pagesOf(run(['apps/playground/public/icon.png']))).toEqual([...SMOKE_ROUTES])
  })
})

describe('the cap', () => {
  const page = (n: number): string => `/p${String(n).padStart(2, '0')}`
  /** forty pages of four cells; `a.ts` reaches the first `n` of them */
  const model = (n: number): PageModel => ({
    pages: new Map(
      Array.from({ length: 40 }, (_, i) => [
        page(i),
        new Set(i < n ? ['apps/playground/src/a.ts'] : []),
      ]),
    ),
    shared: new Set(['apps/playground/src/shell.ts']),
    harness: new Set(),
    cost: () => 4,
  })
  const smoke = (m: PageModel, changed: string[]) =>
    selectMatrix({ changed, model: m, exists: () => true, diffOf: () => '' })

  test('a reach under the cap runs whole', () => {
    expect(pagesOf(smoke(model(12), ['apps/playground/src/a.ts']))).toHaveLength(12)
  })

  test('a reach over the cap runs the smoke set and an even sample, within the cap', () => {
    const sel = smoke(model(18), ['apps/playground/src/a.ts'])
    expect(sel.mode).toBe('pages')
    if (sel.mode !== 'pages') return
    expect(sel.cost).toBeLessThanOrEqual(CAP_CELLS)
    for (const route of SMOKE_ROUTES) expect(sel.pages).toContain(route)
    expect(sel.pages.filter((p) => p.startsWith('/p')).length).toBeGreaterThan(0)
  })

  test('a reach of most pages, or a shared module, runs the smoke set alone', () => {
    expect(pagesOf(smoke(model(30), ['apps/playground/src/a.ts']))).toEqual([...SMOKE_ROUTES])
    expect(pagesOf(smoke(model(0), ['apps/playground/src/shell.ts']))).toEqual([...SMOKE_ROUTES])
  })
})

describe('selectAstro', () => {
  const runAstro = (changed: string[]): Selection =>
    selectAstro({ changed, model: astro, exists: () => true, diffOf: () => '' }, astro.families)

  test('skips when no input changed', () => {
    expect(runAstro(['apps/playground/src/routes/table.tsx']).mode).toBe('skip')
  })

  test('a primitive runs the parts that render it', () => {
    const parts = pagesOf(runAstro(['packages/basalt-ui/src/ui/radio-group.tsx']))
    expect(parts).toContain('radio-group')
    expect(parts.length).toBeLessThan(astro.pages.size)
  })

  test('a token sheet, table.css and the build config run the smoke set', () => {
    for (const file of [
      'packages/basalt-ui/src/css/tokens.css',
      'packages/basalt-ui/src/table/table.css',
      'packages/basalt-ui/tsup.config.ts',
    ])
      expect(pagesOf(runAstro([file]))).toEqual([...SMOKE_PARTS])
  })

  test('never every part: the matrix scripts run the smoke set, a record line its part', () => {
    expect(pagesOf(runAstro(['apps/playground-astro/scripts/measure.ts']))).toEqual([
      ...SMOKE_PARTS,
    ])
    const record = (diff: string): Selection =>
      selectAstro(
        {
          changed: ['docs/v3/verdicts/astro-matrix.json'],
          model: astro,
          exists: () => true,
          diffOf: () => diff,
        },
        astro.families,
      )
    expect(
      pagesOf(record('-    {"id":"badge","family":"ui"}\n+    {"id":"badge","family":"ui"}\n')),
    ).toEqual(['badge'])
    expect(pagesOf(record('-    "js": 72967,\n+    "js": 72968,\n'))).toEqual([...SMOKE_PARTS])
  })

  test("a family's entries run that family", () => {
    expect(pagesOf(runAstro(['apps/playground-astro/src/parts/table/index.ts']))).toEqual(
      [...(astro.families.get('table') ?? [])].toSorted(),
    )
  })

  test("the package's tests, docs and gates run nothing", () => {
    expect(
      runAstro([
        'packages/basalt-ui/tests/cli/init.test.ts',
        'packages/basalt-ui/README.md',
        'packages/basalt-ui/scripts/check-budgets/areas/ui.ts',
        'packages/basalt-ui/configs/oxlint-app.json',
      ]).mode,
    ).toBe('skip')
  })
})
