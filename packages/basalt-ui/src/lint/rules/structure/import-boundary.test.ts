/**
 * `import-boundary` under both hosts: one suite per form from its fixture file, ESLint's
 * RuleTester in process and oxlint's `plugins-dev` in a Node child (this file runs it once for the
 * suites of both rules). The checks below pin the contract rows the brief names.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Rule } from 'eslint'
import { Linter, RuleTester } from 'eslint'

import { formMessage } from '../../factory'
import { isEnabled } from '../../rule-table'
import {
  IMPORT_BOUNDARY,
  ENGINE_FAMILIES,
  ENGINE_SUBPATHS,
  SHIPPED_PRIMITIVES,
} from './import-boundary'
import { SLOTS } from '../../../ui/slots'
import {
  enabledRule,
  fixtureSuites,
  readFixture,
  SUITES,
  tsCaseCount,
} from './import-boundary.cases'

RuleTester.describe = describe
RuleTester.it = it

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of fixtureSuites('import-boundary', IMPORT_BOUNDARY)) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-bypass-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs the suites of import-boundary and primitive-bypass green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'import-boundary.cases.ts')],
      outdir,
      target: 'node',
      format: 'esm',
      naming: 'cases.mjs',
    })
    expect(build.success).toBe(true)
    const run = Bun.spawnSync(
      ['node', resolve(import.meta.dirname, '../../factory.oxlint.mjs'), join(outdir, 'cases.mjs')],
      {
        env: {
          ...process.env,
          BASALT_HOST: 'oxlint',
          BASALT_LINT_FIXTURES: resolve(
            import.meta.dirname,
            '../../../../test/fixtures/lint/import-bypass',
          ),
        },
      },
    )
    const stderr = run.stderr.toString()
    expect({ exitCode: run.exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    const result = JSON.parse(run.stdout.toString()) as { passed: number; failures: string[] }
    expect(result.failures).toEqual([])
    const total = SUITES.reduce(
      (sum, { cases }) => sum + cases.valid.length + cases.invalid.length,
      tsCaseCount(),
    )
    expect(result.passed).toBe(total)
  }, 60_000)
})

describe('import-boundary forms', () => {
  it('has the sixteen forms the contract row names, all live', () => {
    expect(IMPORT_BOUNDARY.forms.map((form) => form.id)).toEqual([
      'base-ui',
      'radix',
      'drag',
      'cmdk',
      'sonner',
      'streamdown',
      'tailwind-merge',
      'visx',
      'data-library',
      'scheme-library',
      'engine-subpath',
      'react-table-hook',
      'ui-path',
      'use-chat-chat',
      'persist-storage',
      'rival-signature',
    ])
    expect(IMPORT_BOUNDARY.forms.every(isEnabled)).toBe(true)
  })

  it('ships at parts and app, never repo', () => {
    expect(IMPORT_BOUNDARY.profiles).toEqual(['parts', 'app'])
  })

  it('gives every form an invalid and a valid fixture case', () => {
    for (const form of IMPORT_BOUNDARY.forms) {
      const kinds = new Set(readFixture(form).map((c) => c.kind))
      expect([form.id, [...kinds].toSorted()]).toEqual([form.id, ['invalid', 'valid']])
    }
  })

  it('names the fix and the next rung in every message', () => {
    const { meta } = enabledRule('import-boundary', IMPORT_BOUNDARY)
    for (const form of IMPORT_BOUNDARY.forms) {
      expect(meta.messages[form.id]).toBe(formMessage(form))
      expect(meta.messages[form.id]).toContain(form.fix.replace(/[.\s]+$/, ''))
    }
  })

  it('keeps the engine allowlist at 17 modules and two families', () => {
    expect(ENGINE_SUBPATHS.size + ENGINE_FAMILIES.length).toBe(19)
  })

  it('keeps every basalt-ui peer and dependency on the stack list or a ban row', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../package.json'), 'utf8'),
    ) as { peerDependencies: Record<string, string>; dependencies: Record<string, string> }
    const rule = enabledRule('import-boundary', IMPORT_BOUNDARY)
    const linter = new Linter()
    // `{ Dialog }` is a signature: a package on neither list would report as `rival-signature`.
    const readAsRival = Object.keys({
      ...manifest.peerDependencies,
      ...manifest.dependencies,
    }).filter((pkg) =>
      linter
        .verify(`import { Dialog } from '${pkg}'`, {
          plugins: { basalt: { rules: { 'import-boundary': rule as unknown as Rule.RuleModule } } },
          rules: { 'basalt/import-boundary': 'error' },
        })
        .some((m) => m.messageId === 'rival-signature'),
    )
    expect(readAsRival).toEqual([])
  })
})

describe('contract rows', () => {
  const linter = new Linter()
  const lint = (code: string, options: unknown[] = [], filename = 'file.js') =>
    linter.verify(
      code,
      [
        {
          files: ['**/*.js', '**/*.tsx'],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: {
            basalt: {
              rules: { 'import-boundary': enabledRule('import-boundary', IMPORT_BOUNDARY) },
            },
          },
          rules: { 'basalt/import-boundary': ['error', ...options] },
        },
      ] as never,
      filename,
    )

  it('useChat() fires and useChat({ chat }) does not', () => {
    expect(lint('useChat()').map((m) => m.messageId)).toEqual(['use-chat-chat'])
    expect(lint('useChat({ chat })')).toEqual([])
  })

  it('an ejected file may hold its own @base-ui import; no other file may', () => {
    const code = "import { Button } from '@base-ui/react/button'"
    const options = [{ ejected: ['src/components/ui/button.tsx'] }]
    expect(lint(code, options, 'src/components/ui/button.tsx')).toEqual([])
    expect(lint(code, options, 'src/components/ui/card.tsx').map((m) => m.messageId)).toEqual([
      'base-ui',
    ])
    expect(lint(code, [], 'src/components/ui/button.tsx').map((m) => m.messageId)).toEqual([
      'base-ui',
    ])
    // An ejected file keeps every other form.
    expect(
      lint("import x from 'cmdk'", options, 'src/components/ui/button.tsx').map((m) => m.messageId),
    ).toEqual(['cmdk'])
  })

  it('@/components/ui/button fires unless the ejected option lists it', () => {
    const code = "import { Button } from '@/components/ui/button'"
    expect(lint(code).map((m) => m.messageId)).toEqual(['ui-path'])
    expect(lint(code, [{ ejected: ['@/components/ui/button'] }])).toEqual([])
    expect(lint(code, [{ ejected: ['@/components/ui/card'] }]).map((m) => m.messageId)).toEqual([
      'ui-path',
    ])
  })
})

describe('ui-path primitive names', () => {
  it('reads a relative ui/<name> path for every shipped primitive, and only those', () => {
    expect([...SHIPPED_PRIMITIVES].toSorted()).toEqual(Object.keys(SLOTS).toSorted())
  })
})
