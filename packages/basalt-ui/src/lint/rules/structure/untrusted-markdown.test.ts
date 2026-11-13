/**
 * `basalt/untrusted-markdown` forms from their fixtures under ESLint's RuleTester, plus the
 * contract rows: one id and one shared fix per form, the authoredContent option, and the
 * `useChat()` fixture pair (owned by `import-boundary`) run through the same rule table.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Rule } from 'eslint'
import { Linter, RuleTester } from 'eslint'

import { buildRule, formMessage } from '../../factory'
import { FIXTURES_ROOT, parseFixture } from './colour-literal.cases'
import { enabledRule } from './import-boundary.cases'
import { IMPORT_BOUNDARY } from './import-boundary'
import { untrustedMarkdownRules } from './untrusted-markdown'

RuleTester.describe = describe
RuleTester.it = it

const ENTRY = untrustedMarkdownRules['untrusted-markdown']
const RULE = buildRule('untrusted-markdown', ENTRY)
const blocksOf = (fixture: string) =>
  parseFixture(readFileSync(resolve(FIXTURES_ROOT, fixture), 'utf8'))

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const form of ENTRY.forms) {
    const blocks = blocksOf(form.fixture)
    const base = (b: (typeof blocks)[number]) => ({
      code: b.code,
      ...(b.filename ? { filename: b.filename } : {}),
      ...(b.options ? { options: b.options } : {}),
    })
    tester.run(`untrusted-markdown/${form.id}`, RULE as unknown as Rule.RuleModule, {
      valid: blocks.filter((b) => b.kind === 'valid').map(base),
      invalid: blocks
        .filter((b) => b.kind === 'invalid')
        .map((b) => ({ ...base(b), errors: [{ messageId: form.id }] })),
    })
  }
})

describe('contract', () => {
  it('has the four forms, each with valid and invalid fixtures', () => {
    expect(ENTRY.forms.map((f) => f.id)).toEqual([
      'dangerous-html',
      'rehype-raw',
      'mdx-evaluate',
      'trusted-content',
    ])
    for (const form of ENTRY.forms) {
      const kinds = new Set(blocksOf(form.fixture).map((b) => b.kind))
      expect([form.id, [...kinds].toSorted()]).toEqual([form.id, ['invalid', 'valid']])
    }
  })

  it('shares one fix message naming Markdown contentTrust="untrusted" and the trust tiers', () => {
    const messages = new Set(ENTRY.forms.map((f) => f.fix))
    expect(messages.size).toBe(1)
    for (const form of ENTRY.forms) {
      expect(RULE.meta.messages[form.id]).toBe(formMessage(form))
      expect(form.fix).toContain('<Markdown contentTrust="untrusted">')
      expect(form.fix).toContain('trusted')
    }
  })

  it('fires without any basalt-ui/ai import', () => {
    const linter = new Linter()
    const [msg] = linter.verify('const a = <Markdown contentTrust="trusted">{text}</Markdown>', [
      {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { basalt: { rules: { 'untrusted-markdown': RULE } } },
        rules: { 'basalt/untrusted-markdown': 'error' },
      },
    ] as never)
    expect(msg?.messageId).toBe('trusted-content')
  })

  it('ships at parts and app', () => {
    expect(ENTRY.profiles).toEqual(['parts', 'app'])
  })
})

describe('useChat() fixture pair (import-boundary row)', () => {
  const linter = new Linter()
  const rule = enabledRule('import-boundary', IMPORT_BOUNDARY)
  const lint = (code: string) =>
    linter.verify(code, [
      {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { basalt: { rules: { 'import-boundary': rule } } },
        rules: { 'basalt/import-boundary': 'error' },
      },
    ] as never)

  it('useChat() without chat fails and useChat({ chat }) passes', () => {
    for (const block of blocksOf('untrusted/use-chat-pair.tsx')) {
      const ids = lint(block.code).map((m) => m.messageId)
      expect(ids).toEqual(block.kind === 'invalid' ? ['use-chat-chat'] : [])
    }
  })
})
