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
      /\[data-slot='table-cell'\]:is\(\[data-pin\], \[data-kind='tick'\], \[data-kind='row-number'\]\) \{([^}]*)\}/,
    )
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('background-color: var(--basalt-surface, var(--basalt-canvas))')
  })

  test('the phone projections: cards is a list row, fields the label-and-value grid, in every tier', () => {
    for (const below of ['480', '700', '800', 'always']) {
      const root = `[data-slot='table-root'][data-below='${below}']`
      const flat = withoutComments.replaceAll(/\s+/g, ' ')
      const block = flat.slice(
        flat.indexOf(`${root}:is([data-phone='cards'], [data-phone='fields'])`),
      )
      // fields keeps the header prefix and the stacked grid
      expect(block).toContain(
        `${root}[data-phone='fields'] [data-slot='table-cell'][data-label]::before`,
      )
      // the list row never prints a header prefix: only the labelled fields do
      expect(block).not.toContain(
        `${root}[data-phone='cards'] [data-slot='table-cell'][data-label]`,
      )
      // the list row: one grid with the answering value at the end, two meta values, the rest hidden
      expect(block).toContain(`${root}[data-phone='cards'] [data-slot='table-row'] {`)
      expect(block).toContain("[data-phone-meta='1']")
      expect(block).toContain("[data-phone-meta='2']")
      expect(block).toContain('[data-phone-value]')
      expect(block).toContain('var(--table-row-inset, calc(var(--spacing) * 4))')
      expect(block).toContain('min-height: calc(var(--spacing) * 14)')
    }
  })

  test('the phone card puts a mono entity name on the title line, never a mono sub line', () => {
    const selectors = withoutComments.match(/[^{}]*:has\([^)]*data-monospace[^)]*\)[^{]*\{/g) ?? []
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) expect(selector).toContain("table-entity-name']")
  })

  // Gated at the landed value: 3,467 bytes before the grid look (owner review 2), 3,979 with it, 4,136
  // with the finer fold steps of expression cycle 12, 4,273 with the 700 px step and the phone card's
  // padding and entity rules of expression cycle 13, 4,409 with the mono entity name on the card's title line
  // of expression cycle 14 (one rule pair in each of the three fold steps).
  // 4,450 until the `phone: 'columns'` tier (four container blocks, ~300 B) landed at 4,714; 4,803 with
  // the delta cell's clipped overflow and the columns tier's `!important` auto layout (expression cycle 16);
  // 4,872 with the mono id kept on one line in the four columns blocks (expression cycle 17); 4,930 with the
  // columns tier's head and state wrapping into the card (expression cycle 18); 5,063 with the tighter head
  // controls and cell gutters in its four blocks (expression cycle 19); 5,177 with the entity name that wraps in a table tier
  // (three container blocks, expression cycle 19), 5,209 with the virtual tables it leaves out; 5,782 with the
  // view's resize handle, row height, pinned edge shadow, row-number pin and footer pick (bench-table-view);
  // 6,234 with the rest state of an edit cell, the filler's lines in the grid and under the footer, and the
  // card's drawn edit control (bench-table-rest); 6,373 with a lamp's word and a stacked meter's parts shown
  // on the phone card, four container blocks (bench-table-reading); 6,807 with the list layout's one-line
  // rows and the gallery card's skipped paint (bench-view-layouts); 6,866 with the unclipped message row of an
  // empty or failed grid (Issue 3088); 6,931 with a grid table's cards at the container's width, one rule in
  // each of the four card tiers (Issue 3091); 6,959 with the three hover rules behind (hover: hover) (Issue 3206); 7,919 with the phone list row beside the fields grid; 8,005 with the inset ring of its Details door and the touch floor of a footer pick.
  test('stays small: under 8,050 bytes gzipped', () => {
    expect(gzipSync(SHEET).length).toBeLessThan(8050)
  })
})
