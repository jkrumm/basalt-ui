/**
 * The RuleTester suites of `control-home`, built from its fixture files with
 * the grammar of `color-literal.cases.ts` (every `// @valid` / `// @invalid` block is one case).
 * ESLint runs them in process from the `*.test.ts` files; oxlint's `plugins-dev` runs a bundled
 * copy under Node through `../../factory.oxlint.mjs`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { LintRule } from '../../factory'
import { buildRule } from '../../factory'
import type { RuleTable } from '../../rule-table'
import { FIXTURES_ROOT, parseFixture } from './color-literal.cases'
import { controlHomeRules } from './control-home'

type Case = { code: string; filename?: string; options?: unknown[] }
export type Suite = {
  name: string
  rule: LintRule
  cases: { valid: Case[]; invalid: (Case & { errors: { messageId: string }[] })[] }
}

/** One suite per rule: every form's fixture blocks against the whole rule. */
function suiteFor(table: RuleTable, id: string): Suite {
  const entry = table[id]
  if (!entry) throw new Error(`${id}: not in the table`)
  const suite: Suite = { name: id, rule: buildRule(id, entry), cases: { valid: [], invalid: [] } }
  for (const form of entry.forms) {
    const text = readFileSync(resolve(FIXTURES_ROOT, form.fixture), 'utf8')
    for (const block of parseFixture(text)) {
      const base: Case = { code: block.code }
      if (block.filename) base.filename = block.filename
      if (block.options) base.options = block.options
      if (block.kind === 'valid') suite.cases.valid.push(base)
      else {
        const ids = block.errors ?? [form.id]
        suite.cases.invalid.push({ ...base, errors: ids.map((messageId) => ({ messageId })) })
      }
    }
  }
  return suite
}

export const SUITES: Suite[] = [suiteFor(controlHomeRules, 'control-home')]
