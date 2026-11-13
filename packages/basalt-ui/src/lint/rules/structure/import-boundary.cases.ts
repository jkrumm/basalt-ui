/**
 * Fixture-driven RuleTester suites for the two import-bypass rules, shared by both hosts: ESLint's
 * in-process from the `*.test.ts` files, oxlint's `plugins-dev` from Node through
 * `../../factory.oxlint.mjs` over a bundled copy of this module (it reads `SUITES`).
 *
 * A fixture file holds one form's cases, split on marker lines:
 *
 * ```
 * // @invalid [xN] [{"option": …}]   the code below fires this form N times (default 1)
 * // @valid [{"option": …}]          the code below fires nothing
 * ```
 *
 * An invalid case runs against the whole rule with every form enabled, so it also proves no other
 * form double-reports the same code.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { LintRule } from '../../factory'
import { buildRule } from '../../factory'
import type { Form, RuleEntry } from '../../rule-table'
import { IMPORT_BOUNDARY } from './import-boundary'
import { PRIMITIVE_BYPASS } from './primitive-bypass'

/** The fixture root; the oxlint host runs a bundle elsewhere, so the test passes it in. */
const ROOT =
  process.env['BASALT_LINT_FIXTURES'] ??
  resolve(import.meta.dirname, '../../../../test/fixtures/lint/import-bypass')

type Options = unknown[]
type ValidCase = { code: string; options?: Options }
type InvalidCase = { code: string; options?: Options; errors: { messageId: string }[] }
export type Suite = {
  name: string
  rule: LintRule
  cases: { valid: ValidCase[]; invalid: InvalidCase[] }
}

const MARKER = /^\/\/ @(valid|invalid)(?: x(\d+))?(?: (\{.*\}))?\s*$/

export type FixtureCase = {
  kind: 'valid' | 'invalid'
  code: string
  count: number
  options?: Options
}

/** Split one fixture file into its cases; text before the first marker is a header. */
export function parseFixture(text: string): FixtureCase[] {
  const cases: FixtureCase[] = []
  let current: { head: RegExpMatchArray; lines: string[] } | undefined
  const flush = (): void => {
    if (!current) return
    const [, kind, count, options] = current.head
    cases.push({
      kind: kind as 'valid' | 'invalid',
      code: current.lines.join('\n').trim(),
      count: count ? Number(count) : 1,
      ...(options ? { options: [JSON.parse(options)] } : {}),
    })
  }
  for (const line of text.split('\n')) {
    const head = MARKER.exec(line)
    if (head) {
      flush()
      current = { head, lines: [] }
    } else current?.lines.push(line)
  }
  flush()
  return cases
}

export const readFixture = (form: Form): FixtureCase[] =>
  parseFixture(readFileSync(resolve(ROOT, form.fixture.replace(/^import-bypass\//, '')), 'utf8'))

/** The rule with every form on, so a disabled form is exercised too. */
export const enabledRule = (id: string, entry: RuleEntry): LintRule =>
  buildRule(id, { ...entry, forms: entry.forms.map((form) => ({ ...form, enabled: true })) })

/** One suite per form: its fixture's valid and invalid cases against the whole rule. */
export function fixtureSuites(id: string, entry: RuleEntry): Suite[] {
  const rule = enabledRule(id, entry)
  return entry.forms.map((form) => {
    const cases = readFixture(form)
    return {
      name: `${id}/${form.id}`,
      rule,
      cases: {
        valid: cases
          .filter((c) => c.kind === 'valid')
          .map(({ code, options }) => ({ code, ...(options ? { options } : {}) })),
        invalid: cases
          .filter((c) => c.kind === 'invalid')
          .map(({ code, options, count }) => ({
            code,
            ...(options ? { options } : {}),
            errors: Array.from({ length: count }, () => ({ messageId: form.id })),
          })),
      },
    }
  })
}

export const SUITES: Suite[] = [
  ...fixtureSuites('import-boundary', IMPORT_BOUNDARY),
  ...fixtureSuites('primitive-bypass', PRIMITIVE_BYPASS),
]
