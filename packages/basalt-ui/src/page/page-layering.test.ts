import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The v3 page half (Prose, Callout, Toc, ArticleLayout and their helpers) imports nothing from the
 * 2.x `content` module, nothing from Mantine and none of the markdown pipeline packages.
 */
const DIR = import.meta.dir
const SOURCES = [
  'prose.tsx',
  'callout.tsx',
  'toc.tsx',
  'toc-click-pin.ts',
  'toc-spy.ts',
  'article-layout.tsx',
  'article-progress.tsx',
  'core/article-date.ts',
]

const importsOf = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)

const BANNED =
  /(^|\/)content(\/|$)|^@mantine(\/|$)|^(react-markdown|remark-gfm|rehype-sanitize|remend)(\/|$)/

describe('src/page layering', () => {
  for (const file of SOURCES) {
    test(`${file} imports nothing from content, Mantine or the markdown pipeline`, () => {
      const specs = importsOf(readFileSync(join(DIR, file), 'utf8'))
      for (const spec of specs) expect(`${file}: ${spec}`).not.toMatch(BANNED)
    })
  }
})
