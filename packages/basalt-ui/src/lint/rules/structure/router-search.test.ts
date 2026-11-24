/**
 * `basalt/router-search` from its three fixtures under ESLint's RuleTester and oxlint's
 * `plugins-dev`, then one seeded offender per form and one clean file through `lint --hook
 * post-edit`. The `<ViewTransition>` form of the original row is not built: guardrails section 4
 * removed it on 2026-11-11.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Rule } from 'eslint'
import { RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { isEnabled } from '../../rule-table'
import { FIXTURES_ROOT, parseFixture } from './color-literal.cases'
import type { HookInstall } from './control-home.hook.cases'
import { hookInstall } from './control-home.hook.cases'
import { SUITES } from './router-search.cases'
import { routerSearchRules } from './router-search'

RuleTester.describe = describe
RuleTester.it = it

const ENTRY = routerSearchRules['router-search']

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of SUITES) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-router-search-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs every fixture block green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'router-search.cases.ts')],
      outdir,
      target: 'node',
      format: 'esm',
      naming: 'cases.mjs',
    })
    expect(build.success).toBe(true)
    const run = Bun.spawnSync(
      ['node', resolve(import.meta.dirname, '../../factory.oxlint.mjs'), join(outdir, 'cases.mjs')],
      { env: { ...process.env, BASALT_FIXTURES: FIXTURES_ROOT } },
    )
    expect({ exitCode: run.exitCode, stderr: run.stderr.toString() }).toEqual({
      exitCode: 0,
      stderr: '',
    })
    const result = JSON.parse(run.stdout.toString()) as { passed: number; failures: string[] }
    expect(result.failures).toEqual([])
    const total = SUITES.reduce((n, { cases }) => n + cases.valid.length + cases.invalid.length, 0)
    expect(result.passed).toBe(total)
  }, 60_000)
})

describe('router-search forms', () => {
  it('are the three live forms of the contract row at parts and app', () => {
    expect(ENTRY.forms.map((form) => form.id)).toEqual([
      'literal-search',
      'loader-deps-search',
      'validate-search-pure',
    ])
    expect(ENTRY.forms.every(isEnabled)).toBe(true)
    expect(ENTRY.profiles).toEqual(['parts', 'app'])
  })

  it('name their fix and have valid and invalid fixture blocks', () => {
    const fixes: Record<string, string> = {
      'literal-search': 'field.link()',
      'loader-deps-search': 'loaderDeps',
      'validate-search-pure': 'pure',
    }
    const { meta } = buildRule('router-search', ENTRY)
    for (const form of ENTRY.forms) {
      expect(meta.messages[form.id]).toBe(formMessage(form))
      expect(meta.messages[form.id]).toContain(fixes[form.id]!)
      const blocks = parseFixture(readFileSync(resolve(FIXTURES_ROOT, form.fixture), 'utf8'))
      expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['valid', 'invalid']))
    }
  })
})

describe('through lint --hook post-edit', () => {
  let install: HookInstall
  beforeAll(async () => {
    install = await hookInstall(['router-search'])
  })
  afterAll(() => install.dispose())

  const OFFENDERS: Record<string, { source: string; fix: string }> = {
    'literal-search': {
      source: `export const a = <Link to="/runs" search={{ range: '30d' }} />\n`,
      fix: 'field.link()',
    },
    'loader-deps-search': {
      source: `export const route = createFileRoute('/runs')({ loaderDeps: ({ search }) => search })\n`,
      fix: 'search.range',
    },
    'validate-search-pure': {
      source: `export const route = createFileRoute('/runs')({\n  validateSearch: z.object({ at: z.date().default(() => new Date()) }),\n})\n`,
      fix: 'pure function',
    },
  }

  for (const [form, { source, fix }] of Object.entries(OFFENDERS)) {
    it(`${form}: a seeded offender exits 2 and names its fix`, () => {
      const out = install.run(`${form}.tsx`, source)
      expect(out.code).toBe(2)
      expect(out.stderr).toContain('basalt/router-search')
      expect(out.stderr).toContain(fix)
    })
  }

  it('a clean file exits 0', () => {
    const clean = `export const a = <Link to="/runs" search={store.field.range.link()} />
export const route = createFileRoute('/runs')({
  loaderDeps: ({ search }) => ({ range: search.range }),
  validateSearch: (input) => ({ range: input.range }),
})
`
    expect(install.run('clean.tsx', clean)).toEqual({ code: 0, stderr: '' })
  })
})
