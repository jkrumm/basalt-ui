/**
 * A static import graph of the repo's UI sources: which files a page's entry module reaches, through every static and
 * dynamic `import`, `export ... from` and CSS `@import`, the way a bundler walks them. `scripts/matrix-select.ts` reads it
 * to name the quality-matrix routes and the Astro-matrix parts a change reaches.
 *
 * Scripts are scanned with Bun's own transpiler (`Bun.Transpiler.scanImports`, which drops type-only imports, so a
 * `import type` edge never makes a page reach a module it does not run). A `basalt-ui/<subpath>` import resolves through
 * the package's `exports` map to the built file and from there to its source: the build is unbundled and mirrors
 * `src/` under `dist/` (tsup.config.ts), so `dist/ui/button.js` is `src/ui/button.tsx`. Any other bare import is a
 * dependency and ends the walk. A relative import or a `basalt-ui` subpath that resolves to no file is kept in
 * `unresolved`: a test holds it empty on the real tree, so a resolver gap cannot make a page look as if it reached
 * nothing.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const PACKAGE_NAME = 'basalt-ui'
const PACKAGE_DIR = 'packages/basalt-ui'

const SCRIPT = /\.(?:[cm]?[jt]sx?)$/
const PROBE = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.css', '.mdx', '.json', '.astro']
/** `@import 'x';` and `@import url('x');` in a stylesheet. */
const CSS_IMPORT = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g
/** `import ... from 'x'` and `import 'x'` in a file the transpiler does not read (MDX, an Astro frontmatter). */
const LOOSE_IMPORT = /^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm

export interface ImportGraph {
  /** every file `entries` reach, repo-relative, the entries included; `stop` files are reached but not walked */
  reach(entries: readonly string[], stop?: ReadonlySet<string>): Set<string>
  /** the repo-relative file `specifier` names from `importer`, `null` for a dependency or a local name with no file */
  resolve(importer: string, specifier: string): string | null
  /** `importer -> specifier` for every local import that resolved to no file, over every file walked so far */
  unresolved(): string[]
}

type Exports = { key: string; target: string }[]

function readExports(root: string): Exports {
  const manifest = JSON.parse(readFileSync(join(root, PACKAGE_DIR, 'package.json'), 'utf8')) as {
    exports: Record<string, string | Record<string, string> | null>
  }
  return Object.entries(manifest.exports).flatMap(([key, value]) => {
    // A null key hides a module the wildcard beside it would publish (`./ui/*.guard`).
    if (value === null) return []
    const target = typeof value === 'string' ? value : (value['import'] ?? value['default'])
    return target === undefined ? [] : [{ key, target }]
  })
}

/** `basalt-ui/ui/button` -> `./dist/ui/button.js` through the exports map, `*` patterns included. */
function exportTarget(exports: Exports, specifier: string): string | null {
  const sub = specifier === PACKAGE_NAME ? '.' : '.' + specifier.slice(PACKAGE_NAME.length)
  for (const { key, target } of exports) {
    if (key === sub) return target
    const star = key.indexOf('*')
    if (star === -1) continue
    const head = key.slice(0, star)
    const tail = key.slice(star + 1)
    if (sub.startsWith(head) && sub.endsWith(tail) && sub.length >= head.length + tail.length)
      return target.replace('*', sub.slice(head.length, sub.length - tail.length))
  }
  return null
}

export function createImportGraph(root: string): ImportGraph {
  const exports = readExports(root)
  const edges = new Map<string, string[]>()
  const missing = new Set<string>()
  const transpilers = new Map<string, Bun.Transpiler>()

  const isFile = (abs: string): boolean => existsSync(abs) && statSync(abs).isFile()

  /** An absolute path with or without its extension (`./x`, `./x.js` for `x.ts`, `./dir` for `dir/index.ts`). */
  function probe(abs: string): string | null {
    if (isFile(abs)) return abs
    const bare = abs.replace(/\.(?:js|jsx|mjs)$/, '')
    for (const ext of PROBE) if (isFile(bare + ext)) return bare + ext
    for (const ext of PROBE) if (isFile(join(abs, 'index' + ext))) return join(abs, 'index' + ext)
    return null
  }

  /** The repo-relative file a specifier names, `null` for a dependency, `undefined` for a local name with no file. */
  function resolveSpecifier(importer: string, raw: string): string | null | undefined {
    const specifier = raw.replace(/\?[\w-]+$/, '')
    let abs: string | null = null
    if (specifier.startsWith('.')) {
      // a relative import into the built package (`../packages/basalt-ui/dist/charts/parts/cartesian`) is its source
      const target = resolve(root, dirname(importer), specifier)
      const dist = join(root, PACKAGE_DIR, 'dist') + '/'
      abs = probe(
        target.startsWith(dist)
          ? join(root, PACKAGE_DIR, 'src', target.slice(dist.length))
          : target,
      )
    } else if (specifier === PACKAGE_NAME || specifier.startsWith(PACKAGE_NAME + '/')) {
      const target = exportTarget(exports, specifier)
      if (target === null) return undefined
      // configs/* are toolchain presets, never a page's module
      if (!target.startsWith('./dist/')) return null
      abs = probe(join(root, PACKAGE_DIR, 'src', target.slice('./dist/'.length)))
    } else return null
    return abs === null ? undefined : relative(root, abs)
  }

  function specifiersOf(file: string): string[] {
    const text = readFileSync(join(root, file), 'utf8')
    if (file.endsWith('.css')) return [...text.matchAll(CSS_IMPORT)].map((m) => m[1] as string)
    if (!SCRIPT.test(file)) return [...text.matchAll(LOOSE_IMPORT)].map((m) => m[1] as string)
    const loader = file.endsWith('x') ? 'tsx' : /\.[cm]?ts$/.test(file) ? 'ts' : 'js'
    let transpiler = transpilers.get(loader)
    if (transpiler === undefined) {
      transpiler = new Bun.Transpiler({ loader: loader as 'ts' | 'tsx' | 'js' })
      transpilers.set(loader, transpiler)
    }
    return transpiler.scanImports(text).map((i) => i.path)
  }

  function edgesOf(file: string): string[] {
    const known = edges.get(file)
    if (known !== undefined) return known
    const out: string[] = []
    for (const specifier of specifiersOf(file)) {
      const target = resolveSpecifier(file, specifier)
      if (target === undefined) missing.add(`${file} -> ${specifier}`)
      else if (target !== null) out.push(target)
    }
    edges.set(file, out)
    return out
  }

  return {
    reach(entries, stop = new Set()) {
      const seen = new Set<string>()
      const queue = [...entries]
      while (queue.length > 0) {
        const file = queue.pop() as string
        if (seen.has(file)) continue
        seen.add(file)
        if (stop.has(file)) continue
        for (const next of edgesOf(file)) if (!seen.has(next)) queue.push(next)
      }
      return seen
    },
    resolve: (importer, specifier) => resolveSpecifier(importer, specifier) ?? null,
    unresolved: () => [...missing].toSorted(),
  }
}
