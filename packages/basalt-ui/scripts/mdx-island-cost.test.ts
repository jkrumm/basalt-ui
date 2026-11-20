/**
 * The cost column of the "Interactive parts in MDX" table in docs/astro.md is the Astro matrix's number
 * for the part the tag renders, in kB of 1024 bytes, one decimal. The two move together: a re-recorded
 * matrix fails here until the doc is updated.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const ROOT = join(import.meta.dir, '..', '..', '..')
const doc = readFileSync(join(ROOT, 'packages/basalt-ui/docs/astro.md'), 'utf8')
const matrix = JSON.parse(
  readFileSync(join(ROOT, 'docs/v3/verdicts/astro-matrix.json'), 'utf8'),
) as {
  parts: { id: string; modes: { visible: { further: number } } }[]
}

const table =
  doc.split('<!-- mdx-island-cost:begin -->')[1]?.split('<!-- mdx-island-cost:end -->')[0] ?? ''
const rows = table
  .split('\n')
  .filter((line) => line.startsWith('|') && !line.startsWith('|-'))
  .slice(1)
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim()),
  )

describe('docs/astro.md island cost table', () => {
  test('has a row for every tag', () => {
    expect(rows.length).toBe(5)
  })
  for (const row of rows) {
    const [tag, , , , part, cost] = row
    if (part === undefined || part === 'none') continue
    test(`${tag}: the cost is the matrix's further cost of ${part}`, () => {
      const found = matrix.parts.find((p) => p.id === part.replaceAll('`', ''))
      expect(found).toBeDefined()
      const kb = ((found?.modes.visible.further ?? 0) / 1024).toFixed(1)
      expect(cost).toBe(`${kb} kB`)
    })
  }
})
