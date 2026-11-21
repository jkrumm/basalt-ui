import { describe, expect, test } from 'bun:test'
import { selectMatrix } from './matrix-select'

const ids = new Set(['mdx', 'expr-n87', 'expr-n88'])
const none = () => ''
const run = (changed: string[], diffs: Record<string, string> = {}) =>
  selectMatrix({ changed, ids, diffOf: (f) => diffs[f] ?? none() })

describe('selectMatrix', () => {
  test('skips when no input changed', () => {
    expect(run(['docs/validation.md', 'scripts/layout-select.ts']).mode).toBe('skip')
  })

  test('a branch of new scenarios runs those routes only', () => {
    const sel = run(
      [
        'apps/playground/src/scenarios/expr/n87/ExprN87.tsx',
        'apps/playground/src/scenarios/expr/n88/DESIGN.md',
        'apps/playground/src/scenarios/registry.tsx',
        'apps/playground/src/scenarios/scenario-info.ts',
        'apps/playground/src/demo/series.ts',
      ],
      {
        'apps/playground/src/scenarios/registry.tsx':
          "+import { ExprN87Scenario } from './expr/n87/ExprN87'\n",
        'apps/playground/src/scenarios/scenario-info.ts': "+  {\n+    id: 'expr-n87',\n",
        'apps/playground/src/demo/series.ts': '+export const N87_SERIES = {}\n',
      },
    )
    expect(sel).toMatchObject({
      mode: 'routes',
      routes: ['/scenarios/expr-n87', '/scenarios/expr-n88'],
    })
  })

  test('a changed line in the registry runs everything', () => {
    const sel = run(['apps/playground/src/scenarios/registry.tsx'], {
      'apps/playground/src/scenarios/registry.tsx': '-  mdx: a,\n+  mdx: b,\n',
    })
    expect(sel.mode).toBe('all')
  })

  test.each([
    'packages/basalt-ui/src/charts/Meter.tsx',
    'packages/basalt-ui/tests/quality/matrix/known.ts',
    'apps/playground/src/routes/table.tsx',
    'apps/playground/src/scenarios/ScenarioView.tsx',
    'apps/playground/src/scenarios/linked-windows/LinkedWindows.tsx',
    'bun.lock',
  ])('a shared input runs everything: %s', (file) => {
    expect(run(['apps/playground/src/scenarios/expr/n87/ExprN87.tsx', file]).mode).toBe('all')
  })

  test('a scenario folder that is not registered runs everything', () => {
    expect(run(['apps/playground/src/scenarios/expr/n99/ExprN99.tsx']).mode).toBe('all')
  })

  test('additive registry lines without a nameable route run everything', () => {
    const sel = run(['apps/playground/src/demo/series.ts'], {
      'apps/playground/src/demo/series.ts': '+export const X = {}\n',
    })
    expect(sel.mode).toBe('all')
  })
})
