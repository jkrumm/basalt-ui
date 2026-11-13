/**
 * The class family under both hosts (guardrails section 13): ESLint's RuleTester in process,
 * oxlint's `plugins-dev` RuleTester in a Node child over a bundled copy of the same suites. The
 * suites come from the fixtures (`class.cases.ts`); the tests below add the input-to-id table, the
 * fix-token check, the padding-form check and the no-hand-typed-colour check.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ESLint, Rule } from 'eslint'
import { Linter, RuleTester } from 'eslint'

import { createPlugin, formMessage } from '../../factory'
import { zoneANames } from '../../generated/zone-a'
import { isEnabled } from '../../rule-table'
import { FIXTURES_ROOT, readFixture, SUITES, validPath } from './class.cases'
import { CLASS_RULES } from './table'

RuleTester.describe = describe
RuleTester.it = it

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of SUITES) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-class-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs every suite green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'class.cases.ts')],
      outdir,
      target: 'node',
      format: 'esm',
      naming: 'cases.mjs',
    })
    expect(build.success).toBe(true)
    const run = Bun.spawnSync(
      ['node', resolve(import.meta.dirname, '../../factory.oxlint.mjs'), join(outdir, 'cases.mjs')],
      { env: { ...process.env, BASALT_LINT_FIXTURES: FIXTURES_ROOT } },
    )
    const stderr = run.stderr.toString()
    expect({ exitCode: run.exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    const result = JSON.parse(run.stdout.toString()) as { passed: number; failures: string[] }
    expect(result.failures).toEqual([])
    const total = SUITES.reduce(
      (sum, { cases }) => sum + cases.valid.length + cases.invalid.length,
      0,
    )
    expect(result.passed).toBe(total)
  }, 60_000)
})

const plugin = createPlugin(CLASS_RULES)
const linter = new Linter()
const lint = (code: string): { ruleId: string; messageId: string; message: string }[] =>
  linter
    .verify(
      code,
      [
        {
          files: ['**/*.tsx'],
          plugins: { basalt: plugin as unknown as ESLint.Plugin },
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          rules: Object.fromEntries(
            Object.keys(CLASS_RULES).map((id) => [`basalt/${id}`, 'error']),
          ),
        },
      ],
      'input.tsx',
    )
    .map(({ ruleId, messageId, message }) => ({
      ruleId: ruleId as string,
      messageId: messageId as string,
      message,
    }))

describe('input to id', () => {
  type Found = { ruleId: string; messageId: string }
  const cases: (Found & { input: string; code: string; also?: Found[] })[] = [
    {
      input: 'max-md:flex',
      code: `export const a = <div className="max-md:flex" />`,
      ruleId: 'basalt/viewport-keyed',
      messageId: 'breakpoint-prefix',
    },
    {
      input: '@max-md:flex',
      code: `export const a = <div className="@max-md:flex" />`,
      ruleId: 'basalt/tw-off-law',
      messageId: 'numeric-container',
    },
    {
      input: 'bg-(--vx-good)',
      code: `export const a = <div className="bg-(--vx-good)" />`,
      ruleId: 'basalt/tw-off-law',
      messageId: 'app-colour-arbitrary',
    },
    {
      input: 'border-l-4 border-bad',
      code: `export const a = <div className="border-l-4 border-bad" />`,
      ruleId: 'basalt/tw-off-law',
      messageId: 'app-colour',
    },
    {
      input: `['gap-4.5','flex']`,
      code: `export const a = ['gap-4.5', 'flex']`,
      ruleId: 'basalt/tw-off-law',
      messageId: 'off-ladder-spacing',
    },
    {
      input: 'bg-${tone}-600',
      code: 'export const a = <div className={`bg-${tone}-600`} />',
      ruleId: 'basalt/tw-off-law',
      messageId: 'template-interpolation',
    },
    {
      input: 'dark:bg-card',
      code: `export const a = <div className="dark:bg-card" />`,
      ruleId: 'basalt/dark-fork',
      messageId: 'dark-variant',
    },
    {
      input: 'bg-black',
      code: `export const a = <div className="bg-black" />`,
      ruleId: 'basalt/fixed-colour',
      messageId: 'black-white',
    },
    {
      // Two distinct violations on one token (contrast, and colour in app code): both report.
      input: 'text-chart-1',
      code: `export const a = <div className="text-chart-1" />`,
      ruleId: 'basalt/status-fill-as-text',
      messageId: 'text-on-fill',
      also: [{ ruleId: 'basalt/tw-off-law', messageId: 'app-colour' }],
    },
    {
      input: 'overflow-auto',
      code: `export const a = <div className="overflow-auto" />`,
      ruleId: 'basalt/raw-scroll',
      messageId: 'overflow-scroll',
    },
    {
      input: 'mt-4',
      code: `export const a = <div className="mt-4" />`,
      ruleId: 'basalt/app-spacing',
      messageId: 'margin',
    },
    {
      input: "matchMedia('(min-width: 768px)')",
      code: `export const a = window.matchMedia('(min-width: 768px)')`,
      ruleId: 'basalt/viewport-keyed',
      messageId: 'media-query',
    },
  ]

  for (const { input, code, ruleId, messageId, also = [] } of cases) {
    it(`${input} fires exactly ${ruleId}/${messageId}`, () => {
      const found = lint(code).map(({ ruleId: id, messageId: message }) => ({
        ruleId: id,
        messageId: message,
      }))
      expect(found).toEqual([{ ruleId, messageId }, ...also])
    })
  }
})

describe('forms', () => {
  const FIX_TOKEN: Record<string, string> = {
    'breakpoint-prefix': '@narrow:',
    'arbitrary-query': '@narrow:',
    'media-query': 'useSizeClass',
    'dark-variant': 'Tokens switch per scheme',
    'black-white': 'on-brand',
    'text-on-fill': 'Status',
    'overflow-scroll': 'ui/scroll-area',
    'off-ladder-spacing': 'ladder step',
    'surface-recipe': 'Card',
    'app-colour': 'Status',
    'app-colour-arbitrary': 'Status',
    'alpha-on-premixed': 'pre-mixed token',
    'numeric-container': '@narrow:',
    'important-modifier': 'cva variant',
    'template-interpolation': 'cva variant',
    'fixed-width': 'Parent-owned width',
    'space-between': 'gap-',
    margin: 'gap-',
    padding: 'Inset',
  }
  const all = Object.entries(CLASS_RULES).flatMap(([id, entry]) =>
    entry.forms.map((form) => ({ id, form })),
  )

  it('is eighteen enabled forms in seven ids, plus the padding form', () => {
    expect(Object.keys(CLASS_RULES)).toEqual([
      'viewport-keyed',
      'dark-fork',
      'fixed-colour',
      'status-fill-as-text',
      'raw-scroll',
      'tw-off-law',
      'app-spacing',
    ])
    expect(all.filter(({ form }) => isEnabled(form))).toHaveLength(18)
    expect(all).toHaveLength(19)
  })

  it('runs viewport-keyed, dark-fork, fixed-colour and status-fill-as-text from bridge up', () => {
    for (const id of ['viewport-keyed', 'dark-fork', 'fixed-colour', 'status-fill-as-text']) {
      expect(CLASS_RULES[id as keyof typeof CLASS_RULES].profiles).toContain('bridge')
    }
    for (const id of ['raw-scroll', 'app-spacing'] as const) {
      expect(CLASS_RULES[id].profiles).not.toContain('bridge')
      expect(CLASS_RULES[id].profiles).toContain('parts')
    }
  })

  it('is off in vendored files (zone V); app-spacing is also off in ejected and seed files', () => {
    for (const [id, entry] of Object.entries(CLASS_RULES)) {
      expect({ id, vendored: entry.zonesOff?.includes('vendored') }).toEqual({
        id,
        vendored: true,
      })
    }
    expect(CLASS_RULES['app-spacing'].zonesOff).toEqual(['ejected', 'seed', 'vendored'])
  })

  for (const { id, form } of all) {
    it(`${id}/${form.id}: fixtures exist and the message names its fix token`, () => {
      expect(readFixture(form.fixture)).toContain('// expect: ')
      expect(readFixture(validPath(form))).not.toContain('// expect: ')
      const token = FIX_TOKEN[form.id]
      expect(token).toBeDefined()
      expect(formMessage(form)).toContain(token as string)
    })
  }

  it('reports the fix token in the message ESLint emits, per enabled form', () => {
    for (const { form } of all.filter(({ form: f }) => isEnabled(f))) {
      const messages = lint(readFixture(form.fixture)).filter(
        ({ messageId }) => messageId === form.id,
      )
      expect(messages.length).toBeGreaterThan(0)
      for (const { message } of messages) expect(message).toContain(FIX_TOKEN[form.id] as string)
    }
  })

  it('carries the padding form with enabled false and a reason naming F5P', () => {
    const padding = CLASS_RULES['app-spacing'].forms.find((form) => form.id === 'padding')
    expect(padding?.enabled).toBe(false)
    expect(padding?.reason).toContain('F5P')
    expect(lint(readFixture(padding?.fixture as string))).toEqual([])
  })

  it('reads tw-off-law colours from zone-a.ts, never a hand list', () => {
    const sources = readdirSync(import.meta.dirname)
      .filter((file) => file.endsWith('.ts') && !/\.(?:test|cases)\.ts$/.test(file))
      .map((file) => readFileSync(join(import.meta.dirname, file), 'utf8'))
      .join('\n')
    for (const name of zoneANames) {
      expect(sources).not.toMatch(new RegExp(`['"\`]${name}['"\`]`))
    }
    expect(sources).toContain("from '../../generated/zone-a'")
  })
})
