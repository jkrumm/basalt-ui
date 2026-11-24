import { describe, expect, test } from 'bun:test'

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  checkAllRuleFiles,
  checkRuleTags,
  loadSources,
  ruleFiles,
  TYPE_TEST,
  typeTestSource,
} from './check-rule-tags'
import { entryExports } from './entry-exports'
import type { TagSources } from './check-rule-tags'

const fence = '```'
const sources: TagSources = {
  lintIds: new Set(['colour-literal', 'import-boundary']),
  typeNames: new Set(['PageBarProps']),
}
const doc = (...body: string[]): string =>
  ['---', 'source: basalt-ui', '---', '<!-- generated -->', '# T', '', ...body].join('\n')
const run = (...body: string[]) => checkRuleTags(doc(...body), sources)

describe('checkRuleTags', () => {
  test('accepts tagged bullets, an intro line, headings and fenced code', () => {
    const report = run(
      'One intro line.',
      '',
      '## A',
      '',
      '- Use it. [lint:colour-literal] [lint:import-boundary]',
      '- Typed. [type:PageBarProps]',
      '',
      fence + 'ts',
      'not a bullet',
      fence,
    )
    expect(report.failures).toEqual([])
  })

  test('flags a bullet with no tag', () => {
    expect(run('- No tag here.').failures).toEqual([
      {
        line: 7,
        message:
          "bullet does not end in [lint:<id>] or [type:<name>] and is not under 'not guarded:'",
      },
    ])
  })

  test('flags an unknown lint id and an unknown type name', () => {
    expect(run('- A [lint:nope]', '- B [type:Nope]').failures.map((f) => f.message)).toEqual([
      '[lint:nope] is not a key of the lint rule table',
      '[type:Nope] is not exported from a published entry',
    ])
  })

  test('a bullet under `not guarded:` needs no tag, until the next heading', () => {
    const report = run(
      '## A',
      '',
      'not guarded:',
      '',
      '- Honest about it.',
      '',
      '## B',
      '',
      '- Back to the law.',
    )
    expect(report.failures).toEqual([
      {
        line: 15,
        message:
          "bullet does not end in [lint:<id>] or [type:<name>] and is not under 'not guarded:'",
      },
    ])
  })

  test('takes a tag from a continuation line and judges where the tag sits', () => {
    expect(run('- Long bullet', '  continues. [type:PageBarProps]').failures).toEqual([])
    expect(run('- Tagged [type:PageBarProps] but trailing prose.').failures).toHaveLength(1)
  })

  test('the old 2.x tag forms are not tags', () => {
    expect(run('- A [basalt/hand-rolled-shell]').failures).toHaveLength(1)
    expect(run('- A [type PageBar]').failures).toHaveLength(1)
  })

  test('allows prose only as the ONE line under the H1', () => {
    expect(run('Intro.').failures).toEqual([])
    expect(run('Intro.', 'Second line.').failures.map((f) => f.line)).toEqual([8])
    const later = run('Intro.', '', '## A', '', 'Prose after a heading.')
    expect(later.failures.map((f) => f.line)).toEqual([11])
  })

  test('ignores a bullet-shaped line inside a multi-line HTML comment', () => {
    expect(run('<!--', '- not a bullet', '-->', '- real [type:PageBarProps]').failures).toEqual([])
  })
})

describe('sources', () => {
  const entries = entryExports(join(import.meta.dir, '..'))

  test('a contract type no entry exports does not resolve; its published home does', () => {
    const real = loadSources(entries)
    expect(real.lintIds.has('import-boundary')).toBe(true)
    expect(real.typeNames.has('PageBarProps')).toBe(true)
    // `ShellNav` is declared in shell/contract.ts and exported by no entry
    expect(real.typeNames.has('ShellNav')).toBe(false)
    expect(entries.get('basalt-ui/page')?.has('PageBarProps')).toBe(true)
  })

  test('core/* paths are no home: a name only core/ports declares is not public', () => {
    expect([...entries.keys()].some((s) => s.startsWith('basalt-ui/core/'))).toBe(false)
    expect(loadSources(entries).typeNames.has('PageHost')).toBe(false)
  })

  test('the type test imports each name from a subpath before the root shadow', () => {
    const map = new Map([
      ['basalt-ui', new Set(['Phase', 'NavTarget'])],
      ['basalt-ui/cards', new Set(['Phase'])],
    ])
    expect(typeTestSource(['NavTarget', 'Phase'], map).split('\n').slice(2, 4)).toEqual([
      "export type { NavTarget } from 'basalt-ui'",
      "export type { Phase } from 'basalt-ui/cards'",
    ])
  })

  test(`${TYPE_TEST} is current`, () => {
    const { typeNames } = checkAllRuleFiles(loadSources(entries))
    expect(readFileSync(join(import.meta.dir, '..', TYPE_TEST), 'utf8')).toBe(
      typeTestSource(typeNames, entries),
    )
  })
})

describe('the shipped rules', () => {
  test('pass the tag law', () => {
    expect(checkAllRuleFiles().messages).toEqual([])
  })

  test('are exactly the five files', () => {
    expect(ruleFiles().map((f) => f.split('/').pop())).toEqual([
      'basalt-charts.md',
      'basalt-page.md',
      'basalt-state.md',
      'basalt-tokens.md',
      'basalt-ui.md',
    ])
  })

  test('a scratch rules dir with an untagged bullet and an unknown lint id fails; `not guarded:` passes', () => {
    const pkg = mkdtempSync(join(tmpdir(), 'rule-tags-'))
    mkdirSync(join(pkg, 'agent/rules'), { recursive: true })
    writeFileSync(join(pkg, 'agent/rules/a.md'), doc('- Untagged.'))
    writeFileSync(join(pkg, 'agent/rules/b.md'), doc('- Unknown. [lint:nope]'))
    writeFileSync(join(pkg, 'agent/rules/c.md'), doc('not guarded:', '', '- Fine.'))
    const { messages } = checkAllRuleFiles(sources, pkg)
    expect(messages.filter((m) => m.startsWith('agent/rules/a.md'))).toHaveLength(1)
    expect(messages.filter((m) => m.startsWith('agent/rules/b.md'))).toHaveLength(1)
    expect(messages.filter((m) => m.startsWith('agent/rules/c.md'))).toEqual([])
  })
})
