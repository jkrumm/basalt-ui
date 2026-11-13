import { describe, expect, test } from 'bun:test'

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CHECK_I_NON_EXPORTS,
  checkDocNames,
  checkG,
  checkI,
  checkLlmsNames,
  checkRuleSets,
  collectExportKeys,
  collectPublishedBySubpath,
  collectPublishedNames,
  findAgentFiles,
  findDeadSpecifiers,
  leadingDocComment,
  pluginRuleIds,
} from './check-agent-doc-drift'
import * as pluginModule from '../configs/oxlint-plugin.js'
import { checkAllRuleFiles } from './check-rule-tags'
import { generateLlmsTxt } from './gen-llms'

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

  test('accepts the generated llms.txt', () => {
    expect(checkLlmsNames(generateLlmsTxt(), collectPublishedBySubpath())).toEqual([])
  }, 30_000)
})

describe('leadingDocComment', () => {
  test('returns the JSDoc body when it comes first, whitespace before it allowed', () => {
    expect(leadingDocComment('\n\n  /** hello `X` */\nexport {}')).toBe(' hello `X` ')
  })

  test('skips line comments and plain block comments before the JSDoc', () => {
    expect(leadingDocComment('// licence\n/* note */\n/** doc */\nexport {}')).toBe(' doc ')
  })

  test('is undefined when a statement or a non-JSDoc comment only comes first', () => {
    expect(leadingDocComment("import x from 'y'\n/** late */")).toBeUndefined()
    expect(leadingDocComment('// only a line comment')).toBeUndefined()
    expect(leadingDocComment('/**/ export {}')).toBeUndefined()
    expect(leadingDocComment('')).toBeUndefined()
  })

  test('throws on an unterminated block', () => {
    expect(() => leadingDocComment('/** never closed')).toThrow('unterminated')
  })
})

describe('checkDocNames (Check I)', () => {
  const published = new Set(['FormRow', 'useBasaltForm'])
  const run = (text: string, allow: ReadonlySet<string> = new Set()) =>
    checkDocNames({ where: 'fixture', spec: 'basalt-ui/forms', text, published, allow })

  test('a barrel naming a missing export fails', () => {
    const doc =
      leadingDocComment('/**\n * `useBasaltForm`, `FormSection`, `useFormSubmit`.\n */') ?? ''
    expect(run(doc).map((f) => f.message)).toEqual([
      expect.stringContaining('`FormSection`'),
      expect.stringContaining('`useFormSubmit`'),
    ])
  })

  test('fails closed: an invented lower-camel, acronym-led or ALL_CAPS name fails', () => {
    expect(run('`madeUpOption` `UUIDField` `CSSProps` `URL`')).toHaveLength(4)
  })

  test('an allow-listed <subpath>:<name> term passes only on that subpath', () => {
    const allow = new Set(['basalt-ui/forms:key'])
    expect(run('`key`', allow)).toEqual([])
    expect(
      checkDocNames({ where: 'f', spec: 'basalt-ui/format', text: '`key`', published, allow }),
    ).toHaveLength(1)
  })

  test('the shipped barrels and SURFACES descriptions are clean', () => {
    expect(checkI(collectPublishedBySubpath())).toEqual([])
  })

  test('every CHECK_I_NON_EXPORTS entry is still needed: used in prose, absent from its subpath', () => {
    const published = collectPublishedBySubpath()
    const withoutAllowList = checkI(published, new Set()).map((f) => f.message)
    for (const entry of CHECK_I_NON_EXPORTS) {
      const [spec, name] = entry.split(':') as [string, string]
      expect(published.get(spec)?.has(name), `${entry} is a real export now`).toBe(false)
      expect(
        withoutAllowList.some((m) => m.includes(`'${entry}'`)),
        `${entry} no longer appears in prose`,
      ).toBe(true)
    }
  })
})

describe('collectPublishedNames', () => {
  test('covers the entry files only', () => {
    const names = collectPublishedNames()
    expect(names.has('BarAction')).toBe(true)
    expect(names.has('BasaltProviderProps')).toBe(true)
    expect(names.has('SlotProps')).toBe(false)
  })
})

describe('the shipped agent layer', () => {
  test('every rule bullet is tagged and resolves, and no agent file cites a bad rule', () => {
    expect(checkAllRuleFiles().messages).toEqual([])
    expect(checkG(findAgentFiles())).toEqual([])
  })
})
