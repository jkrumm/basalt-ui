import { existsSync, statSync } from 'node:fs'
import { join, normalize, resolve, sep } from 'node:path'

import { ShotError } from './playwright'

const FETCH_MODES = new Set(['cors', 'same-origin', 'navigate'])

/**
 * With a proxy live only the shot's own page may reach this port: its Host, no foreign Origin, no
 * cross-site request, and no cross-origin no-Origin request (a `no-cors` image or form from another
 * local page). A same-origin `no-cors` load (the app's own stylesheet) is fine.
 */
function fromOwnBrowser(req: Request, own: string): boolean {
  const origin = req.headers.get('origin')
  const mode = req.headers.get('sec-fetch-mode')
  const site = req.headers.get('sec-fetch-site')
  if (req.headers.get('host') !== own) return false
  if (origin !== null) return origin === `http://${own}`
  if (site === 'cross-site') return false
  return mode === null || FETCH_MODES.has(mode) || site === 'same-origin'
}

/** Static server for a built SPA dir: real files as-is, extensionless misses fall back to index.html; `proxy` answers first. */
export function serveDist(
  distDir: string,
  proxy?: (req: Request) => Promise<Response | null>,
): { origin: string; stop: () => void } {
  const root = resolve(distDir)
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new ShotError(`--dist ${distDir} is not a directory`)
  }
  const fileFor = (pathname: string): string | null => {
    const file = normalize(join(root, decodeURIComponent(pathname)))
    if (file !== root && !file.startsWith(root + sep)) return null
    if (existsSync(file) && statSync(file).isFile()) return file
    if (/\.[a-z0-9]+$/i.test(pathname)) return null
    const index = join(root, 'index.html')
    return existsSync(index) ? index : null
  }
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      try {
        // With a proxy live, only the shot's own browser may talk to this port (no DNS rebinding, no other page).
        const own = `127.0.0.1:${server.port}`
        if (proxy && !fromOwnBrowser(req, own)) return new Response('forbidden', { status: 403 })
        const proxied = await proxy?.(req)
        if (proxied) return proxied
        const file = fileFor(new URL(req.url).pathname)
        return file
          ? new Response(Bun.file(file), { headers: { 'cache-control': 'no-store' } })
          : new Response('not found', { status: 404 })
      } catch {
        return new Response('bad request', { status: 400 })
      }
    },
  })
  return { origin: `http://127.0.0.1:${server.port}`, stop: () => void server.stop(true) }
}
