/**
 * `src/common/**` is the ONE module both halves of the library import, so it has to obey the
 * stricter half's rule: no `@mantine/*`, no `@visx/*`, and no runtime edge back into the
 * Mantine-coupled tree. Without this, `./charts` reaching `cx`/`mergeRefs` would quietly pull
 * Mantine into a subpath the pack-test proves resolves without it.
 *
 * Source-text, not a dist walk: `check-dist-layering.mjs` covers the built graph, and this fails at
 * the moment the import is WRITTEN rather than after a build. `.oxlintrc.json` carries the same ban
 * as a lint rule, exactly as it does for `state`/`query`/`guard`/`agent`/`router-tanstack`.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = import.meta.dir
// `.tsx` too, and not because one exists today: `common/` is where a shared primitive lands, and a
// filter that only saw `.ts` would have let the first JSX file in it import Mantine unpoliced.
const SOURCE_EXT = /\.tsx?$/
const TEST_EXT = /\.test\.tsx?$/
const SOURCES = readdirSync(DIR).filter((f) => SOURCE_EXT.test(f) && !TEST_EXT.test(f))

/** `import … from 'x'`, `export … from 'x'`, `import('x')` — the specifier is group 1 or 2. */
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

function specifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((m) => m[1] ?? '')
}

describe('src/common is Mantine-free', () => {
  test('enumerates every source file (so a new one cannot slip past)', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(5)
  })

  for (const file of SOURCES) {
    const source = readFileSync(join(DIR, file), 'utf8')

    test(`${file} imports no @mantine/* and no @visx/*`, () => {
      const banned = specifiers(source).filter(
        (s) => s.startsWith('@mantine/') || s.startsWith('@visx/'),
      )
      expect(banned).toEqual([])
    })

    test(`${file} has no VALUE import reaching outside common/`, () => {
      // A type-only re-export is erased by esbuild and carries no runtime edge, so `Tier` may point
      // at widget-header. A value import may not: `./utils/is-dev` and siblings are the whole
      // allowance.
      const valueImports = specifiers(
        source.replaceAll(/^\s*(?:import|export)\s+type\s[\s\S]*?['"][^'"]+['"]/gm, ''),
      ).filter((s) => s.startsWith('.'))
      for (const spec of valueImports) {
        expect(spec.startsWith('./')).toBe(true)
      }
    })
  }
})
