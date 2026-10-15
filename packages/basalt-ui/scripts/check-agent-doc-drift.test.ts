import { describe, expect, test } from 'bun:test'

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  checkDocNames,
  checkF,
  checkI,
  leadingDocComment,
  checkG,
  checkLlmsNames,
  checkRuleSets,
  collectExportKeys,
  collectPublishedBySubpath,
  collectPublishedNames,
  findAgentFiles,
  findDeadSpecifiers,
  findRuleFiles,
  loadTagSources,
  pluginRuleIds,
} from './check-agent-doc-drift'
import * as pluginModule from '../configs/oxlint-plugin.js'
import { coverageBlock } from './check-coverage'
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
      { line: 7, message: 'bullet does not end in an enforcement tag' },
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

  test('flags a tag that is not at the end of the bullet', () => {
    expect(checkF(doc('- Tagged [type PageBar] but trailing prose.'), sources)).toHaveLength(1)
    expect(checkF(doc('- Long [type PageBar]', '  trailing words'), sources)).toHaveLength(1)
  })

  test('judges nested bullets', () => {
    expect(checkF(doc('- Parent [type PageBar]', '  - nested, untagged'), sources)).toEqual([
      { line: 8, message: 'bullet does not end in an enforcement tag' },
    ])
  })

  test('allows prose only directly under the H1', () => {
    expect(checkF(doc('Intro.'), sources)).toEqual([])
    const later = doc('Intro.', '', '## A', '', 'Prose after a heading.', '', '| a | b |')
    expect(checkF(later, sources).map((f) => f.line)).toEqual([11, 13])
    expect(
      checkF(doc('- Tagged [type PageBar]', '', 'Prose after a bullet.'), sources),
    ).toHaveLength(1)
  })

  test('allows ONE intro line: a second paragraph or a table under the H1 fails', () => {
    expect(checkF(doc('Intro.', 'Second line.'), sources).map((f) => f.line)).toEqual([8])
    expect(checkF(doc('Intro.', '', 'Second paragraph.'), sources).map((f) => f.line)).toEqual([9])
    expect(checkF(doc('| a | b |'), sources)).toEqual([])
    expect(checkF(doc('Intro.', '| a | b |'), sources).map((f) => f.line)).toEqual([8])
  })

  test('judges `*` and numbered bullets like `-` bullets', () => {
    const md = doc(
      '* star [type PageBar]',
      '* star untagged',
      '1. numbered untagged',
      '2. ok [type PageBar]',
    )
    expect(checkF(md, sources).map((f) => f.line)).toEqual([8, 9])
  })

  test('ignores a bullet-shaped line inside a multi-line HTML comment', () => {
    const md = doc('<!--', '- not a bullet', '-->', '- real [type PageBar]')
    expect(checkF(md, sources)).toEqual([])
  })

  test('handles a file with no frontmatter', () => {
    const md = ['# T', '', 'Intro.', '', '- ok [type PageBar]', '- bad'].join('\n')
    expect(checkF(md, sources)).toEqual([
      { line: 6, message: 'bullet does not end in an enforcement tag' },
    ])
  })

  test('flags a removed rule id used as a tag', () => {
    expect(checkF(doc('- A [basalt/page-bar-budget]'), sources)[0]?.message).toBe(
      '[basalt/page-bar-budget] was removed in 2.0',
    )
  })
})

const scan = (text: string): string[] => {
  const file = join(mkdtempSync(join(tmpdir(), 'drift-g-')), 'x.md')
  writeFileSync(file, text)
  return checkG([file]).map((f) => f.id)
}

describe('checkG', () => {
  test('reports a repo-local id inside a coverage block too', () => {
    expect(
      scan(
        '<!-- basalt:coverage -->\n<!-- backed by: basalt/chart-host-single -->\n<!-- /basalt:coverage -->',
      ),
    ).toEqual(['chart-host-single'])
  })

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

describe('checkRuleSets', () => {
  test('flags a repo-local id the plugin lost and a removed id it never retired', () => {
    const messages = checkRuleSets([], new Set())
    expect(messages).toContain(
      "REPO_LOCAL_RULES['chart-host-single'] is not registered in configs/oxlint-plugin.js",
    )
    expect(messages).toContain(
      "REMOVED_RULES['page-bar-budget'] is not in RETIRED_RULE_IDS (configs/oxlint-plugin.js)",
    )
  })
})

describe('the real plugin', () => {
  test('REPO_LOCAL and REMOVED rule sets match the registry and RETIRED_RULE_IDS', () => {
    expect(checkRuleSets(pluginRuleIds(pluginModule), pluginModule.RETIRED_RULE_IDS)).toEqual([])
  })
})

describe('pluginRuleIds', () => {
  test('names the problem when the default export is not a plugin', () => {
    expect(() => pluginRuleIds({})).toThrow("has no 'rules' object")
  })
})

describe('checkLlmsNames', () => {
  const published = new Map([
    ['basalt-ui', new Set(['BasaltProvider'])],
    ['basalt-ui/charts', new Set(['Lines'])],
  ])
  test('flags a name that is not an export of THAT subpath', () => {
    const text = [
      '# basalt-ui            BasaltProvider, Lines',
      '# basalt-ui/charts     Lines, Gone',
    ].join('\n')
    expect(checkLlmsNames(text, published).map((f) => f.message)).toEqual([
      "'Lines' is not a published export of basalt-ui",
      "'Gone' is not a published export of basalt-ui/charts",
    ])
  })

  test('flags a header line that is not in the entry shape or names an unknown subpath', () => {
    const text = ['# basalt-ui is a thing', '# basalt-ui/nope     X', '# basalt-ui v1.0.0'].join(
      '\n',
    )
    expect(checkLlmsNames(text, published)).toHaveLength(2)
  })

  test('accepts the real shipped llms.txt', () => {
    const text = readFileSync(join(import.meta.dir, '..', 'llms.txt'), 'utf8')
    expect(checkLlmsNames(text, collectPublishedBySubpath())).toEqual([])
  })
})

describe('checkDocNames (Check I)', () => {
  const exportsOf = new Set(['FormRow', 'useBasaltForm'])
  const elsewhere = new Set(['BasaltProvider', 'createThing'])

  test('a barrel naming a missing export fails', () => {
    const doc = leadingDocComment(
      '/**\n * Uses `useBasaltForm`, `FormSection` and `useFormSubmit`.\n */\nexport {}',
    )
    expect(checkDocNames('fixture', 'basalt-ui/forms', doc, exportsOf).map((f) => f.name)).toEqual([
      'FormSection',
      'useFormSubmit',
    ])
  })

  test('plain camelCase prose passes, but a camelCase export of another subpath fails', () => {
    const text = 'the `options` prop, `createThing`'
    expect(
      checkDocNames('fixture', 'basalt-ui/forms', text, exportsOf, elsewhere).map((f) => f.name),
    ).toEqual(['createThing'])
  })

  test('an allow-listed <subpath>:<name> term passes only on that subpath', () => {
    const allow = new Set(['basalt-ui/forms:Intl'])
    expect(checkDocNames('f', 'basalt-ui/forms', '`Intl`', exportsOf, new Set(), allow)).toEqual([])
    expect(
      checkDocNames('f', 'basalt-ui/format', '`Intl`', exportsOf, new Set(), allow),
    ).toHaveLength(1)
  })

  test('the shipped barrels and SURFACES descriptions are clean', () => {
    expect(checkI(collectPublishedBySubpath())).toEqual([])
  })
})

describe('collectPublishedNames', () => {
  test('covers the entry files only', () => {
    const names = collectPublishedNames()
    expect(names.has('BarAction')).toBe(true)
    expect(names.has('BasaltProviderProps')).toBe(false)
  })
})

describe('coverageBlock', () => {
  test('never names a repo-local rule id', () => {
    for (const rule of ['tokens', 'mantine', 'charts', 'state', 'controls', 'batteries'] as const) {
      expect(coverageBlock(rule)).not.toMatch(
        /chart-host-single|token-layer-boundary|no-dev-helper|no-import-meta-env/,
      )
    }
  })
})

describe('the shipped agent layer', () => {
  test('every rule bullet is tagged and resolves, and no agent file cites a bad rule', () => {
    const sources = loadTagSources()
    for (const file of findRuleFiles()) {
      expect(checkF(readFileSync(file, 'utf8'), sources)).toEqual([])
    }
    expect(checkG(findAgentFiles())).toEqual([])
  })
})
