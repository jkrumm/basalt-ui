/**
 * `basalt/control-home` from its fixture under ESLint's RuleTester and oxlint's `plugins-dev`, then
 * the four fixtures and the two waiver directives of the brief run through `lint --hook post-edit`.
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
import { SUITES } from './control-home.cases'
import type { HookInstall } from './control-home.hook.cases'
import { hookInstall } from './control-home.hook.cases'
import { controlHomeRules } from './control-home'

RuleTester.describe = describe
RuleTester.it = it

const ENTRY = controlHomeRules['control-home']

const fixture = (name: string): string =>
  readFileSync(resolve(FIXTURES_ROOT, 'control-home/hook', name), 'utf8')

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of SUITES) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-control-home-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs every fixture block green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'control-home.cases.ts')],
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

describe('control-home form', () => {
  it('is one live form at parts and app that names ControlHome and filterSlot.custom', () => {
    expect(ENTRY.forms.map((form) => form.id)).toEqual(['outside-home'])
    expect(ENTRY.forms.every(isEnabled)).toBe(true)
    expect(ENTRY.profiles).toEqual(['parts', 'app'])
    const message = buildRule('control-home', ENTRY).meta.messages['outside-home'] ?? ''
    expect(message).toBe(formMessage(ENTRY.forms[0]!))
    expect(message).toContain('ControlHome')
    expect(message).toContain('filterSlot.custom')
  })

  it('has valid and invalid fixture blocks', () => {
    const blocks = parseFixture(
      readFileSync(resolve(FIXTURES_ROOT, ENTRY.forms[0]!.fixture), 'utf8'),
    )
    expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['valid', 'invalid']))
  })
})

describe('through lint --hook post-edit', () => {
  let install: HookInstall
  beforeAll(async () => {
    install = await hookInstall(['control-home', 'waiver-needs-reason'])
  })
  afterAll(() => install.dispose())

  for (const name of ['body-children', 'filterSlot-custom-with-useState']) {
    it(`${name} exits 2 and names the fix`, () => {
      const out = install.run(`${name}.tsx`, fixture(`${name}.tsx`))
      expect(out.code).toBe(2)
      expect(out.stderr).toContain('basalt/control-home')
      expect(out.stderr).toMatch(/ControlHome|filterSlot\.custom/)
    })
  }

  for (const name of ['handle-bound-composite', 'FormField-wrapped-select']) {
    it(`${name} exits 0`, () => {
      expect(install.run(`${name}.tsx`, fixture(`${name}.tsx`))).toEqual({ code: 0, stderr: '' })
    })
  }

  it('a file-level disable yields a waiver-needs-reason finding', () => {
    const out = install.run('file-level-disable.tsx', fixture('file-level-disable.tsx'))
    expect(out.code).toBe(2)
    expect(out.stderr).toContain('basalt/waiver-needs-reason')
  })

  it('a line directive with a reason is clean', () => {
    expect(
      install.run('line-level-with-reason.tsx', fixture('line-level-with-reason.tsx')),
    ).toEqual({ code: 0, stderr: '' })
  })
})
