/**
 * The RuleTester suites for the structure-rest family, built from the fixture files: every block
 * of a form's fixture is one case, so the fixture list and the proof cannot drift apart. ESLint's
 * RuleTester runs them in process from `colour-literal.test.ts`; oxlint's `plugins-dev` runs a
 * bundled copy under Node through `../../factory.oxlint.mjs` (it refuses Bun).
 *
 * Fixture grammar: a `// @valid` or `// @invalid` line starts a block; inside it `// @filename
 * <path>`, `// @options <json>`, `// @errors <form id>[,<form id>]` and `// @ts` are directives
 * and every other line is the case's code. An invalid block reports its own form once unless
 * `@errors` says otherwise. `@ts` blocks need a TS parser, which only oxlint's tester has.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { LintRule } from '../../factory'
import { buildRule } from '../../factory'
import type { Form, RuleTable } from '../../rule-table'
import { colourLiteralRules } from './colour-literal'
import { dataPrimitiveRules } from './data-primitive'
import { waiverRules } from './waiver-needs-reason'

type CaseBase = {
  code: string
  filename?: string
  options?: unknown[]
  languageOptions?: { parserOptions: { lang: string } }
}
export type ValidCase = CaseBase
export type InvalidCase = CaseBase & { errors: { messageId: string }[] }
export type Suite = {
  name: string
  rule: LintRule
  cases: { valid: ValidCase[]; invalid: InvalidCase[] }
}

const oxlint = process.env['BASALT_HOST'] === 'oxlint'

export const FIXTURES_ROOT =
  process.env['BASALT_FIXTURES'] ?? resolve(import.meta.dirname, '../../../../test/fixtures/lint')

type Block = {
  kind: 'valid' | 'invalid'
  code: string
  filename?: string
  options?: unknown[]
  errors?: string[]
  ts: boolean
}

const HEADER = /^\/\/ @(valid|invalid)\s*$/
const DIRECTIVE = /^\/\/ @(filename|options|errors|ts)(?:\s+(.*))?$/

export function parseFixture(text: string): Block[] {
  const blocks: Block[] = []
  let current: { block: Block; lines: string[] } | undefined
  const close = (): void => {
    if (!current) return
    current.block.code = current.lines.join('\n').trim()
    blocks.push(current.block)
    current = undefined
  }
  for (const line of text.split('\n')) {
    const header = HEADER.exec(line)
    if (header) {
      close()
      current = { block: { kind: header[1] as Block['kind'], code: '', ts: false }, lines: [] }
      continue
    }
    if (!current) continue
    const directive = DIRECTIVE.exec(line)
    if (!directive) {
      current.lines.push(line)
      continue
    }
    const [, name, value = ''] = directive
    if (name === 'filename') current.block.filename = value.trim()
    else if (name === 'options') current.block.options = [JSON.parse(value) as unknown]
    else if (name === 'errors') current.block.errors = value.split(',').map((id) => id.trim())
    else current.block.ts = true
  }
  close()
  return blocks
}

const readFixture = (form: Form): string =>
  readFileSync(resolve(FIXTURES_ROOT, form.fixture), 'utf8')

function suiteFor(table: RuleTable, id: string): Suite {
  const entry = table[id]
  if (!entry) throw new Error(`${id}: not in the table`)
  const suite: Suite = { name: id, rule: buildRule(id, entry), cases: { valid: [], invalid: [] } }
  for (const form of entry.forms) {
    for (const block of parseFixture(readFixture(form))) {
      if (block.ts && !oxlint) continue
      const base: CaseBase = { code: block.code }
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

export const SUITES: Suite[] = [
  suiteFor(colourLiteralRules, 'colour-literal'),
  suiteFor(waiverRules, 'waiver-needs-reason'),
  suiteFor(dataPrimitiveRules, 'data-primitive'),
]
