/**
 * `basalt/motion-literal` from its two fixtures under ESLint's RuleTester and oxlint's
 * `plugins-dev`, then the form and profile contract.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Rule } from 'eslint'
import { RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { isEnabled } from '../../rule-table'
import { FIXTURES_ROOT, parseFixture } from './color-literal.cases'
import { SUITES } from './motion-literal.cases'
import { motionLiteralRules } from './motion-literal'

RuleTester.describe = describe
RuleTester.it = it

const ENTRY = motionLiteralRules['motion-literal']

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of SUITES) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-motion-literal-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs every fixture block green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'motion-literal.cases.ts')],
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

describe('motion-literal forms', () => {
  it('are the two live forms at bridge, parts, app and site', () => {
    expect(ENTRY.forms.map((form) => form.id)).toEqual(['object-literal', 'css-literal'])
    expect(ENTRY.forms.every(isEnabled)).toBe(true)
    expect(ENTRY.profiles).toEqual(['bridge', 'parts', 'app', 'site'])
  })

  for (const form of ENTRY.forms) {
    it(`${form.id} has valid and invalid fixture blocks and names the scale`, () => {
      const blocks = parseFixture(readFileSync(resolve(FIXTURES_ROOT, form.fixture), 'utf8'))
      expect(blocks.some((block) => block.kind === 'valid')).toBe(true)
      expect(blocks.some((block) => block.kind === 'invalid' && !block.errors)).toBe(true)
      expect(buildRule('motion-literal', ENTRY).meta.messages[form.id]).toBe(formMessage(form))
      expect(form.fix).toContain('basalt-ui/tokens')
      expect(form.fix).toContain('var(--basalt-dur-*)')
    })
  }
})
