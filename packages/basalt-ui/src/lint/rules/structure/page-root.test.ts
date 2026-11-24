/**
 * `basalt/page-root` from its fixture under ESLint's RuleTester, plus the contract rows: one form,
 * the shapes builders wrote (a bare `div`, a fragment, a `@container` wrapper) and the app profile.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Rule } from 'eslint'
import { Linter, RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { FIXTURES_ROOT, parseFixture } from './color-literal.cases'
import { pageRootRules } from './page-root'

RuleTester.describe = describe
RuleTester.it = it

const ENTRY = pageRootRules['page-root']
const RULE = buildRule('page-root', ENTRY)
const FORM = ENTRY.forms[0]!
const blocks = parseFixture(readFileSync(resolve(FIXTURES_ROOT, FORM.fixture), 'utf8'))

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  tester.run('page-root/not-page', RULE as unknown as Rule.RuleModule, {
    valid: blocks
      .filter((b) => b.kind === 'valid')
      .map((b) => ({ code: b.code, ...(b.filename ? { filename: b.filename } : {}) })),
    invalid: blocks
      .filter((b) => b.kind === 'invalid')
      .map((b) => ({
        code: b.code,
        errors: (b.errors ?? [FORM.id]).map((messageId) => ({ messageId })),
      })),
  })
})

describe('contract', () => {
  const lint = (code: string): string[] =>
    new Linter()
      .verify(code, [
        {
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { basalt: { rules: { 'page-root': RULE } } },
          rules: { 'basalt/page-root': 'error' },
        },
      ] as never)
      .map((m) => m.message)

  it('has one form with valid and invalid fixtures and a message naming Page', () => {
    expect(ENTRY.forms.map((f) => f.id)).toEqual(['not-page'])
    expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['valid', 'invalid']))
    expect(RULE.meta.messages['not-page']).toBe(formMessage(FORM))
    expect(FORM.fix).toContain('<Page>')
  })

  it('quotes the root it found: a div, a fragment, a @container wrapper', () => {
    const bar = '<PageBar title="x" />'
    expect(lint(`const A = () => <div className="p-4">${bar}</div>`)[0]).toStartWith('`<div>`')
    expect(lint(`const A = () => <>${bar}</>`)[0]).toStartWith('`<>`')
    expect(
      lint(`const A = () => <div className="@container"><Page>${bar}</Page></div>`),
    ).toHaveLength(1)
    expect(lint(`const A = () => <Page>${bar}</Page>`)).toEqual([])
  })

  it('ships in the app preset only', () => {
    expect(ENTRY.profiles).toEqual(['app'])
  })
})
