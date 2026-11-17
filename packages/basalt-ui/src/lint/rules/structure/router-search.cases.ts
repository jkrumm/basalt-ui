/**
 * The RuleTester suites of `router-search`: the grammar of `colour-literal.cases.ts`, with its
 * `// @ts` blocks (a cast needs a TS parser) run under oxlint's tester only.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildRule } from '../../factory'
import { FIXTURES_ROOT, parseFixture } from './colour-literal.cases'
import type { Suite } from './control-home.cases'
import { routerSearchRules } from './router-search'

const oxlint = process.env['BASALT_HOST'] === 'oxlint'

function routerSearchSuite(): Suite {
  const entry = routerSearchRules['router-search']
  if (!entry) throw new Error('router-search: not in the table')
  const suite: Suite = {
    name: 'router-search',
    rule: buildRule('router-search', entry),
    cases: { valid: [], invalid: [] },
  }
  for (const form of entry.forms) {
    const text = readFileSync(resolve(FIXTURES_ROOT, form.fixture), 'utf8')
    for (const block of parseFixture(text)) {
      if (block.ts && !oxlint) continue
      const base: Suite['cases']['valid'][number] & { languageOptions?: unknown } = {
        code: block.code,
      }
      if (block.filename) base.filename = block.filename
      if (block.options) base.options = block.options
      if (block.ts) base.languageOptions = { parserOptions: { lang: 'tsx' } }
      if (block.kind === 'valid') suite.cases.valid.push(base)
      else {
        const ids = block.errors ?? [form.id]
        suite.cases.invalid.push({ ...base, errors: ids.map((messageId) => ({ messageId })) })
      }
    }
  }
  return suite
}

export const SUITES: Suite[] = [routerSearchSuite()]
