/**
 * The G1 layers' byte measurement (docs/v3/concepts/quality-contract.md section 6): a Vite 8
 * production build of a virtual entry that re-exports source modules, peers bundled, `gzipSync`
 * over every emitted chunk, minus `base0` (React `createRoot`, same child) built in the same run so
 * a React bump cannot move a ceiling. Shared by the ui, cards, charts, data, router and table areas.
 *
 * Entries are source strings, not files: `export * as <name> from '<src path>'` keeps every export
 * of the module, which is what a consumer who imports the whole module pays.
 */
import { join } from 'node:path'
import { build } from 'vite'
import type { Plugin } from 'vite'

import { BASE0, bundleApp, gzipBytes } from './provider-v3'
import type { AppBundle } from './provider-v3'
import { PKG_ROOT } from './lib'

export const SRC = join(PKG_ROOT, 'src')

/** Section 6: measured +5%, rounded up to 0.5 KB. 1 KB is 1000 B, as the provider ceiling reads it. */
export function seedCeiling(measuredBytes: number): number {
  return Math.ceil((measuredBytes * 1.05) / 500) * 500
}

/** An absolute path no file sits at: lib mode resolves its entry as a path before any plugin runs. */
const VIRTUAL = join(PKG_ROOT, '.g1-entry.tsx')

/** What `base0` is, so the subtraction leaves only the modules: React `createRoot` and one child. */
const APP_SHELL = `import { createRoot } from 'react-dom/client'
const root = document.getElementById('root')
if (root !== null) createRoot(root).render(<div />)
`

/** `export * as <name> from '<src/path>'` per module: the whole module, counted. */
export function reExportAll(modules: Record<string, string>): string {
  return Object.entries(modules)
    .map(([name, path]) => `export * as ${name} from '${join(SRC, path)}'`)
    .join('\n')
}

/** `export { a, b } from '<src/path>'`: the named symbols only, as a consumer's tree-shaken import. */
export function reExportNamed(path: string, names: readonly string[]): string {
  return `export { ${names.join(', ')} } from '${join(SRC, path)}'`
}

/** One production build of a source string. Peers bundled; the real closure is what gets counted. */
export async function bundleSource(source: string): Promise<AppBundle> {
  const graph = new Set<string>()
  const entry: Plugin = {
    name: 'g1-virtual-entry',
    resolveId: (id) => (id === VIRTUAL ? VIRTUAL : null),
    load: (id) => (id === VIRTUAL ? `${APP_SHELL}${source}` : null),
    transform(_code, id) {
      graph.add(id.split('?')[0] ?? id)
    },
  }
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PKG_ROOT,
    plugins: [entry],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry: VIRTUAL, formats: ['es'] } },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) {
    throw new Error('g1 budgets: the fixture build returned no output')
  }
  const chunks = bundle.output.flatMap((o) => (o.type === 'chunk' ? [o] : []))
  if (chunks.length === 0) throw new Error('g1 budgets: the fixture build emitted no chunk')
  return { chunks, graph: [...graph] }
}

let base0Bytes: Promise<number> | undefined

/** `base0` once per process: every row of every G1 area subtracts the same number. */
export function base0Gzip(): Promise<number> {
  base0Bytes ??= bundleApp(BASE0).then(gzipBytes)
  return base0Bytes
}

/** Gzip bytes of a source string's production bundle, minus `base0`. */
export async function measureSource(source: string): Promise<number> {
  const [app, base0] = [await bundleSource(source), await base0Gzip()]
  return gzipBytes(app) - base0
}
