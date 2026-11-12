/**
 * The shipped seed of a primitive: `src/ui/<name>.tsx` and its `src/ui/<name>.guard.ts`, read from
 * the installed package (the tarball ships `src/`), never from the consumer's copy.
 *
 * - `seedDigest` is the one digest eject records, `sync` compares and `basalt()` gates on
 *   (primitives-distribution section 6): sha256 over the raw seed bytes, then, when a guard ships,
 *   one NUL byte and the raw guard bytes. The guard counts because a composite can start calling an
 *   existing variant without the seed changing.
 * - `ejectedSource` is what a consumer receives (header aside), and what the merge base holds:
 *   the seed with its package-relative imports moved to the published specifiers, since a seed
 *   inside the package cannot import itself by name. The rewrite is a fixed rule, applied the same
 *   way to the base at eject and to the shipped side at `sync`, so it never shows up as a change.
 * - `ejectedGuard` drops the `closed` half (`@ts-expect-error` proofs), which stays in the repo.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SEED_DIR = 'src/ui'

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const GUARD_CLOSED = '// basalt:guard closed'

/**
 * Package-relative imports a seed may use and the published specifier each becomes: `../core/<path>`
 * is `basalt-ui/core/<path>` (the `./core/*` export) and `../tokens` is `basalt-ui/tokens`. Both
 * resolve to the files npm composites import relatively, so there is one module instance.
 */
const CORE_IMPORT = /^\.\.\/core\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/
const TOKENS_IMPORT = '../tokens'

function publishedSpecifier(spec: string): string | undefined {
  const core = CORE_IMPORT.exec(spec)?.[1]
  if (core !== undefined) return `basalt-ui/core/${core}`
  return spec === TOKENS_IMPORT ? 'basalt-ui/tokens' : undefined
}

/** `from '<spec>'`, `import '<spec>'` and `export … from '<spec>'` with a relative specifier. */
const RELATIVE_IMPORT = /(\bfrom\s+|\bimport\s+)(['"])(\.\.?\/[^'"]+)\2/g

export type Seed = { name: string; seed: string; guard: string | null; digest: string }

/** Every primitive the package ships a seed for, sorted. */
export function seedNames(pkgRoot: string): string[] {
  const dir = join(pkgRoot, SEED_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => f.slice(0, -'.tsx'.length))
    .filter((name) => NAME.test(name))
    .toSorted()
}

export function seedDigest(seed: string, guard: string | null): string {
  const hash = createHash('sha256').update(seed)
  if (guard !== null) hash.update('\0').update(guard)
  return hash.digest('hex')
}

/** The shipped seed and guard of `name`, or null when the package ships no such primitive. */
export function readSeed(pkgRoot: string, name: string): Seed | null {
  if (!NAME.test(name)) return null
  const at = (file: string): string | null => {
    const path = join(pkgRoot, SEED_DIR, file)
    return existsSync(path) ? readFileSync(path, 'utf8') : null
  }
  const seed = at(`${name}.tsx`)
  if (seed === null) return null
  const guard = at(`${name}.guard.ts`)
  return { name, seed, guard, digest: seedDigest(seed, guard) }
}

/**
 * Relative specifiers moved to published ones: `./<sibling>` to `basalt-ui/ui/<sibling>`, so an
 * ejected sibling is followed through the alias, and the fixed core table. `self` keeps its
 * relative import (a guard beside its own file). Anything else has no public home: an error names it.
 */
function rewriteImports(text: string, self: string | null): { text: string } | { error: string } {
  const unmapped: string[] = []
  const out = text.replace(RELATIVE_IMPORT, (whole, lead: string, quote: string, spec: string) => {
    const sibling = /^\.\/([a-z0-9-]+)$/.exec(spec)?.[1]
    if (sibling !== undefined && sibling === self) return whole
    const target = sibling === undefined ? publishedSpecifier(spec) : `basalt-ui/ui/${sibling}`
    if (target === undefined) {
      unmapped.push(spec)
      return whole
    }
    return `${lead}${quote}${target}${quote}`
  })
  if (unmapped.length > 0) {
    return {
      error: `imports ${unmapped.map((s) => `'${s}'`).join(', ')}, which no published specifier exports`,
    }
  }
  return { text: out }
}

/** The file a consumer owns after eject, without its header; also the merge base. */
export function ejectedSource(seed: string): { text: string } | { error: string } {
  return rewriteImports(seed, null)
}

/** The guard placed beside an ejected file: the `requires` half only, imports moved like the seed's. */
export function ejectedGuard(guard: string, name: string): { text: string } | { error: string } {
  const lines = guard.split('\n')
  const closed = lines.findIndex((line) => line.trim() === GUARD_CLOSED)
  const kept = closed === -1 ? guard : `${lines.slice(0, closed).join('\n').trimEnd()}\n`
  return rewriteImports(kept, name)
}
