/**
 * `./table.css` is a published entry that a page with no Tailwind and no framework can import, so
 * the sheet stays plain CSS: no Tailwind directive, no import, everything in `@layer basalt.table`,
 * and it exists at the path the export map points at.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const SHEET = readFileSync(new URL('./table.css', import.meta.url), 'utf8')
const withoutComments = SHEET.replaceAll(/\/\*[\s\S]*?\*\//g, '')

describe('table.css', () => {
  test('is the sheet the export map publishes', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    expect(pkg.exports['./table.css']).toBe('./dist/table/table.css')
  })

  test('is plain CSS: no Tailwind directive and no import', () => {
    expect(withoutComments).not.toMatch(/@(source|apply|import|theme|utility|variant|plugin)\b/)
  })

  test('every rule sits in the basalt.table layer', () => {
    const outside = withoutComments.replace(/@layer basalt\.table \{[\s\S]*\}\s*$/, '').trim()
    expect(outside).toBe('')
  })

  test('a pinned or tick cell takes the surface the table sits on, never the bare canvas', () => {
    const rule = withoutComments.match(
      /\[data-slot='table-cell'\]:is\(\[data-pin\], \[data-kind='tick'\]\) \{([^}]*)\}/,
    )
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('background-color: var(--basalt-surface, var(--basalt-canvas))')
  })

  test('stays small: under 3 KB gzipped', () => {
    expect(gzipSync(SHEET).length).toBeLessThan(3072)
  })
})
