import { describe, expect, test } from 'bun:test'

import { FRONTMATTER_KEYS, checkExport, formatExportDoc } from './docs-format'
import type { ExportInfo } from './docs-format'

const fixture: ExportInfo = {
  name: 'Button',
  subpath: 'basalt-ui/ui/button',
  peers: ['@base-ui/react'],
  slots: ['button', 'button-icon'],
  jsdoc: {
    summary: 'A pressable control.',
    useWhen: 'an action needs a labelled trigger',
    neverWhen: 'it navigates: use a link',
  },
}

describe('formatExportDoc', () => {
  test('a fixture export yields the six frontmatter keys, in order, and no problems', () => {
    const { markdown, problems } = formatExportDoc(fixture)
    const front = markdown.split('---\n')[1] ?? ''
    const keys = front
      .trim()
      .split('\n')
      .map((line) => line.slice(0, line.indexOf(':')))
    expect(keys).toEqual([...FRONTMATTER_KEYS])
    expect(markdown).toContain('subpath: basalt-ui/ui/button')
    expect(markdown).toContain("peers: ['@base-ui/react']")
    expect(markdown).toContain('slots: [button, button-icon]')
    expect(markdown).toContain("never when: 'it navigates: use a link'")
    expect(markdown).toContain('A pressable control.')
    expect(problems).toEqual([])
  })

  test('an export without JSDoc is reported, and still renders all six keys', () => {
    const bare: ExportInfo = { ...fixture, jsdoc: null }
    const { markdown, problems } = formatExportDoc(bare)
    expect(problems).toEqual([
      { name: 'Button', field: 'jsdoc', message: 'Button: JSDoc is required' },
    ])
    for (const key of FRONTMATTER_KEYS) expect(markdown).toContain(`\n${key}:`)
  })

  test('a JSDoc missing a routing tag is reported per gap', () => {
    const partial: ExportInfo = {
      ...fixture,
      jsdoc: { summary: 'A pressable control.', useWhen: '', neverWhen: ' ' },
    }
    expect(checkExport(partial).map((p) => p.field)).toEqual(['useWhen', 'neverWhen'])
  })
})
