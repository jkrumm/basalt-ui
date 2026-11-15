/**
 * The packaging invariant of `./controls`: it resolves for a consumer who has never installed
 * `@mantine/*`. The control tier is Base UI primitives (`ui/*`) and store handles, so no Mantine
 * package is in its graph.
 *
 * Source-level, and deliberately so: `scripts/pack-test.sh` proves the same thing from the PACKED
 * tarball with the peers genuinely absent, which is the stronger claim, but it runs in CI on a built
 * artifact. This file fails in the unit loop, on the line that broke it. Both, not either.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..')

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const LINE_COMMENT = /\/\/.*$/gm
const RELATIVE = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g

/** Every static or dynamic reference to a `@mantine/*` package that survives to runtime. */
function reachesMantine(source: string): boolean {
  const code = source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '')
  const quoted = `['"]@mantine/[^'"]*['"]`
  const staticForm = new RegExp(
    `^(?:import|export)\\s+(?!type\\b)[^\\n]*from\\s+${quoted}|^import\\s+(?!type\\b)${quoted}`,
    'm',
  )
  return staticForm.test(code) || new RegExp(`import\\s*\\(\\s*${quoted}`).test(code)
}

/** The relative import closure of `entry`: the files a consumer of the barrel loads. */
function closure(entry: string): string[] {
  const seen = new Set<string>()
  const stack = [entry]
  const resolveFile = (from: string, spec: string): string | undefined => {
    const base = join(from, '..', spec)
    return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(
      (candidate) => Bun.file(candidate).size > 0,
    )
  }
  while (stack.length > 0) {
    const file = stack.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    const code = readFileSync(file, 'utf8').replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '')
    for (const [, spec] of code.matchAll(RELATIVE)) {
      const target = resolveFile(file, spec as string)
      if (target !== undefined) stack.push(target)
    }
  }
  return [...seen]
}

describe('./controls never reaches @mantine/*', () => {
  const graph = closure(join(SRC, 'controls', 'index.ts'))

  test('the closure includes the filter home and the form field', () => {
    const names = graph.map((file) => file.slice(SRC.length + 1))
    expect(names).toContain('controls/filter-set-spec.tsx')
    expect(names).toContain('controls/form-field.tsx')
  })

  test('nothing in the closure imports a Mantine package, statically or lazily', () => {
    const violations = graph
      .filter((file) => reachesMantine(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length + 1))
    expect(violations).toEqual([])
  })
})
