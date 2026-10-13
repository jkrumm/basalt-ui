/**
 * Static server for a built dist (SPA fallback, gzip like production nginx) and the route list of
 * the build being measured. The server lives and dies with the process — nothing is detached.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, normalize, relative, resolve, sep } from 'node:path'

export type DistServer = { origin: string; stop: () => void }

const COMPRESSIBLE = /\.(?:js|mjs|css|html|json|svg|txt|map)$/

export function serveDist(distDir: string): DistServer {
  const root = resolve(distDir)
  const gzCache = new Map<string, Uint8Array<ArrayBuffer>>()

  const resolveFile = (pathname: string): string | null => {
    const file = normalize(join(root, decodeURIComponent(pathname)))
    if (file !== root && !file.startsWith(root + sep)) return null
    if (existsSync(file) && statSync(file).isFile()) return file
    // An extension means an asset request: a miss is a real 404, not the SPA shell.
    if (/\.[a-z0-9]+$/i.test(pathname)) return null
    const index = join(root, 'index.html')
    return existsSync(index) ? index : null
  }

  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      let file: string | null
      try {
        file = resolveFile(new URL(req.url).pathname)
      } catch {
        return new Response('bad request', { status: 400 })
      }
      if (!file) return new Response('not found', { status: 404 })
      const headers: Record<string, string> = { 'cache-control': 'no-store' }
      const blob = Bun.file(file)
      if (!COMPRESSIBLE.test(file) || !req.headers.get('accept-encoding')?.includes('gzip')) {
        return new Response(blob, { headers })
      }
      let gz = gzCache.get(file)
      if (!gz) {
        gz = Bun.gzipSync(await blob.bytes(), { level: 9 }) as Uint8Array<ArrayBuffer>
        gzCache.set(file, gz)
      }
      headers['content-encoding'] = 'gzip'
      headers['content-type'] = blob.type
      return new Response(gz, { headers })
    },
  })
  return { origin: `http://127.0.0.1:${server.port}`, stop: () => void server.stop(true) }
}

/** Playground URL paths from `routes/` file names: `x/index.tsx` → `/x`, layouts dedupe into it. */
export function routesFromDir(routesDir: string): string[] {
  const found = new Set<string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name)) {
        const rel = relative(routesDir, full)
          .split(sep)
          .join('/')
          .replace(/\.tsx?$/, '')
        if (rel.startsWith('__')) continue
        const path = '/' + rel.replace(/(^|\/)index$/, '')
        found.add(path === '/' ? '/' : path.replace(/\/$/, ''))
      }
    }
  }
  walk(routesDir)
  return [...found].toSorted()
}

/** One path per line; blank lines and `#` comments ignored. */
export function parseRoutes(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

const PLAYGROUND_ROUTES = resolve(import.meta.dirname, '../../apps/playground/src/routes')

/** `EVIDENCE_ROUTES` (set by index.ts from `--routes`) wins over the playground's route files. */
export async function loadRoutes(): Promise<string[]> {
  const file = process.env['EVIDENCE_ROUTES']
  return file ? parseRoutes(await Bun.file(file).text()) : routesFromDir(PLAYGROUND_ROUTES)
}
