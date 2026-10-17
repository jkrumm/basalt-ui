import { existsSync, statSync } from 'node:fs'
import { join, normalize, resolve, sep } from 'node:path'

import { ShotError } from './playwright'

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
        const from = req.headers.get('origin')
        if (
          proxy &&
          (req.headers.get('host') !== own || (from !== null && from !== `http://${own}`))
        )
          return new Response('forbidden', { status: 403 })
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
