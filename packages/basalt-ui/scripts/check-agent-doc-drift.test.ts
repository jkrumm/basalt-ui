import { describe, expect, test } from 'bun:test'

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkF, checkG, collectExportKeys, findDeadSpecifiers } from './check-agent-doc-drift'
import type { TagSources } from './check-agent-doc-drift'

const fence = '```'
const keys = collectExportKeys()

describe('findDeadSpecifiers', () => {
  test('flags a specifier whose subpath is not in exports', () => {
    const md = [fence + 'ts', "import { notify } from 'basalt-ui/notifications'", fence].join('\n')
    expect(findDeadSpecifiers(md, keys)).toEqual([
      { line: 2, specifier: 'basalt-ui/notifications' },
    ])
  })

  test('accepts the root, a real subpath and the configs glob', () => {
    const md = [
      fence + 'tsx',
      "import { BasaltProvider } from 'basalt-ui'",
      "import { field } from 'basalt-ui/state'",
      "import 'basalt-ui/styles.css'",
      'extends: ["basalt-ui/configs/oxlint.json"]',
      fence,
    ].join('\n')
    expect(findDeadSpecifiers(md, keys)).toEqual([])
  })

  test('ignores specifiers outside fenced code blocks', () => {
    const md = "Prose naming 'basalt-ui/notifications' is not an import."
    expect(findDeadSpecifiers(md, keys)).toEqual([])
  })

  test('does not resolve a prefix of a real subpath', () => {
    const md = [fence + 'ts', "import x from 'basalt-ui/stat'", fence].join('\n')
    expect(findDeadSpecifiers(md, keys)).toEqual([{ line: 2, specifier: 'basalt-ui/stat' }])
  })
})

const sources: TagSources = {
  pluginRules: new Set(['hand-rolled-shell']),
  guardKinds: new Set(['raw-hex']),
  typeNames: new Set(['PageBar']),
}
const doc = (...body: string[]): string =>
  ['---', 'source: basalt-ui', '---', '<!-- generated -->', '# T', '', ...body].join('\n')

describe('checkF', () => {
  test('accepts a tagged bullet, an intro line, headings and fenced code', () => {
    const md = doc(
      'One intro line.',
      '',
      '## A',
      '',
      '- Use it. [basalt/hand-rolled-shell] [check-theme raw-hex]',
      '- Typed. [type PageBar]',
      '',
      fence + 'ts',
      'not a bullet',
      fence,
    )
    expect(checkF(md, sources)).toEqual([])
  })

  test('flags a bullet with no tag', () => {
    expect(checkF(doc('- No tag here.'), sources)).toEqual([
      { line: 7, message: 'bullet carries no enforcement tag' },
    ])
  })

  test('takes a tag from a continuation line of the same bullet', () => {
    expect(checkF(doc('- Long bullet', '  continues. [type PageBar]'), sources)).toEqual([])
  })

  test('flags a plugin rule, guard kind or name that does not resolve', () => {
    const messages = checkF(
      doc('- A [basalt/nope]', '- B [check-theme nope]', '- C [type Nope]'),
      sources,
    ).map((f) => f.message)
    expect(messages).toEqual([
      '[basalt/nope] is not a shipped plugin rule',
      '[check-theme nope] is not a guard kind',
      '[type Nope] is not an exported name',
    ])
  })

  test('flags a repo-local rule id used as a tag', () => {
    const withLocal = { ...sources, pluginRules: new Set(['chart-host-single']) }
    expect(checkF(doc('- A [basalt/chart-host-single]'), withLocal)[0]?.message).toBe(
      '[basalt/chart-host-single] is repo-local and never ships',
    )
  })

  test('flags a second prose line and a table row', () => {
    const md = doc('Intro.', 'Second paragraph.', '', '| a | b |')
    expect(checkF(md, sources).map((f) => f.line)).toEqual([8, 10])
  })
})

const scan = (text: string): string[] => {
  const file = join(mkdtempSync(join(tmpdir(), 'drift-g-')), 'x.md')
  writeFileSync(file, text)
  return checkG([file]).map((f) => f.id)
}

describe('checkG', () => {
  test('rejects repo-local and removed rule ids', () => {
    expect(scan('see basalt/chart-host-single\nand `no-dev-helper`')).toEqual([
      'chart-host-single',
      'no-dev-helper',
    ])
    expect(scan('`page-bar-budget` fires')).toEqual(['page-bar-budget'])
  })

  test('does not match a longer id that contains one', () => {
    expect(scan('basalt/agent-resume-guard-extra')).toEqual([])
  })
})
