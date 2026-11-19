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
 * // @filename <path>                 a line inside a case: the file the case runs as
 * // @ts                              a line inside a case: TypeScript syntax (`as const`)
 * ```
 *
 * A `@ts` case needs a TS parser, which only oxlint's tester has: the oxlint host runs it as `tsx`
 * (`BASALT_HOST=oxlint`), the ESLint host skips it.
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
type LanguageOptions = { parserOptions: { lang: 'tsx' } }
type ValidCase = {
  code: string
  options?: Options
  filename?: string
  languageOptions?: LanguageOptions
}
type InvalidCase = ValidCase & { errors: { messageId: string }[] }
export type Suite = {
  name: string
  rule: LintRule
  cases: { valid: ValidCase[]; invalid: InvalidCase[] }
}

const FILENAME = /^\/\/ @filename\s+(\S+)\s*$/
const TS = /^\/\/ @ts\s*$/
const MARKER = /^\/\/ @(valid|invalid)(?: x(\d+))?(?: (\{.*\}))?\s*$/

/** The oxlint host sets this: only its tester parses TypeScript. */
const OXLINT_HOST = process.env['BASALT_HOST'] === 'oxlint'

export type FixtureCase = {
  kind: 'valid' | 'invalid'
  code: string
  count: number
  options?: Options
  filename?: string
  ts?: true
}

type Pending = { head: RegExpMatchArray; lines: string[]; filename?: string; ts?: true }

/** Split one fixture file into its cases; text before the first marker is a header. */
function parseFixture(text: string): FixtureCase[] {
  const cases: FixtureCase[] = []
  let current: Pending | undefined
  const flush = (): void => {
    if (!current) return
    const [, kind, count, options] = current.head
    cases.push({
      kind: kind as 'valid' | 'invalid',
      code: current.lines.join('\n').trim(),
      count: count ? Number(count) : 1,
      ...(options ? { options: [JSON.parse(options)] } : {}),
      ...(current.filename ? { filename: current.filename } : {}),
      ...(current.ts ? { ts: true as const } : {}),
    })
  }
  for (const line of text.split('\n')) {
    const head = MARKER.exec(line)
    if (head) {
      flush()
      current = { head, lines: [] }
      continue
    }
    if (current && TS.test(line)) {
      current.ts = true
      continue
    }
    const filename = FILENAME.exec(line)
    if (filename?.[1] && current) current.filename = filename[1]
    else current?.lines.push(line)
  }
  flush()
  return cases
}

/** A case's host fields: its options, its file and, for a `@ts` case, the TS parser. */
const caseBase = ({ code, options, filename, ts }: FixtureCase): ValidCase => ({
  code,
  ...(options ? { options } : {}),
  ...(filename ? { filename } : {}),
  ...(ts ? { languageOptions: { parserOptions: { lang: 'tsx' as const } } } : {}),
})

export const readFixture = (form: Form): FixtureCase[] =>
  parseFixture(readFileSync(resolve(ROOT, form.fixture.replace(/^import-bypass\//, '')), 'utf8'))

/** The rule with every form on, so a disabled form is exercised too. */
export const enabledRule = (id: string, entry: RuleEntry): LintRule =>
  buildRule(id, { ...entry, forms: entry.forms.map((form) => ({ ...form, enabled: true })) })

/** One suite per form: its fixture's valid and invalid cases against the whole rule. */
export function fixtureSuites(id: string, entry: RuleEntry): Suite[] {
  const rule = enabledRule(id, entry)
  return entry.forms.map((form) => {
    const cases = readFixture(form).filter((c) => OXLINT_HOST || c.ts !== true)
    return {
      name: `${id}/${form.id}`,
      rule,
      cases: {
        valid: cases.filter((c) => c.kind === 'valid').map(caseBase),
        invalid: cases
          .filter((c) => c.kind === 'invalid')
          .map((c) => ({
            ...caseBase(c),
            errors: Array.from({ length: c.count }, () => ({ messageId: form.id })),
          })),
      },
    }
  })
}

/** The `@ts` cases of both rules: the oxlint host runs them beside `SUITES` as the ESLint host reads it. */
export const tsCaseCount = (): number =>
  [IMPORT_BOUNDARY, PRIMITIVE_BYPASS]
    .flatMap((entry) => entry.forms.flatMap(readFixture))
    .filter((c) => c.ts === true).length

export const SUITES: Suite[] = [
  ...fixtureSuites('import-boundary', IMPORT_BOUNDARY),
  ...fixtureSuites('primitive-bypass', PRIMITIVE_BYPASS),
]
