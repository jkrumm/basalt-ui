import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve, sep } from 'node:path'

import { ShotError } from './playwright'

const FETCH_MODES = new Set(['cors', 'same-origin', 'navigate'])

/** The types a built SPA serves; Chromium refuses a module script with any other type than JavaScript. */
const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}

type Header = (name: string) => string | null

/**
 * With a proxy live only the shot's own page may reach this port: its Host, no foreign Origin, no
 * cross-site request, and no cross-origin no-Origin request (a `no-cors` image or form from another
 * local page). A same-origin `no-cors` load (the app's own stylesheet) is fine.
 */
function fromOwnBrowser(header: Header, own: string): boolean {
  const origin = header('origin')
  const mode = header('sec-fetch-mode')
  const site = header('sec-fetch-site')
  if (header('host') !== own) return false
  if (origin !== null) return origin === `http://${own}`
  if (site === 'cross-site') return false
  return mode === null || FETCH_MODES.has(mode) || site === 'same-origin'
}

const headerOf =
  (req: IncomingMessage): Header =>
  (name) => {
    const value = req.headers[name]
    return value === undefined ? null : Array.isArray(value) ? value.join(', ') : value
  }

/** The incoming request as a fetch `Request`, the shape the proxy reads. */
async function toRequest(req: IncomingMessage, own: string): Promise<Request> {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one)
  }
  const method = req.method ?? 'GET'
  const chunks: Buffer[] = []
  if (method !== 'GET' && method !== 'HEAD') for await (const chunk of req) chunks.push(chunk)
  return new Request(`http://${own}${req.url ?? '/'}`, {
    method,
    headers,
    ...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}),
  })
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {}
  for (const [name, value] of response.headers) headers[name] = value
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) headers['set-cookie'] = cookies
  res.writeHead(response.status, headers)
  res.end(Buffer.from(await response.arrayBuffer()))
}

/** A running server: its origin and the stop that closes every open connection. */
export type Served = { origin: string; stop: () => void }

/**
 * Static server for a built SPA dir on `node:http`: real files as-is, extensionless misses fall back
 * to index.html; `proxy` answers first. A missing dir throws before anything listens.
 */
export function serveDist(
  distDir: string,
  proxy?: (req: Request) => Promise<Response | null>,
): Promise<Served> {
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
  let own = ''
  const answer = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // With a proxy live, only the shot's own browser may talk to this port (no DNS rebinding, no other page).
      if (proxy && !fromOwnBrowser(headerOf(req), own)) {
        return void res.writeHead(403).end('forbidden')
      }
      const proxied = proxy ? await proxy(await toRequest(req, own)) : null
      if (proxied) return await send(res, proxied)
      const file = fileFor(new URL(req.url ?? '/', `http://${own}`).pathname)
      if (file === null) return void res.writeHead(404).end('not found')
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      })
      createReadStream(file).pipe(res)
    } catch {
      if (!res.headersSent) res.writeHead(400)
      res.end('bad request')
    }
  }
  const server = createServer((req, res) => void answer(req, res))
  return new Promise((done, failed) => {
    server.once('error', failed)
    server.listen(0, '127.0.0.1', () => {
      own = `127.0.0.1:${(server.address() as AddressInfo).port}`
      done({
        origin: `http://${own}`,
        stop: () => {
          server.closeAllConnections()
          server.close()
        },
      })
    })
  })
}
