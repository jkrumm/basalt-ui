/**
 * W1 chart spike: gzip bytes of `ZonedLine` today (visx) vs on @tanstack/charts@1.1.0. Same
 * harness as check-budgets' provider-only row (Vite/Rolldown, production, minify, gzip of the entry
 * plus its static imports, CSS excluded). Two numbers per kind:
 *   own    — basalt's code only; every bare specifier (visx, tanstack, d3, react) external
 *   total  — the chart engine bundled too; only react/react-dom external (what a consumer ships)
 */
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { build } from 'vite'

const ROOT = join(import.meta.dir, '..')
const isOwn = (id: string) => /^(?:\.{1,2}\/|\/)/.test(id) || id.startsWith('\u0000')
const isReact = (id: string) => /^react(?:-dom)?(?:\/|$)/.test(id)

async function gzip(fixture: string, mode: 'own' | 'total'): Promise<number> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: ROOT,
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: true,
      lib: { entry: join(ROOT, 'scripts/fixtures', fixture), formats: ['es'] },
      rolldownOptions: { external: (id) => (mode === 'own' ? !isOwn(id) : isReact(id)) },
    },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) throw new Error('no output')
  const chunks = new Map(
    bundle.output.flatMap((o) => (o.type === 'chunk' ? [[o.fileName, o] as const] : [])),
  )
  const entry = [...chunks.values()].find((c) => c.isEntry)
  if (!entry) throw new Error('no entry')
  const seen = new Set<string>()
  let bytes = 0
  const visit = (name: string): void => {
    const chunk = chunks.get(name)
    if (!chunk || seen.has(name)) return
    seen.add(name)
    bytes += gzipSync(chunk.code).length
    chunk.imports.forEach(visit)
  }
  visit(entry.fileName)
  return bytes
}

for (const [label, fixture] of [
  ['ZonedLine 1.x (visx)', 'spike-zonedline-v1.ts'],
  ['ZonedLine 2.0 spike (@tanstack/charts)', 'spike-zonedline-v2.ts'],
] as const) {
  console.log(
    `${label}: own ${await gzip(fixture, 'own')} B, total ${await gzip(fixture, 'total')} B`,
  )
}
