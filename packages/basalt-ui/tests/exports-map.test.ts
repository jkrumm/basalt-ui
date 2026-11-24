/**
 * The exports map is an explicit list. `./core/*` publishes exactly the modules an ejected primitive
 * imports (the specifiers `ejectedSource` and `ejectedGuard` write), so every other core module stays
 * internal and can change without breaking an ejected file. `./ui/*` resolves a primitive and never a
 * guard, a test helper or the generated slot table.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

import { ejectedGuard, ejectedSource, readSeed, seedNames } from '../src/cli/merge/seed'

const PKG_ROOT = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>
}
const keys = Object.keys(manifest.exports)

/** Every `basalt-ui/core/<path>` an ejected seed or its guard imports. */
function ejectedCoreImports(): string[] {
  const out = new Set<string>()
  for (const name of seedNames(PKG_ROOT)) {
    const seed = readSeed(PKG_ROOT, name)
    if (seed === null) continue
    const texts = [ejectedSource(seed.seed)]
    if (seed.guard !== null) texts.push(ejectedGuard(seed.guard, name))
    for (const result of texts) {
      if ('error' in result) throw new Error(`${name}: ${result.error}`)
      for (const m of result.text.matchAll(/['"]basalt-ui\/core\/([\w/-]+)['"]/g))
        out.add(`./core/${m[1]}`)
    }
  }
  return [...out].toSorted()
}

describe('exports map', () => {
  test('./core/* lists exactly the modules an ejected primitive imports', () => {
    const published = keys.filter((k) => k.startsWith('./core/')).toSorted()
    expect(published).not.toContain('./core/*')
    expect(published).toEqual(ejectedCoreImports())
  })

  test('every published core path points at its own built module', () => {
    for (const key of keys.filter((k) => k.startsWith('./core/'))) {
      const stem = key.slice('./core/'.length)
      expect(manifest.exports[key]).toEqual({
        types: `./dist/core/${stem}.d.ts`,
        import: `./dist/core/${stem}.js`,
        default: `./dist/core/${stem}.js`,
      })
    }
  })

  test('./ui/* hides guards, test helpers and the slot table', () => {
    for (const key of [
      './ui/*.guard',
      './ui/guard-completeness',
      './ui/primitive.contract',
      './ui/slots',
    ]) {
      expect(manifest.exports[key]).toBeNull()
    }
  })

  test('no wildcard other than ./ui/* and ./configs/* is published', () => {
    expect(keys.filter((k) => k.includes('*') && manifest.exports[k] !== null)).toEqual([
      './ui/*',
      './configs/*',
    ])
  })
})
