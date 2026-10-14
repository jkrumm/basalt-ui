/** `Bun.serve` on an ephemeral port: the built SSR handler at `/`, the hydration bundle beside it. */
import { join } from 'node:path'
import { CLIENT_CSS, CLIENT_JS, SERVER_JS, buildFixture } from './build'

export type FixtureServer = { origin: string; stop: () => void }

export async function startFixtureServer(outdir: string): Promise<FixtureServer> {
  await buildFixture(outdir)
  const { render } = (await import(join(outdir, SERVER_JS))) as {
    render: (request: Request) => Promise<Response>
  }
  const assets: Record<string, string> = {
    [`/${CLIENT_JS}`]: join(outdir, CLIENT_JS),
    [`/${CLIENT_CSS}`]: join(outdir, CLIENT_CSS),
  }
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request) {
      const { pathname } = new URL(request.url)
      const asset = assets[pathname]
      if (asset) return new Response(Bun.file(asset))
      if (pathname === '/favicon.ico') return new Response(null, { status: 204 })
      if (pathname !== '/') return new Response('not found', { status: 404 })
      return render(request)
    },
  })
  return { origin: `http://127.0.0.1:${server.port}`, stop: () => void server.stop(true) }
}
