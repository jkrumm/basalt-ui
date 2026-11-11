/**
 * What an app reaches through `basalt-ui`: its own imports (a scan of the Vite root, every run) and
 * the import graph of the INSTALLED package (which primitive imports which sibling, which composite
 * imports which primitive), read from the package files each run so it cannot go stale. The peer
 * and subpath allotment is the generated `ALLOTMENT`; this module adds only what the files say.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALLOTMENT } from './allotment.gen'

/** `basalt-ui`, `basalt-ui/cards`, `basalt-ui/ui/button`, quoted after `from`, `import` or `import(`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(basalt-ui(?:\/[\w./*-]+)?)\1/g
/** A relative or published sibling import inside a primitive. */
const SIBLING =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(?:\.\/|basalt-ui\/ui\/)([a-z0-9-]+)(?:\.js)?\1/g
const PRIMITIVE_SPEC = /(['"])basalt-ui\/ui\/([a-z0-9-]+)\1/g

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.basalt',
  'dist',
  'dist-ssr',
  'build',
  'coverage',
])

/**
 * The installed `basalt-ui` an app builds against: the nearest `node_modules/basalt-ui` at or above
 * `from`, real path; this package itself when none is found (a workspace building from source).
 */
export function installedPackage(from: string): string {
  let dir = resolve(from)
  for (;;) {
    const candidate = join(dir, 'node_modules', 'basalt-ui')
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..')
}

/** Whether `peer` is installed where `from` resolves bare specifiers (a `node_modules` walk). */
export function hasPackage(from: string, peer: string): boolean {
  let dir = resolve(from)
  for (;;) {
    if (existsSync(join(dir, 'node_modules', peer, 'package.json'))) return true
    const up = dirname(dir)
    if (up === dir) return false
    dir = up
  }
}

function walk(dir: string, out: string[], skip: ReadonlySet<string>): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries.toSorted()) {
    if (skip.has(name)) continue
    const abs = join(dir, name)
    const stat = statSync(abs, { throwIfNoEntry: false })
    if (stat === undefined) continue
    if (stat.isDirectory()) walk(abs, out, skip)
    else if (SOURCE_FILE.test(name) && !/\.(?:test|d)\.[cm]?[jt]sx?$/.test(name)) out.push(abs)
  }
  return out
}

/** A `basalt-ui[/x[/y]]` specifier as a gate key: `.`, `ui/<name>`, `<subpath>`; null if untracked. */
export function subpathOf(specifier: string): string | null {
  if (specifier === 'basalt-ui') return '.'
  const rest = specifier.slice('basalt-ui/'.length)
  const ui = /^ui\/([a-z0-9-]+)$/.exec(rest)
  if (ui) return `ui/${ui[1]}`
  return ALLOTMENT.subpaths[rest] === undefined || rest === 'ui' ? null : rest
}

/** Every gated `basalt-ui` subpath the app's own source imports, sorted. */
export function scanImports(root: string): string[] {
  const found = new Set<string>()
  for (const file of walk(root, [], SKIP_DIRS)) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('basalt-ui')) continue
    for (const [, , specifier] of text.matchAll(SPECIFIER)) {
      const key = subpathOf(specifier ?? '')
      if (key !== null) found.add(key)
    }
  }
  return [...found].toSorted()
}

/** Where the installed package keeps compiled output for `dir`: `dist/<dir>`, else `src/<dir>`. */
export function packageDir(pkgRoot: string, dir: string): string {
  const dist = join(pkgRoot, 'dist', dir)
  return existsSync(dist) ? dist : join(pkgRoot, 'src', dir)
}

/** The primitives the installed package ships (`src/ui/<name>.tsx`, the eject seeds), sorted. */
export function shippedPrimitives(pkgRoot: string): string[] {
  const allotted = new Set(ALLOTMENT.primitives)
  for (const dir of [join(pkgRoot, 'src/ui'), join(pkgRoot, 'dist/ui')]) {
    if (!existsSync(dir)) continue
    return readdirSync(dir)
      .map((f) => /^([a-z0-9-]+)\.(?:tsx|js)$/.exec(f)?.[1])
      .filter((n): n is string => n !== undefined && allotted.has(n))
      .toSorted()
  }
  return []
}

export type PackageGraph = {
  /** Primitive -> the sibling primitives its file imports. */
  siblings: Map<string, string[]>
  /** Composite subpath -> the primitives its files import by specifier. */
  composites: Map<string, string[]>
}

function primitiveFile(pkgRoot: string, name: string): string | null {
  for (const file of [
    join(pkgRoot, 'src/ui', `${name}.tsx`),
    join(pkgRoot, 'dist/ui', `${name}.js`),
  ]) {
    if (existsSync(file)) return file
  }
  return null
}

/** The installed package's import graph between primitives and from composites to primitives. */
export function packageGraph(pkgRoot: string): PackageGraph {
  const siblings = new Map<string, string[]>()
  for (const name of shippedPrimitives(pkgRoot)) {
    const file = primitiveFile(pkgRoot, name)
    const text = file === null ? '' : readFileSync(file, 'utf8')
    const found = new Set<string>()
    for (const [, , sibling] of text.matchAll(SIBLING)) {
      if (sibling !== undefined && sibling !== name && !sibling.endsWith('guard'))
        found.add(sibling)
    }
    siblings.set(name, [...found].toSorted())
  }
  const composites = new Map<string, string[]>()
  for (const dir of ALLOTMENT.composites) {
    const found = new Set<string>()
    for (const file of walk(join(pkgRoot, 'src', dir), [], SKIP_DIRS)) {
      for (const [, , name] of readFileSync(file, 'utf8').matchAll(PRIMITIVE_SPEC)) {
        if (name !== undefined) found.add(name)
      }
    }
    composites.set(dir, [...found].toSorted())
  }
  return { siblings, composites }
}

export type Closure = {
  /** Runtime subpaths reached (`.`, `cards`, …), `ui` when any primitive is. */
  subpaths: string[]
  /** Primitives reached. */
  primitives: string[]
}

/** Everything the imported subpaths reach: declared edges, composite -> primitive, sibling imports. */
export function closureOf(imports: readonly string[], graph: PackageGraph): Closure {
  const subpaths = new Set<string>()
  const primitives = new Set<string>()
  const queue = [...imports]
  for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
    if (key.startsWith('ui/')) {
      const name = key.slice(3)
      if (primitives.has(name)) continue
      primitives.add(name)
      queue.push('ui', ...(graph.siblings.get(name) ?? []).map((s) => `ui/${s}`))
      continue
    }
    if (subpaths.has(key)) continue
    subpaths.add(key)
    queue.push(...(ALLOTMENT.subpaths[key]?.reaches ?? []))
    queue.push(...(graph.composites.get(key) ?? []).map((p) => `ui/${p}`))
  }
  return { subpaths: [...subpaths].toSorted(), primitives: [...primitives].toSorted() }
}

/** Peers the closure needs, each with the first imported specifier that needs it. */
export function requiredPeers(closure: Closure): Map<string, string> {
  const needs = new Map<string, string>()
  const add = (peers: readonly string[] | undefined, via: string): void => {
    for (const peer of peers ?? []) if (!needs.has(peer)) needs.set(peer, via)
  }
  for (const name of closure.primitives) add(ALLOTMENT.primitivePeers[name], `basalt-ui/ui/${name}`)
  const firstPrimitive = closure.primitives[0] ?? ''
  for (const key of closure.subpaths) {
    const via =
      key === '.'
        ? 'basalt-ui'
        : key === 'ui'
          ? `basalt-ui/ui/${firstPrimitive}`
          : `basalt-ui/${key}`
    add(ALLOTMENT.subpaths[key]?.peers, via)
  }
  return needs
}

/** `a/b` with forward slashes, relative to `from`, always starting with `.`. */
export function relativePosix(from: string, to: string): string {
  const rel = relative(from, to).split(sep).join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}
