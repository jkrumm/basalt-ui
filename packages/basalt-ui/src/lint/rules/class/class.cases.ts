/**
 * The class family's RuleTester suites, built from the committed fixtures: one invalid and one
 * valid file per form (`<form>.tsx`, `<form>.valid.tsx`), the table's `fixture` path naming the
 * invalid one. ESLint runs them in process from `class.test.ts`; oxlint's `plugins-dev` runs the
 * bundled copy under Node through `factory.oxlint.mjs`, which is why the fixtures root can also
 * come from `BASALT_LINT_FIXTURES` (a bundle's `import.meta.dirname` is its output folder).
 *
 * An invalid fixture opens with one `// expect: <subject>` line per diagnostic, in source order;
 * each must report this form's message id and quote that subject. Nothing else may fire.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import type { LintRule } from '../../factory'
import { buildRule, classPatternRule } from '../../factory'
import type { Form } from '../../rule-table'
import { isEnabled } from '../../rule-table'
import { CLASS_RULES } from './table'

export const FIXTURES_ROOT =
  process.env['BASALT_LINT_FIXTURES'] ??
  resolve(import.meta.dirname, '../../../../test/fixtures/lint')

type ErrorCase = { messageId: string; data: { subject: string } }
export type Cases = {
  valid: { code: string; options?: unknown[] }[]
  invalid: { code: string; options?: unknown[]; errors: ErrorCase[] }[]
}
export type Suite = { name: string; rule: LintRule; cases: Cases }

const EXPECT = /^\/\/ expect: (.+)$/gm

export const readFixture = (path: string): string => readFileSync(join(FIXTURES_ROOT, path), 'utf8')
export const validPath = (form: Form): string => form.fixture.replace(/\.tsx$/, '.valid.tsx')

export const subjectsOf = (code: string): string[] =>
  [...code.matchAll(EXPECT)].map((match) => match[1] as string)

const errorsOf = (form: Form, code: string): ErrorCase[] =>
  subjectsOf(code).map((subject) => ({ messageId: form.id, data: { subject } }))

const entries = Object.entries(CLASS_RULES)

/** Per rule: every enabled form's invalid fixture and every form's valid fixture. */
const ruleSuites: Suite[] = entries.map(([id, entry]) => {
  const live = entry.forms.filter(isEnabled)
  return {
    name: id,
    rule: buildRule(id, entry),
    cases: {
      // A rule stays silent on every one of its forms' valid fixtures, and on a disabled form's
      // offender: the built-but-off form runs nothing.
      valid: [
        ...entry.forms.map((form) => ({ code: readFixture(validPath(form)) })),
        ...entry.forms
          .filter((form) => !isEnabled(form))
          .map((form) => ({ code: readFixture(form.fixture) })),
      ],
      invalid: live.map((form) => {
        const code = readFixture(form.fixture)
        return { code, errors: errorsOf(form, code) }
      }),
    },
  }
})

/** A disabled form fires once it is enabled: the pattern is proven before the flag flips. */
const disabledSuites: Suite[] = entries.flatMap(([id, entry]) =>
  entry.forms
    .filter((form) => !isEnabled(form))
    .map((form) => {
      const code = readFixture(form.fixture)
      return {
        name: `${id}/${form.id} (enabled)`,
        rule: classPatternRule({ ...form, enabled: true }),
        cases: {
          valid: [{ code: readFixture(validPath(form)) }],
          invalid: [{ code, errors: errorsOf(form, code) }],
        },
      }
    }),
)

/**
 * `tw-off-law` at bridge: the parts-only forms stand down, the bridge forms still fire. The
 * preset passes `{ profile: 'bridge' }`; the table carries one profile list per rule.
 */
const BRIDGE = [{ profile: 'bridge' }]
const bridgeSuite = (): Suite => {
  const entry = CLASS_RULES['tw-off-law']
  const gated = ['surface-recipe', 'app-colour', 'app-colour-arbitrary', 'fixed-width']
  const live = entry.forms.filter(isEnabled)
  return {
    name: 'tw-off-law (bridge)',
    rule: buildRule('tw-off-law', entry),
    cases: {
      valid: live
        .filter((form) => gated.includes(form.id))
        .map((form) => ({ code: readFixture(form.fixture), options: BRIDGE })),
      invalid: live
        .filter((form) => !gated.includes(form.id))
        .map((form) => {
          const code = readFixture(form.fixture)
          return { code, options: BRIDGE, errors: errorsOf(form, code) }
        }),
    },
  }
}

export const SUITES: Suite[] = [...ruleSuites, ...disabledSuites, bridgeSuite()]
