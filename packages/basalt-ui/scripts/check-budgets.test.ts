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

import { isOwnGraphId, runBudgets } from './check-budgets'

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
  return { code, row }
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
    expect((await runQuiet({ reportOnly: false, providerOnlyDist: broken })).code).toBe(1)
  })
})
