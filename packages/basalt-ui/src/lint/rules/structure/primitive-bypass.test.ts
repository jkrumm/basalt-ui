/**
 * `primitive-bypass` under ESLint's RuleTester, one suite per form from its fixture file. The
 * oxlint host run covers these suites too (see `import-boundary.test.ts`). The `Intl` form is on
 * in the table.
 */
import { describe, expect, it } from 'bun:test'
import type { Rule } from 'eslint'
import { Linter, RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { isEnabled, renderCoverage } from '../../rule-table'
import { enabledRule, fixtureSuites, readFixture } from './import-boundary.cases'
import { CHART_KINDS, PRIMITIVE_BYPASS, primitiveBypassRules } from './primitive-bypass'

RuleTester.describe = describe
RuleTester.it = it

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of fixtureSuites('primitive-bypass', PRIMITIVE_BYPASS)) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('primitive-bypass forms', () => {
  it('has the ten forms of the contract row', () => {
    expect(PRIMITIVE_BYPASS.forms.map((form) => form.id)).toEqual([
      'raw-control',
      'checkable-input',
      'raw-heading',
      'raw-table',
      'svg-data-marks',
      'html-data-marks',
      'role-table',
      'table-rows',
      'chart-body-root',
      'intl-format',
    ])
  })

  it('ships at parts and app and is off in ejected and seed zones', () => {
    expect(PRIMITIVE_BYPASS.profiles).toEqual(['parts', 'app'])
    expect(PRIMITIVE_BYPASS.zonesOff).toEqual(['ejected', 'seed'])
  })

  it('gives every form an invalid and a valid fixture case', () => {
    for (const form of PRIMITIVE_BYPASS.forms) {
      const kinds = new Set(readFixture(form).map((c) => c.kind))
      expect([form.id, [...kinds].toSorted()]).toEqual([form.id, ['invalid', 'valid']])
    }
  })

  it('names the fix and the next rung in every message', () => {
    const { meta } = enabledRule('primitive-bypass', PRIMITIVE_BYPASS)
    for (const form of PRIMITIVE_BYPASS.forms) {
      expect(meta.messages[form.id]).toBe(formMessage(form))
      expect(meta.messages[form.id]).toContain(form.fix.replace(/[.\s]+$/, ''))
    }
  })

  it('treats Meter and BarList as not chart kinds', () => {
    expect(CHART_KINDS.has('Meter')).toBe(false)
    expect(CHART_KINDS.has('BarList')).toBe(false)
  })
})

describe('the Intl form', () => {
  const code = "const f = new Intl.DateTimeFormat('de-DE')"
  const run = (rule: ReturnType<typeof buildRule>) =>
    new Linter().verify(code, [
      {
        plugins: { basalt: { rules: { 'primitive-bypass': rule } } },
        rules: { 'basalt/primitive-bypass': 'error' },
      },
    ] as never)

  it('is enabled in the table, so the table rule fires and names useFormat', () => {
    const form = PRIMITIVE_BYPASS.forms.find((f) => f.id === 'intl-format')
    expect(form && isEnabled(form)).toBe(true)
    const messages = run(buildRule('primitive-bypass', PRIMITIVE_BYPASS))
    expect(messages.map((m) => m.messageId)).toEqual(['intl-format'])
    expect(messages[0]?.message).toContain('useFormat')
    expect(renderCoverage({ table: primitiveBypassRules })).not.toContain(
      'not guarded: basalt/primitive-bypass/intl-format',
    )
  })

  it('fires through the enabled-rule helper too', () => {
    expect(run(enabledRule('primitive-bypass', PRIMITIVE_BYPASS)).map((m) => m.messageId)).toEqual([
      'intl-format',
    ])
  })
})
