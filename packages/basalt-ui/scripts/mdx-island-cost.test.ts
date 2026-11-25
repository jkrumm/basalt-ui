/**
 * The cost column of the "Interactive parts in MDX" table in docs/astro.md is the Astro matrix's
 * further-island budget for the part the tag renders, in kB of 1024 bytes, one decimal: a ceiling, so a
 * build that measures inside it moves neither file, and a raised budget fails here until the doc says so. The budget table beside it is the budget file of
 * apps/marketing, formatted: a raised budget fails here until the doc says so.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const ROOT = join(import.meta.dir, '..', '..', '..')
const doc = readFileSync(join(ROOT, 'packages/basalt-ui/docs/astro.md'), 'utf8')
const matrix = JSON.parse(
  readFileSync(join(ROOT, 'docs/v3/verdicts/astro-matrix.json'), 'utf8'),
) as {
  parts: { id: string; budget: { further: number } }[]
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
    test(`${tag}: the cost is the matrix's further-island budget of ${part}`, () => {
      const found = matrix.parts.find((p) => p.id === part.replaceAll('`', ''))
      expect(found).toBeDefined()
      const kb = ((found?.budget.further ?? 0) / 1024).toFixed(1)
      expect(cost).toBe(`${kb} kB`)
    })
  }
})

const budgets = JSON.parse(
  readFileSync(join(ROOT, 'apps/marketing/site-budgets.json'), 'utf8'),
) as Record<string, number>

/** The doc's key for each budget row, by the words the row starts with. */
const BUDGET_ROWS: readonly (readonly [string, string])[] = [
  ['module JavaScript on a page with no island', 'staticModuleJsGzip'],
  ['inline JavaScript on any page', 'inlineJsGzip'],
  ['the React runtime the first island brings', 'reactRuntimeGzip'],
  ["a further island's cost", 'furtherIslandGzip'],
  ['the two MDX islands together', 'mdxIslandsGzip'],
  ['CSS per page', 'cssGzipPerPage'],
  ['LCP', 'lcpMs'],
  ['CLS', 'cls'],
  ['layout shift of every guide', 'guideCls'],
]

/** Budgets are bytes, written as bytes: the doc's cost column is kB of 1024, so one unit never means two bases. */
const show = (key: string, value: number): string => {
  if (key === 'lcpMs') return `${value.toLocaleString('en-US')} ms`
  if (key === 'cls' || key === 'guideCls') return String(value)
  return `${value.toLocaleString('en-US')} B`
}

const budgetTable =
  doc.split('<!-- site-budgets:begin -->')[1]?.split('<!-- site-budgets:end -->')[0] ?? ''
const budgetRows = budgetTable
  .split('\n')
  .filter((line) => line.startsWith('|') && !line.startsWith('|-'))
  .slice(1)
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim()),
  )

describe('docs/astro.md budget table', () => {
  for (const [start, key] of BUDGET_ROWS) {
    test(`${start}: the budget is ${key} in site-budgets.json`, () => {
      const row = budgetRows.find(([name]) => name?.startsWith(start))
      expect(row).toBeDefined()
      expect(row?.[1]).toBe(show(key, budgets[key] ?? Number.NaN))
    })
  }
})
