/**
 * The text scan for a file-level `disable` the host would use to hide `waiver-needs-reason`:
 * bare, or naming the rule. The shipped preset cannot report these (smoke test, `BLANKET_DISABLE`).
 */
import { describe, expect, it } from 'bun:test'

import { findBlanketDisables } from './blanket-disable'

describe('findBlanketDisables', () => {
  it('finds a bare block directive with a reason', () => {
    const found = findBlanketDisables('/* oxlint-disable -- vendored */\nconst a = 1\n')
    expect(found).toEqual([{ line: 1, text: 'oxlint-disable -- vendored', reach: 'every rule' }])
  })

  it('finds a bare directive with no reason, in both spellings and as a line comment', () => {
    const source = '/* eslint-disable */\n// oxlint-disable\nconst a = 1\n'
    expect(findBlanketDisables(source).map((f) => [f.line, f.reach])).toEqual([
      [1, 'every rule'],
      [2, 'every rule'],
    ])
  })

  it('finds a directive that names the rule itself, bare or namespaced', () => {
    const source = [
      '/* oxlint-disable basalt/waiver-needs-reason -- x */',
      '/* oxlint-disable react/no-array-index-key, waiver-needs-reason -- y */',
      '/* oxlint-disable basalt/* -- z */',
    ].join('\n')
    expect(findBlanketDisables(source).map((f) => f.reach)).toEqual([
      'waiver-needs-reason',
      'waiver-needs-reason',
      'waiver-needs-reason',
    ])
  })

  it('reports the line a multi-line comment starts on, after earlier multi-line text', () => {
    const source = '/**\n * header\n */\nconst a = `x\ny`\n/* oxlint-disable -- late */\n'
    expect(findBlanketDisables(source).map((f) => f.line)).toEqual([6])
  })

  it('ignores a directive that scopes to other rules', () => {
    const source = [
      '/* oxlint-disable basalt/colour-literal -- overlay */',
      '// oxlint-disable-next-line basalt/raw-scroll -- why',
      '// oxlint-disable-line',
    ].join('\n')
    expect(findBlanketDisables(source)).toEqual([])
  })

  it('ignores a comment that only mentions the token', () => {
    const source = '// see the oxlint-disable directive\n/* the eslint-disable pragma */\n'
    expect(findBlanketDisables(source)).toEqual([])
  })

  it('ignores a directive quoted inside a string or template literal', () => {
    const source = [
      "const a = '/* oxlint-disable */'",
      'const b = "// oxlint-disable"',
      'const c = `',
      '/* eslint-disable */',
      '`',
      "const d = 'it\\'s // oxlint-disable'",
    ].join('\n')
    expect(findBlanketDisables(source)).toEqual([])
  })

  it('finds a directive after a string that contains a quote-like comment opener', () => {
    const source = "const a = '//'\n/* oxlint-disable */\n"
    expect(findBlanketDisables(source).map((f) => f.line)).toEqual([2])
  })
})
