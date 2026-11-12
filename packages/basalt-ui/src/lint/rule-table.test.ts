/**
 * The table's own gate: a form with no fix or fixture, a duplicate id or a 19th id fails here, and
 * every derived list (ids, waiver ids, preset input, coverage, reference) comes from one table.
 */
import { describe, expect, it } from 'bun:test'

import type { ClassForm, RuleEntry } from './rule-table'
import {
  COVERAGE_END,
  COVERAGE_START,
  defineRules,
  formCount,
  ID_CEILING,
  isKnownWaiverId,
  knownWaiverIds,
  mergeTables,
  presetInput,
  renderCoverage,
  renderReference,
  RuleTableError,
  ruleIds,
  spliceCoverage,
} from './rule-table'

const form = (id: string, extra: Partial<ClassForm> = {}): ClassForm => ({
  id,
  pattern: /^dark:/,
  fix: 'Tokens switch per scheme; add the token',
  next: 'A reasoned waiver',
  fixture: `synthetic/${id}.tsx`,
  ...extra,
})

const entry = (extra: Partial<RuleEntry> = {}): RuleEntry => ({
  family: 'class',
  profiles: ['bridge', 'parts', 'app'],
  defect: 'synthetic',
  forms: [form('one')],
  ...extra,
})

/** `size` valid ids from `rule-<start>` on, one form and fixture each. */
const family = (start: number, size: number) =>
  defineRules(
    Object.fromEntries(
      Array.from({ length: size }, (_, i) => `rule-${start + i}`).map((id) => [
        id,
        entry({ forms: [form('a', { fixture: `${id}/a.tsx` })] }),
      ]),
    ),
  )

const problemsOf = (fn: () => unknown): readonly string[] => {
  try {
    fn()
  } catch (error) {
    if (error instanceof RuleTableError) return error.problems
    throw error
  }
  return []
}

const TABLE = defineRules({
  'dark-fork': entry({ zonesOff: ['vendored'], forms: [form('prefix')] }),
  'app-spacing': entry({
    profiles: ['parts', 'app'],
    zonesOff: ['ejected', 'seed', 'vendored'],
    forms: [
      form('margin'),
      form('padding', { enabled: false, reason: 'off until a structural F5P retest' }),
    ],
  }),
  'router-search': entry({ family: 'structure', profiles: ['parts', 'app'], forms: [] }),
  'no-dev-helper': entry({ family: 'structure', profiles: ['repo'], forms: [form('is-dev')] }),
})

describe('defineRules', () => {
  it('accepts a valid table and freezes it', () => {
    expect(Object.isFrozen(TABLE)).toBe(true)
    expect(ruleIds(TABLE)).toEqual(['dark-fork', 'app-spacing', 'router-search', 'no-dev-helper'])
  })

  it('fails on a form with no fix text', () => {
    expect(
      problemsOf(() => defineRules({ x: entry({ forms: [form('a', { fix: '  ' })] }) })),
    ).toEqual(['x/a: no fix text'])
  })

  it('fails on a fix that only denies', () => {
    expect(
      problemsOf(() => defineRules({ x: entry({ forms: [form('a', { fix: 'Not allowed.' })] }) })),
    ).toEqual(['x/a: fix names no fix ("Not allowed.")'])
  })

  it('fails on a form with no next rung', () => {
    expect(
      problemsOf(() => defineRules({ x: entry({ forms: [form('a', { next: '' })] }) })),
    ).toEqual(['x/a: no next text'])
  })

  it('fails on a form with no fixture path', () => {
    expect(
      problemsOf(() => defineRules({ x: entry({ forms: [form('a', { fixture: '' })] }) })),
    ).toEqual(['x/a: no fixture path'])
  })

  it('fails on a fixture shared by two forms', () => {
    const shared = { fixture: 'synthetic/shared.tsx' }
    expect(
      problemsOf(() =>
        defineRules({ x: entry({ forms: [form('a', shared), form('b', shared)] }) }),
      ),
    ).toEqual(['x/b: fixture synthetic/shared.tsx already used by x/a'])
  })

  it('fails on a duplicate form id', () => {
    expect(
      problemsOf(() =>
        defineRules({ x: entry({ forms: [form('a'), form('a', { fixture: 'other.tsx' })] }) }),
      ),
    ).toEqual(['x/a: duplicate form id'])
  })

  it('fails on a disabled form without a reason', () => {
    expect(
      problemsOf(() => defineRules({ x: entry({ forms: [form('a', { enabled: false })] }) })),
    ).toEqual(['x/a: a disabled form needs a reason'])
  })

  it('fails on a global pattern, a bad id and an unknown profile', () => {
    expect(
      problemsOf(() =>
        defineRules({
          Bad_Id: entry({ profiles: ['tokens' as never], forms: [form('a', { pattern: /x/g })] }),
        }),
      ),
    ).toEqual([
      'Bad_Id: rule id is not kebab-case',
      'Bad_Id: unknown profile "tokens"',
      'Bad_Id/a: pattern must not be global or sticky (lastIndex carries between tokens)',
    ])
  })

  it(`fails on more than ${ID_CEILING} ids`, () => {
    expect(problemsOf(() => family(0, ID_CEILING + 1))).toEqual([
      `19 ids exceed the ceiling of ${ID_CEILING}`,
    ])
    expect(problemsOf(() => family(0, ID_CEILING))).toEqual([])
  })
})

describe('mergeTables', () => {
  it('fails on an id declared by two families', () => {
    const a = defineRules({ 'dark-fork': entry({ forms: [form('a', { fixture: 'a/a.tsx' })] }) })
    const b = defineRules({ 'dark-fork': entry({ forms: [form('b', { fixture: 'b/b.tsx' })] }) })
    expect(problemsOf(() => mergeTables([a, b]))).toEqual(['dark-fork: duplicate rule id'])
  })

  it('fails when the families together pass the ceiling', () => {
    expect(problemsOf(() => mergeTables([family(0, 10), family(10, 9)]))).toEqual([
      `19 ids exceed the ceiling of ${ID_CEILING}`,
    ])
  })

  it('keeps family order', () => {
    const merged = mergeTables([
      defineRules({ b: entry({ forms: [form('a', { fixture: 'b.tsx' })] }) }),
      defineRules({ a: entry({ forms: [form('a', { fixture: 'a.tsx' })] }) }),
    ])
    expect(ruleIds(merged)).toEqual(['b', 'a'])
  })
})

describe('derived lists', () => {
  it('knows exactly the table ids as waiver ids', () => {
    expect(knownWaiverIds(TABLE)).toEqual([
      'basalt/dark-fork',
      'basalt/app-spacing',
      'basalt/router-search',
      'basalt/no-dev-helper',
    ])
    expect(isKnownWaiverId(TABLE, 'basalt/dark-fork')).toBe(true)
    expect(isKnownWaiverId(TABLE, 'basalt/important-modifier')).toBe(false)
    expect(isKnownWaiverId(TABLE, 'dark-fork')).toBe(false)
  })

  it('counts enabled forms only', () => {
    expect(formCount(TABLE)).toBe(3)
  })

  it('generates the preset input per profile and zone', () => {
    expect(presetInput(TABLE)).toEqual({
      plugin: 'basalt',
      profiles: {
        bridge: ['basalt/dark-fork'],
        parts: ['basalt/dark-fork', 'basalt/app-spacing', 'basalt/router-search'],
        app: ['basalt/dark-fork', 'basalt/app-spacing', 'basalt/router-search'],
        repo: ['basalt/no-dev-helper'],
      },
      zonesOff: {
        ejected: ['basalt/app-spacing'],
        seed: ['basalt/app-spacing'],
        vendored: ['basalt/dark-fork', 'basalt/app-spacing'],
      },
    })
  })
})

describe('renderCoverage', () => {
  it('prints a not guarded line for a form marked unguarded and for an id with no form', () => {
    expect(
      renderCoverage({ table: TABLE, ids: ['dark-fork', 'app-spacing', 'router-search'] }),
    ).toBe(
      [
        COVERAGE_START,
        '<!-- GENERATED from src/lint/rule-table.ts. Do not hand-edit. -->',
        '<!-- guarded: basalt/dark-fork (prefix) · basalt/app-spacing (margin) -->',
        '<!-- not guarded: basalt/app-spacing/padding: off until a structural F5P retest -->',
        '<!-- not guarded: basalt/router-search: no live form yet -->',
        COVERAGE_END,
      ].join('\n'),
    )
  })

  it('adds advisory laws and refuses an unknown id', () => {
    const block = renderCoverage({ table: TABLE, ids: ['dark-fork'], advisory: ['fake titles'] })
    expect(block).toContain('<!-- not guarded: fake titles -->')
    expect(problemsOf(() => renderCoverage({ table: TABLE, ids: ['nope'] }))).toEqual([
      'nope: not in the rule table',
    ])
  })

  it('splices into exactly one block', () => {
    const block = renderCoverage({ table: TABLE, ids: ['dark-fork'] })
    const doc = `# Rule\n\n${COVERAGE_START}\nstale\n${COVERAGE_END}\n\n- bullet\n`
    expect(spliceCoverage(doc, block)).toBe(`# Rule\n\n${block}\n\n- bullet\n`)
    expect(problemsOf(() => spliceCoverage('# no block', block))).toEqual([
      'doc needs exactly one coverage block',
    ])
    expect(problemsOf(() => spliceCoverage(doc + doc, block))).toEqual([
      'doc needs exactly one coverage block',
    ])
  })
})

describe('renderReference', () => {
  it('has one row per form and marks disabled forms off', () => {
    const reference = renderReference(TABLE)
    expect(reference.split('\n').slice(0, 2)).toEqual([
      '| Rule | Form | Profiles | Fix | Next |',
      '|-|-|-|-|-|',
    ])
    expect(reference).toContain(
      '| `basalt/app-spacing` | padding | parts, app | off: off until a structural F5P retest | A reasoned waiver |',
    )
    expect(reference).toContain('| `basalt/router-search` | — | parts, app | — | — |')
    expect(reference.split('\n')).toHaveLength(2 + 5)
  })
})
