/**
 * The structure-rest family (guardrails section 4, rows 10-15): `colour-literal`,
 * `waiver-needs-reason` and `data-primitive` with every fixture block as a RuleTester case under
 * ESLint and under oxlint's `plugins-dev`; `router-search` and `control-home` are id-only
 * shells (`untrusted-markdown` has its own test file). One file covers the five ids because each id's owned
 * glob would otherwise need its own copy of the harness.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Rule } from 'eslint'
import { RuleTester } from 'eslint'

import { buildRule, createPlugin, formMessage, tableOf } from '../../factory'
import { formCount, isEnabled, mergeTables, renderCoverage } from '../../rule-table'
import { SUITES, FIXTURES_ROOT, parseFixture } from './colour-literal.cases'
import { colourLiteralRules } from './colour-literal'
import { controlHomeRules } from './control-home'
import { dataPrimitiveRules } from './data-primitive'
import { routerSearchRules } from './router-search'
import { untrustedMarkdownRules } from './untrusted-markdown'
import { waiverRules } from './waiver-needs-reason'

RuleTester.describe = describe
RuleTester.it = it

const FAMILY = mergeTables([
  colourLiteralRules,
  waiverRules,
  dataPrimitiveRules,
  routerSearchRules,
  controlHomeRules,
  untrustedMarkdownRules,
])

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of SUITES) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-structure-rest-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs every fixture block green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'colour-literal.cases.ts')],
      outdir,
      target: 'node',
      format: 'esm',
      naming: 'cases.mjs',
    })
    expect(build.success).toBe(true)
    const run = Bun.spawnSync(
      ['node', resolve(import.meta.dirname, '../../factory.oxlint.mjs'), join(outdir, 'cases.mjs')],
      { env: { ...process.env, BASALT_HOST: 'oxlint', BASALT_FIXTURES: FIXTURES_ROOT } },
    )
    const stderr = run.stderr.toString()
    expect({ exitCode: run.exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    const result = JSON.parse(run.stdout.toString()) as { passed: number; failures: string[] }
    expect(result.failures).toEqual([])
    expect(result.passed).toBeGreaterThan(0)
  }, 60_000)
})

describe('forms', () => {
  const live = Object.entries(FAMILY).flatMap(([id, entry]) =>
    entry.forms.filter(isEnabled).map((form) => ({ id, form })),
  )

  it('has 15 live forms: colour-literal 1, waiver-needs-reason 2, data-primitive 8, untrusted-markdown 4', () => {
    const counts: Record<string, number> = {}
    for (const { id } of live) counts[id] = (counts[id] ?? 0) + 1
    expect(counts).toEqual({
      'colour-literal': 1,
      'waiver-needs-reason': 2,
      'data-primitive': 8,
      'untrusted-markdown': 4,
    })
    expect(formCount(FAMILY)).toBe(15)
  })

  for (const { id, form } of live) {
    it(`${id}/${form.id} has valid and invalid fixtures and a fix token in its message`, () => {
      const path = resolve(FIXTURES_ROOT, form.fixture)
      expect(existsSync(path)).toBe(true)
      const blocks = parseFixture(readFileSync(path, 'utf8'))
      expect(blocks.some((block) => block.kind === 'valid')).toBe(true)
      expect(blocks.some((block) => block.kind === 'invalid' && !block.errors)).toBe(true)
      const message = buildRule(id, FAMILY[id]!).meta.messages[form.id] ?? ''
      expect(message).toBe(formMessage(form))
      expect(message).toContain(form.fix.split(/[ ,;(]/)[0] ?? '')
      expect(form.fix.length).toBeGreaterThan(20)
    })
  }

  it('names the token the contract names in each data-primitive message', () => {
    const fixes = Object.fromEntries(
      dataPrimitiveRules['data-primitive'].forms.map((f) => [f.id, f.fix]),
    )
    expect(fixes['refetch-interval']).toContain('liveQuery')
    expect(fixes['unseamed-transport']).toContain('createChannel')
    expect(fixes['unseamed-transport']).toContain('Transport')
    expect(fixes['deprecated-fetch']).toContain('queryClient.query()')
    expect(fixes['query-client-singleton']).toContain('makeQueryClient')
    expect(fixes['chart-data-fallback']).toContain('phase')
    expect(fixes['timer-refetch']).toContain('liveQuery')
    expect(fixes['raw-storage-write']).toContain('createPersistedState')
  })
})

describe('id-only shells', () => {
  const shells = ['router-search', 'control-home']
  const plugin = createPlugin(FAMILY)

  it('register in the rule table with no form', () => {
    for (const id of shells) {
      expect(tableOf(plugin)[id]?.forms).toEqual([])
      expect(plugin.rules[id]).toBeDefined()
    }
  })

  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const id of shells) {
    // Code the bodies will one day guard: the shells must stay silent until v3-ctl-8.
    tester.run(id, plugin.rules[id] as unknown as Rule.RuleModule, {
      valid: [
        `const a = <Link to="/x" search={{ range: '30d' }} />`,
        `const a = <Select data={[]} />`,
      ],
      invalid: [],
    })
  }

  it('print `not guarded:` in the coverage block', () => {
    const block = renderCoverage({ table: FAMILY, ids: shells })
    for (const id of shells) expect(block).toContain(`not guarded: basalt/${id}: no live form yet`)
  })

  it('carries the profiles the contract names', () => {
    expect(FAMILY['colour-literal']?.profiles).toEqual(['bridge', 'parts', 'app'])
    expect(FAMILY['waiver-needs-reason']?.profiles).toEqual(['bridge', 'parts', 'app'])
    for (const id of ['data-primitive', 'untrusted-markdown', ...shells]) {
      expect(FAMILY[id]?.profiles).toEqual(['parts', 'app'])
    }
  })
})

describe('waiver-needs-reason option', () => {
  it('schema rejects an unknown option key', () => {
    const entry = waiverRules['waiver-needs-reason']
    expect(entry.schema?.[0]).toMatchObject({ additionalProperties: false })
  })
})
