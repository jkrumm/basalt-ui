import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = import.meta.dir
const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))
const ALLOWED = /^(react|@tanstack\/react-router)(\/|$)/

const importsOf = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)

describe('src/router/nav layering', () => {
  test('sees its own source files', () => {
    expect(files).toContain('resolve-active.ts')
  })

  for (const file of files.filter((f) => !f.includes('.test.'))) {
    test(`${file} imports only react, @tanstack/react-router and its own folder`, () => {
      for (const spec of importsOf(readFileSync(join(DIR, file), 'utf8'))) {
        if (spec.startsWith('./')) continue
        if (spec.startsWith('../')) {
          // the one sibling allowed: the ports (types only)
          expect(spec).toBe('../../core/ports')
          continue
        }
        expect(ALLOWED.test(spec)).toBe(true)
      }
    })
  }

  test('nothing under the folder (tests included) reaches ui, base-ui, query, shell, provider or mantine', () => {
    const banned = /(\/ui\b|@base-ui\/react|@tanstack\/react-query|\/shell\b|\/provider\b|@mantine)/
    for (const file of files) {
      if (file === 'layering.test.ts') continue
      for (const spec of importsOf(readFileSync(join(DIR, file), 'utf8'))) {
        expect(`${file}: ${spec}`).not.toMatch(banned)
      }
    }
  })

  test('no JSX in the non-test sources', () => {
    expect(files.filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))).toEqual([])
  })
})

describe('src/router index', () => {
  // The barrel is shared (controls append to it); scripts/export-surface/router.json pins the whole.
  test("the nav half exports exactly ['defineNav', 'navTarget']", async () => {
    const mod = await import('../index')
    expect(Object.keys(mod).filter((k) => /nav/i.test(k))).toEqual(['defineNav', 'navTarget'])
  })
})
