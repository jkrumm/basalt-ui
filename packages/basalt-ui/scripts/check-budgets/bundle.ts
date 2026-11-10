/**
 * The production-bundle fixtures behind the provider area's rows.
 *
 * Gzip bytes of basalt's OWN code in an app that imports only `BasaltProvider` + `createBasaltTheme`
 * — the floor every consumer pays on first paint. weatherorb's `/map` bar broke when 1.30.2 → 1.32.1
 * grew it ~1 KB unnoticed (the theme lab's store rode into production behind an unfoldable
 * `isDev()` gate); this is the number that would have said so.
 *
 * Bundled by the SAME bundler consumers run (Vite, i.e. Rolldown), in production mode, against the
 * BUILT `dist` — esbuild without code splitting inlines `dev-dock`'s lazy `import('./theme-lab')` and
 * wraps shared modules in lazy-init closures that defeat tree-shaking, so it over-reports. Peers are
 * external (not basalt's bytes); CSS is excluded; the count is the entry chunk plus every chunk it
 * statically imports — what loads before first paint, not what loads later.
 */
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

import { PKG_ROOT } from './lib'

/**
 * Whether a module id belongs to basalt's own graph rather than a peer: relative or absolute paths
 * (POSIX, or a Windows drive letter / UNC path once `\` is normalized to `/`) and Vite's `\u0000`
 * virtual ids. Everything else is a bare specifier, i.e. a peer, and stays external.
 */
export function isOwnGraphId(id: string): boolean {
  const normalized = id.replaceAll('\\', '/')
  return /^(?:\.{1,2}\/|\/|[A-Za-z]:\/)/.test(normalized) || id.startsWith('\u0000')
}

/**
 * Dev-only surface, matched on `/`-normalized path segments: the dock and the theme lab (a file or
 * directory, optionally hashed — `dev-dock-AbC123.js`) and any `*-devtools` package. A bare
 * `devtools-utils.js` or `xdevtools-helper.js` is not dev-only. Narrower than the oxlint plugin's
 * specifier regex on purpose: that one reads import specifiers, this one also reads emitted names.
 */
const DEV_ONLY =
  /(?:^|\/)(?:(?:dev-dock|theme-lab)(?:-[\w-]+)?(?:\.[cm]?[jt]sx?|\/)|[^/]*-devtools(?:\/|$))/

export type BundleChunk = {
  fileName: string
  code: string
  isEntry: boolean
  moduleIds: readonly string[]
  imports: readonly string[]
  dynamicImports: readonly string[]
}

/**
 * Every emitted chunk, loaded or not, whose name, modules or imports reach dev-only code. A
 * production build must emit none: a module-scope `lazy(() => import('../dev-dock'))` keeps the
 * chunk graph alive even when its JSX use is dev-gated, and the PWA service worker then precaches
 * it (obsidian: 34 KB, never requested). Exported for the unit test.
 */
export function devOnlyChunks(
  chunks: readonly Pick<BundleChunk, 'fileName' | 'moduleIds' | 'imports' | 'dynamicImports'>[],
): string[] {
  return chunks
    .filter((c) =>
      [c.fileName, ...c.moduleIds, ...c.imports, ...c.dynamicImports].some((id) =>
        DEV_ONLY.test(id.replaceAll('\\', '/')),
      ),
    )
    .map((c) => c.fileName)
}

/**
 * Feature runtimes a define-free provider must not ship — Spotlight, modals and hotkeys enter the
 * graph only through `defineNav` / `defineCommands` / `defineOverlays`. Matched on a module id's
 * `node_modules/<pkg>/` segment (any package-manager layout), so a chunk is flagged by what it
 * contains, not by its name. Exported for the unit test.
 */
const FEATURE_RUNTIME =
  /(?:^|\/)node_modules\/(?:@mantine\/(?:spotlight|modals)|@tanstack\/(?:react-)?hotkeys)\//

export function featureRuntimeChunks(
  chunks: readonly Pick<BundleChunk, 'fileName' | 'moduleIds'>[],
): string[] {
  return chunks
    .filter((c) => c.moduleIds.some((id) => FEATURE_RUNTIME.test(id.replaceAll('\\', '/'))))
    .map((c) => c.fileName)
}

/** Gzip bytes of every emitted chunk, dynamic ones included — a bundle-graph bar follows `import()`. */
export function allChunksGzip(chunks: ReadonlyMap<string, BundleChunk>): number {
  let bytes = 0
  for (const chunk of chunks.values()) bytes += gzipSync(chunk.code).length
  return bytes
}

/** Gzip bytes of the entry chunk plus every chunk it statically imports (the first-paint set). */
export function firstPaintGzip(
  chunks: ReadonlyMap<string, BundleChunk>,
  entry: BundleChunk,
): number {
  const loaded = new Set<string>()
  let bytes = 0
  const visit = (name: string): void => {
    const chunk = chunks.get(name)
    if (chunk === undefined || loaded.has(name)) return
    loaded.add(name)
    bytes += gzipSync(chunk.code).length
    chunk.imports.forEach(visit)
  }
  visit(entry.fileName)
  return bytes
}

/**
 * Peer-bundled builds (the embedded fixture) keep only the React runtime external, so the peers'
 * own bytes and chunks are counted the way a consumer's bundle-graph bar counts them.
 */
const REACT_RUNTIME = /^react(?:-dom)?(?:\/|$)/

type BundleOpts = { fixture: string; bundlePeers: boolean }

/** The production bundle of a fixture: every emitted chunk and its entry. */
export async function buildProviderOnlyBundle(
  distEntry: string,
  { fixture, bundlePeers }: BundleOpts = { fixture: 'provider-only.ts', bundlePeers: false },
): Promise<{ chunks: Map<string, BundleChunk>; entry: BundleChunk }> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PKG_ROOT,
    define: { 'process.env.NODE_ENV': '"production"' },
    resolve: {
      alias: [
        { find: /^basalt-ui$/, replacement: distEntry },
        {
          find: /^basalt-ui\/commands$/,
          replacement: join(dirname(distEntry), 'commands/index.js'),
        },
      ],
    },
    build: {
      write: false,
      minify: true,
      lib: { entry: join(PKG_ROOT, 'scripts/fixtures', fixture), formats: ['es'] },
      rolldownOptions: {
        external: (id) =>
          bundlePeers ? REACT_RUNTIME.test(id) : id !== 'basalt-ui' && !isOwnGraphId(id),
      },
    },
  })
  // `build()` also types a watcher return (`build.watch`), which has no `output`; narrow it away.
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) {
    throw new Error('check-budgets: provider-only fixture build returned no output')
  }
  const chunks = new Map(
    bundle.output.flatMap((o) => (o.type === 'chunk' ? [[o.fileName, o] as const] : [])),
  )
  const entry = [...chunks.values()].find((c) => c.isEntry)
  if (entry === undefined) throw new Error('check-budgets: provider-only fixture emitted no entry')
  return { chunks, entry }
}
