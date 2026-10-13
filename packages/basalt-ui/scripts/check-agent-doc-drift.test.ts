import { describe, expect, test } from 'bun:test'

import { collectExportKeys, findDeadSpecifiers } from './check-agent-doc-drift'

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
