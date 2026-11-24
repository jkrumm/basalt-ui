import { describe, expect, test } from 'bun:test'
import { isAlwaysOn, selectUnit } from './unit-select'

const S = 'packages/basalt-ui/src'
const tests = [
  'tests/oxlint-preset-sync.test.ts',
  'tests/agent-doc-drift.test.ts',
  'packages/basalt-ui/scripts/check-coverage.test.ts',
  'packages/basalt-ui/tests/drift.test.ts',
  'scripts/merge-guard.test.ts',
  S + '/styles.floor.test.ts',
  S + '/charts/dim-floor.test.ts',
  S + '/ui/button.test.tsx',
  'apps/playground/src/budget.test.ts',
  'apps/expression/src/scenarios/scenarios.test.ts',
]
const texts = new Map<string, string>([
  [S + '/charts/dim-floor.test.ts', "readFileSync(join(dir, 'heatmap.tsx'))"],
  [S + '/ui/button.test.tsx', "import { Button } from './button'"],
  ['apps/playground/src/budget.test.ts', "readdirSync('routes')"],
])
const read = (test: string) => texts.get(test) ?? ''
const pick = (changed: string[]) => selectUnit({ changed, tests, read })

describe('isAlwaysOn', () => {
  test('the cross-cutting locations are always on, a src folder and the apps are not', () => {
    expect(isAlwaysOn('tests/surfaces-coverage.test.ts')).toBe(true)
    expect(isAlwaysOn('scripts/release.test.ts')).toBe(true)
    expect(isAlwaysOn('packages/basalt-ui/scripts/gen-llms.test.ts')).toBe(true)
    expect(isAlwaysOn('packages/basalt-ui/tests/drift.test.ts')).toBe(true)
    expect(isAlwaysOn(S + '/styles.floor.test.ts')).toBe(true)
    expect(isAlwaysOn(S + '/ui/button.test.tsx')).toBe(false)
    expect(isAlwaysOn('tests/oxlint-preset-smoke.test.ts')).toBe(false)
    expect(isAlwaysOn('packages/basalt-ui/scripts/gen-docs.test.ts')).toBe(false)
    expect(isAlwaysOn('packages/basalt-ui/tests/cli/hook.test.ts')).toBe(false)
    expect(isAlwaysOn('apps/playground/src/budget.test.ts')).toBe(false)
  })
})

describe('selectUnit', () => {
  test('a src change keeps the always-on set and leaves the folder tests to bun --changed', () => {
    const { mode, always } = pick([S + '/ui/button.tsx'])
    expect(mode).toBe('changed')
    expect(always).toEqual([
      'apps/expression/src/scenarios/scenarios.test.ts',
      'apps/playground/src/budget.test.ts',
      'packages/basalt-ui/scripts/check-coverage.test.ts',
      S + '/styles.floor.test.ts',
      'packages/basalt-ui/tests/drift.test.ts',
      'scripts/merge-guard.test.ts',
      'tests/agent-doc-drift.test.ts',
      'tests/oxlint-preset-sync.test.ts',
    ])
  })

  test('a test that names a changed file by its file name joins the always-on set', () => {
    const { always, reasons } = pick([S + '/charts/parts/heatmap.tsx'])
    expect(always).toContain(S + '/charts/dim-floor.test.ts')
    expect(reasons.join('\n')).toContain(
      'dim-floor.test.ts  <- names ' + S + '/charts/parts/heatmap.tsx',
    )
  })

  test('a test that names the folder of a changed file joins it, a file elsewhere does not', () => {
    const hook = 'packages/basalt-ui/tests/cli/hook.test.ts'
    texts.set(hook, "join(PKG, 'test/fixtures/hook'); join(PKG, 'src/cli/index.ts')")
    const all = [...tests, hook]
    const pickAll = (changed: string[]) => selectUnit({ changed, tests: all, read })
    expect(pickAll(['packages/basalt-ui/test/fixtures/hook/a.json']).always).toContain(hook)
    expect(pickAll([S + '/cli/doctor.ts']).always).toContain(hook)
    expect(pickAll([S + '/ui/button.tsx']).always).not.toContain(hook)
    texts.delete(hook)
  })

  test('a package change runs the apps tests, which import the package through dist; a docs change does not', () => {
    const apps = 'apps/playground/src/budget.test.ts'
    expect(pick([S + '/ui/button.tsx']).always).toContain(apps)
    expect(pick(['packages/basalt-ui/agent/rules/x.md']).always).toContain(apps)
    expect(pick(['docs/v3/x.md']).always).not.toContain(apps)
    expect(pick([S + '/ui/button.test.tsx']).always).not.toContain(apps)
  })

  test("the expression app's tests follow the same rule as the playground's", () => {
    const expression = 'apps/expression/src/scenarios/scenarios.test.ts'
    expect(isAlwaysOn(expression)).toBe(false)
    expect(pick([S + '/ui/button.tsx']).always).toContain(expression)
    // a change under apps/expression alone is bun's own --changed graph: no always-on file is added for it
    expect(pick(['apps/expression/src/scenarios/expr/n04/fixture.ts']).always).not.toContain(
      expression,
    )
  })

  test('a short or index file name names nothing', () => {
    expect(pick([S + '/ui/index.ts', S + '/ui/a.ts']).always).not.toContain(
      S + '/charts/dim-floor.test.ts',
    )
    expect(pick([S + '/ui/button.tsx']).always).not.toContain(S + '/ui/button.test.tsx')
  })

  test('a changed test file adds nothing of its own: bun --changed runs it', () => {
    expect(pick([S + '/ui/button.test.tsx']).always).not.toContain(S + '/ui/button.test.tsx')
  })

  test('a change the graph cannot place selects the whole suite', () => {
    for (const file of [
      'bun.lock',
      'package.json',
      'packages/basalt-ui/package.json',
      'bunfig.toml',
      'tsconfig.base.json',
      'tests/setup/dom.ts',
      'scripts/unit-test.ts',
    ]) {
      expect(pick([S + '/ui/button.tsx', file]).mode).toBe('all')
    }
  })

  test('a docs-only change still selects the always-on set', () => {
    expect(pick(['docs/v3/x.md']).always).toContain('tests/agent-doc-drift.test.ts')
  })
})
