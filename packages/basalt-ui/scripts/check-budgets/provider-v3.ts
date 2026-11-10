/**
 * The v3 provider budget's measurement (docs/v3/concepts/quality-contract.md section 6): Vite 8
 * production build of `fixtures/provider-v3.tsx` with its peers bundled, `gzipSync` over every
 * emitted chunk, minus `base0` (React + react-dom `createRoot`, same child) built in the same run,
 * so a React bump cannot move the number. Shared by the `provider-v3` row, `provider.budget`,
 * `provider.closure` and the spike harness, so all four read one build.
 *
 * The fixture imports `src/core/provider` directly: the root `.` still serves the 2.x provider.
 */
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import type { Plugin } from 'vite'

import { PKG_ROOT } from './lib'

export const FIXTURE = join(PKG_ROOT, 'scripts/fixtures/provider-v3.tsx')
export const BASE0 = join(PKG_ROOT, 'scripts/fixtures/provider-v3-base0.tsx')

/** The cap (A§0, A§1): never edited here. A measurement above it is a Contract amendment request. */
export const PROVIDER_V3_CAP = 5000

/** Section 6: measured +5%, rounded up to 0.5 KB, never above the cap. 1 KB is 1000 B (the cap is 5,000 B). */
export function ceilingFor(measuredBytes: number): number {
  return Math.min(PROVIDER_V3_CAP, Math.ceil((measuredBytes * 1.05) / 500) * 500)
}

export type AppBundle = {
  /** Every emitted chunk, entry or not. */
  readonly chunks: readonly { fileName: string; code: string; moduleIds: readonly string[] }[]
  /** Every module the build loaded, tree-shaken ones included: the real closure. */
  readonly graph: readonly string[]
}

/** One production build of an entry. Peers bundled; only the closure is recorded, not the source. */
export async function bundleApp(entry: string): Promise<AppBundle> {
  const graph = new Set<string>()
  const record: Plugin = {
    name: 'provider-v3-closure',
    transform(_code, id) {
      graph.add(id.split('?')[0] ?? id)
    },
  }
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PKG_ROOT,
    plugins: [record],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ['es'] },
    },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) {
    throw new Error('provider-v3: the fixture build returned no output')
  }
  const chunks = bundle.output.flatMap((o) => (o.type === 'chunk' ? [o] : []))
  if (chunks.length === 0) throw new Error('provider-v3: the fixture build emitted no chunk')
  return { chunks, graph: [...graph] }
}

/**
 * Rolldown keeps `//#region <path>` comments through minification, and the path is relative to the
 * caller's cwd: the same build gzipped 16 B apart from two directories. They ship nowhere a consumer's
 * minifier keeps them, so they are not counted.
 */
const REGION_COMMENT = /^[ \t]*\/\/#(?:end)?region.*\n?/gm

export function gzipBytes(app: AppBundle): number {
  return app.chunks.reduce(
    (sum, chunk) => sum + gzipSync(chunk.code.replace(REGION_COMMENT, '')).length,
    0,
  )
}

/** What the provider chunk must not contain: by module id (closure) or by emitted code. */
const BANNED: readonly { name: string; id?: RegExp; code?: RegExp }[] = [
  { name: 'persisted', id: /(?:^|\/)persisted(?:[./-]|$)/ },
  { name: 'base-ui-toast', id: /@base-ui\/react\/(?:esm\/)?toast(?:[./]|$)/ },
  {
    name: 'cn-table',
    id: /(?:^|\/)core\/cn(?:[./]|$)|node_modules\/(?:tailwind-merge|class-variance-authority)\//,
  },
  { name: 'message-table', id: /(?:^|\/)core\/messages(?:[./]|$)|(?:^|\/)catalog(?:[./-]|$)/ },
  { name: 'en-catalog', id: /(?:^|\/)messages\/en(?:[./]|$)/ },
  {
    name: 'intl-cache',
    id: /(?:^|\/)core\/format(?:[./]|$)/,
    code: /\bIntl\.(?:NumberFormat|DateTimeFormat|PluralRules|RelativeTimeFormat|ListFormat|Collator)\b/,
  },
]

const norm = (id: string): string => id.replaceAll('\\', '/')

/**
 * Banned content in the provider app, as `<name>: <module id | code>` lines; empty means clean. A
 * code pattern counts only when `base0` lacks it, so React's own text is never blamed on the provider.
 */
export function bannedIn(app: AppBundle, base0: AppBundle): string[] {
  const hits: string[] = []
  const base0Code = base0.chunks.map((c) => c.code).join('\n')
  const code = app.chunks.map((c) => c.code).join('\n')
  for (const { name, id, code: pattern } of BANNED) {
    if (id !== undefined) {
      for (const moduleId of app.graph) {
        if (id.test(norm(moduleId))) hits.push(`${name}: ${norm(moduleId)}`)
      }
    }
    if (pattern !== undefined && pattern.test(code) && !pattern.test(base0Code)) {
      hits.push(`${name}: code matches ${pattern.source}`)
    }
  }
  return hits
}

export type ProviderV3Measure = {
  /** Fixture gzip minus base0 gzip: the provider's share of first paint. */
  providerGzipBytes: number
  fixtureGzipBytes: number
  base0GzipBytes: number
  chunkCount: number
  bannedInChunk: string[]
  /** The two builds, for a caller that serves or inspects the code (the spike harness). */
  app: AppBundle
  base0: AppBundle
}

/** Build the fixture and `base0` once and measure. `entry` is overridable for the closure control. */
export async function measureProviderV3(entry: string = FIXTURE): Promise<ProviderV3Measure> {
  const [app, base0] = [await bundleApp(entry), await bundleApp(BASE0)]
  const fixtureGzipBytes = gzipBytes(app)
  const base0GzipBytes = gzipBytes(base0)
  return {
    providerGzipBytes: fixtureGzipBytes - base0GzipBytes,
    fixtureGzipBytes,
    base0GzipBytes,
    chunkCount: app.chunks.length,
    bannedInChunk: bannedIn(app, base0),
    app,
    base0,
  }
}
