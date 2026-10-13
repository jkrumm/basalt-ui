/**
 * Bundle lane — gzip bytes (level 9) per published subpath and per playground route chunk. Reads
 * files only; needs no browser.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { Lane, LaneResult } from './types'

const PACKAGE_DIR = resolve(import.meta.dirname, '../../packages/basalt-ui')

export const gzipBytes = (data: Uint8Array<ArrayBuffer>): number =>
  Bun.gzipSync(data, { level: 9 }).length

// ── Published subpaths ────────────────────────────────────────────────────────────────────────

/** Static relative specifiers only — dynamic `import()` is not part of a subpath's load cost. */
const STATIC_SPECIFIER = /(?:\bfrom\s*|\bimport\s*)['"](\.{1,2}\/[^'"]+)['"]/g

function resolveModule(from: string, specifier: string): string | null {
  const target = resolve(dirname(from), specifier)
  for (const candidate of [target, `${target}.js`, join(target, 'index.js')]) {
    if (/\.[cm]?js$/.test(candidate) && existsSync(candidate)) return candidate
  }
  return null
}

/** Entry file plus its transitive static relative imports; bare (external) imports are not counted. */
export function moduleClosure(entry: string): string[] {
  const seen = new Set<string>([entry])
  const queue = [entry]
  for (let file = queue.pop(); file; file = queue.pop()) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(STATIC_SPECIFIER)) {
      const dep = resolveModule(file, match[1] ?? '')
      if (dep && !seen.has(dep)) {
        seen.add(dep)
        queue.push(dep)
      }
    }
  }
  return [...seen].toSorted()
}

type ExportTarget = string | { import?: string; default?: string }

export function subpathEntries(exportsMap: Record<string, ExportTarget>): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (subpath.includes('*')) continue
    const file = typeof target === 'string' ? target : (target.import ?? target.default)
    if (file && /\.(?:[cm]?js|css)$/.test(file)) entries.push([subpath, file])
  }
  return entries.toSorted(([a], [b]) => a.localeCompare(b))
}

type SubpathRow = { subpath: string; entryGz: number; closureGz: number; files: number }

function measureSubpaths(): SubpathRow[] | null {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
    exports: Record<string, ExportTarget>
  }
  const rows: SubpathRow[] = []
  for (const [subpath, file] of subpathEntries(pkg.exports)) {
    const entry = join(PACKAGE_DIR, file)
    if (!existsSync(entry)) return null
    const entryGz = gzipBytes(readFileSync(entry))
    const files = file.endsWith('.css') ? [entry] : moduleClosure(entry)
    const closureGz = files.reduce((sum, f) => sum + gzipBytes(readFileSync(f)), 0)
    rows.push({ subpath, entryGz, closureGz, files: files.length })
  }
  return rows
}

// ── App chunks ────────────────────────────────────────────────────────────────────────────────

export type ManifestChunk = {
  file: string
  isEntry?: boolean
  src?: string
  imports?: string[]
  css?: string[]
}
export type Manifest = Record<string, ManifestChunk>
type RouteRow = { route: string; ownGz: number; incrementalGz: number }

/** `src/routes/dashboard/revenue.tsx?tsr-split=component` → `dashboard/revenue`. */
export const routeOfKey = (key: string): string | null =>
  /(?:^|\/)routes\/(.+?)\.tsx?(?:\?|$)/.exec(key)?.[1] ?? null

/** Gzip cost of the initial load, and of each route chunk alone and beyond the initial load. */
export function routeChunks(
  manifest: Manifest,
  gz: (file: string) => number,
): { initialGz: number; routes: RouteRow[] } {
  const closure = (roots: string[]): Set<string> => {
    const files = new Set<string>()
    const seen = new Set<string>()
    const queue = [...roots]
    for (let key = queue.pop(); key !== undefined; key = queue.pop()) {
      const chunk = manifest[key]
      if (!chunk || seen.has(key)) continue
      seen.add(key)
      files.add(chunk.file)
      for (const css of chunk.css ?? []) files.add(css)
      queue.push(...(chunk.imports ?? []))
    }
    return files
  }
  const sum = (files: Iterable<string>): number => [...files].reduce((n, f) => n + gz(f), 0)

  const entries = Object.keys(manifest).filter((key) => manifest[key]?.isEntry)
  const initial = closure(entries)
  const routes: RouteRow[] = []
  for (const [key, chunk] of Object.entries(manifest)) {
    const route = routeOfKey(key)
    if (!route) continue
    const all = closure([key])
    const incremental = [...all].filter((f) => !initial.has(f))
    routes.push({
      route,
      ownGz: sum([chunk.file, ...(chunk.css ?? [])]),
      incrementalGz: sum(incremental),
    })
  }
  routes.toSorted((a, b) => a.route.localeCompare(b.route))
  return { initialGz: sum(initial), routes }
}

function listAssets(distDir: string): string[] {
  const dir = join(distDir, 'assets')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(distDir, join(e.parentPath, e.name)))
    .toSorted()
}

function readManifest(distDir: string): Manifest | null {
  for (const rel of ['.vite/manifest.json', 'manifest.json']) {
    const file = join(distDir, rel)
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as Manifest
  }
  return null
}

// ── Lane ──────────────────────────────────────────────────────────────────────────────────────

export const bundle: Lane = async ({ distDir }) => {
  const summary: LaneResult['summary'] = []
  const gzOf = (rel: string): number => gzipBytes(readFileSync(join(distDir, rel)))

  const subpaths = measureSubpaths()
  if (subpaths) {
    for (const row of subpaths) {
      summary.push({ metric: `pkg ${row.subpath}`, value: row.closureGz, unit: 'B gzip' })
    }
  } else {
    summary.push({ metric: 'pkg subpaths', value: 'skipped: packages/basalt-ui/dist not built' })
  }

  const assets = listAssets(distDir)
  const total = (ext: RegExp): number =>
    assets.filter((f) => ext.test(f)).reduce((n, f) => n + gzOf(f), 0)
  summary.push(
    { metric: 'app total js', value: total(/\.js$/), unit: 'B gzip' },
    { metric: 'app total css', value: total(/\.css$/), unit: 'B gzip' },
  )

  const manifest = readManifest(distDir)
  let routes: RouteRow[] = []
  if (manifest) {
    const measured = routeChunks(manifest, gzOf)
    routes = measured.routes
    summary.push({ metric: 'app initial load', value: measured.initialGz, unit: 'B gzip' })
    for (const row of routes) {
      summary.push({ metric: `route ${row.route} chunk`, value: row.ownGz, unit: 'B gzip' })
      summary.push({
        metric: `route ${row.route} beyond initial`,
        value: row.incrementalGz,
        unit: 'B gzip',
      })
    }
  } else {
    summary.push({ metric: 'route chunks', value: 'skipped: no vite manifest in dist' })
  }

  return {
    lane: 'bundle',
    summary,
    detail: {
      level: 9,
      subpaths,
      routes,
      assets: assets.map((file) => ({ file, gzip: gzOf(file) })),
    },
  }
}
