/**
 * The ejected primitives of one Vite app (primitives-distribution section 6, Roots): `basalt()`
 * walks up from the Vite root to `.basalt/manifest.json` and takes the rows whose root lies inside
 * that app, so two apps in one repo alias only their own files.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

import { readRow } from '../cli/eject/ledger'
import type { EjectedRow } from '../cli/eject/ledger'
import { MANIFEST_PATH, parseManifest } from '../cli/manifest'
import { readSeed } from '../cli/merge/seed'

export type Ejected = { name: string; file: string; row: EjectedRow }

export type AppEjects = {
  /** The directory holding `.basalt/manifest.json`; null when the app has none. */
  installRoot: string | null
  ejected: Ejected[]
}

/** The nearest directory at or above `from` with a manifest. */
function manifestDir(from: string): string | null {
  let dir = resolve(from)
  for (;;) {
    if (existsSync(join(dir, MANIFEST_PATH))) return dir
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel))
}

/** The app's ejected rows, sorted by name; throws on a manifest or row it cannot read. */
export function appEjects(viteRoot: string): AppEjects {
  const installRoot = manifestDir(viteRoot)
  if (installRoot === null) return { installRoot: null, ejected: [] }
  const parsed = parseManifest(readFileSync(join(installRoot, MANIFEST_PATH), 'utf8'))
  if ('error' in parsed) throw new Error(parsed.error)
  const ejected: Ejected[] = []
  for (const [key, value] of Object.entries(parsed.manifest.ejected)) {
    const hash = key.lastIndexOf('#')
    const root = hash === -1 ? '' : key.slice(0, hash)
    if (hash === -1 || !inside(viteRoot, resolve(installRoot, root))) continue
    const row = readRow(value)
    if (row === null) {
      throw new Error(`${MANIFEST_PATH}: ejected["${key}"] is malformed; run \`basalt-ui doctor\``)
    }
    ejected.push({ name: key.slice(hash + 1), file: resolve(installRoot, row.path), row })
  }
  return { installRoot, ejected: ejected.toSorted((a, b) => a.name.localeCompare(b.name)) }
}

/**
 * Rows whose recorded `seedDigest` no longer matches the installed seed plus guard. `origin:
 * 'local'` records none and is skipped; a seed the package stopped shipping counts as changed.
 */
export function staleEjects(ejected: readonly Ejected[], pkgRoot: string): Ejected[] {
  return ejected.filter(({ name, row }) => {
    if (row.seedDigest === null) return false
    return readSeed(pkgRoot, name)?.digest !== row.seedDigest
  })
}
