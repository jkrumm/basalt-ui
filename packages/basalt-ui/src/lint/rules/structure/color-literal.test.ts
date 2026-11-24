/**
 * The structure-rest family (guardrails section 4, rows 10-15): `color-literal`,
 * `waiver-needs-reason` and `data-primitive` with every fixture block as a RuleTester case under
 * ESLint and under oxlint's `plugins-dev`; `router-search`, `control-home` and `untrusted-markdown`
 * have their own test files. One file covers the five ids because each id's owned
 * glob would otherwise need its own copy of the harness.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Rule } from 'eslint'
import { RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { formCount, isEnabled, mergeTables } from '../../rule-table'
import { SUITES, FIXTURES_ROOT, parseFixture } from './color-literal.cases'
import { colorLiteralRules } from './color-literal'
import { controlHomeRules } from './control-home'
import { dataPrimitiveRules } from './data-primitive'
import { routerSearchRules } from './router-search'
import { untrustedMarkdownRules } from './untrusted-markdown'
import { waiverRules } from './waiver-needs-reason'

RuleTester.describe = describe
RuleTester.it = it

const FAMILY = mergeTables([
  colorLiteralRules,
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
      entrypoints: [resolve(import.meta.dirname, 'color-literal.cases.ts')],
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

  it('has 21 live forms: color-literal 1, waiver-needs-reason 3, data-primitive 9, untrusted-markdown 4, router-search 3, control-home 1', () => {
    const counts: Record<string, number> = {}
    for (const { id } of live) counts[id] = (counts[id] ?? 0) + 1
    expect(counts).toEqual({
      'color-literal': 1,
      'waiver-needs-reason': 3,
      'data-primitive': 9,
      'untrusted-markdown': 4,
      'router-search': 3,
      'control-home': 1,
    })
    expect(formCount(FAMILY)).toBe(21)
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
    expect(fixes['query-client-singleton']).toContain('createQueryClient')
    expect(fixes['chart-data-fallback']).toContain('phase')
    expect(fixes['timer-refetch']).toContain('liveQuery')
    expect(fixes['raw-storage-write']).toContain('persisted(key)')
  })
})

describe('profiles', () => {
  it('carries the profiles the contract names', () => {
    expect(FAMILY['color-literal']?.profiles).toEqual(['bridge', 'parts', 'app', 'site'])
    expect(FAMILY['waiver-needs-reason']?.profiles).toEqual(['bridge', 'parts', 'app', 'site'])
    for (const id of ['data-primitive', 'untrusted-markdown', 'router-search', 'control-home']) {
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
