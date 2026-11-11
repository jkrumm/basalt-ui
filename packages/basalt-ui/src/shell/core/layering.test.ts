/**
 * `src/shell/core` is headless: no JSX, no class strings, no runtime import outside its folder, and
 * no reach into `src/ui`, `src/page` or `src/router`. The router feeds it through `NavRuntime`.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = import.meta.dir
const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))
const sources = files.filter((f) => !f.includes('.test.'))

const importsOf = (source: string): { spec: string; typeOnly: boolean }[] =>
  [...source.matchAll(/^\s*(import|export)(\s+type)?\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map(
    (m) => ({
      spec: m[3]!,
      typeOnly: m[2] !== undefined,
    }),
  )

/** The only imports allowed outside the folder, all type-only. */
const TYPE_ONLY_SIBLINGS = new Set(['../contract', '../../core/ports'])

describe('src/shell/core layering', () => {
  test('sees its own sources', () => {
    expect(sources).toContain('projector.ts')
    expect(sources).toContain('nav-runtime.ts')
  })

  for (const file of sources) {
    test(`${file}: own folder at runtime, the shell contract and ports as types only`, () => {
      for (const { spec, typeOnly } of importsOf(readFileSync(join(DIR, file), 'utf8'))) {
        if (spec.startsWith('./')) continue
        expect({ file, spec, allowed: TYPE_ONLY_SIBLINGS.has(spec) && typeOnly }).toEqual({
          file,
          spec,
          allowed: true,
        })
      }
    })
  }

  test('nothing under the folder, tests included, imports ui, page, router, base-ui or mantine', () => {
    const banned = /(\/ui\b|\/page\b|\/router\b|@base-ui\/react|@mantine|@tanstack\/react-router)/
    for (const file of files) {
      if (file === 'layering.test.ts') continue
      for (const { spec } of importsOf(readFileSync(join(DIR, file), 'utf8'))) {
        expect(`${file}: ${spec}`).not.toMatch(banned)
      }
    }
  })

  test('no JSX file and no class strings in the sources', () => {
    expect(files.filter((f) => f.endsWith('.tsx'))).toEqual([])
    for (const file of sources) {
      const text = readFileSync(join(DIR, file), 'utf8')
      expect({ file, className: /className|\bclass\s*=/.test(text) }).toEqual({
        file,
        className: false,
      })
    }
  })

  test('nothing is exported from basalt-ui/shell: no barrel imports the core', () => {
    const shell = join(DIR, '..')
    const barrels = readdirSync(shell).filter((f) => /^index\.tsx?$/.test(f))
    for (const barrel of barrels) {
      // `./core` only: `../core/ports` is the package core, which a barrel may import.
      expect(readFileSync(join(shell, barrel), 'utf8')).not.toMatch(/from\s+['"]\.\/core(\/|['"])/)
    }
  })
})
