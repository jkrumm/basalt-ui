import { describe, expect, test } from 'bun:test'
import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite'
import type { BasaltAppOptions } from './vite'
import { basaltAppPlugin } from './vite'

/** Fixed, palette-independent theme colors so these tests never couple to `tokens/palette.ts`. */
const THEME_COLOR = { light: '#ffffff', dark: '#111111' } as const

function getPlugin(options: BasaltAppOptions): Plugin {
  // No `serviceWorker` option -> basaltAppPlugin returns a single, non-promise Plugin.
  return basaltAppPlugin(options)[0] as Plugin
}

/** Invokes the plugin's `configResolved` hook with a minimal fake `ResolvedConfig`. */
function resolveConfig(plugin: Plugin, base: string): void {
  const configResolved = plugin.configResolved as unknown as (config: ResolvedConfig) => void
  configResolved({ base } as unknown as ResolvedConfig)
}

/** Invokes the plugin's `transformIndexHtml` hook and returns the emitted tags. */
function transformHtml(plugin: Plugin, html: string): HtmlTagDescriptor[] {
  const transformIndexHtml = plugin.transformIndexHtml as unknown as (html: string) => {
    html: string
    tags: HtmlTagDescriptor[]
  }
  return transformIndexHtml(html).tags
}

type FakeReq = { url: string }
type FakeRes = { setHeader: (name: string, value: string) => void; end: (body: string) => void }
type Middleware = (req: FakeReq, res: FakeRes, next: () => void) => void

/** Runs `configResolved` then `configureServer`, returning the registered dev middleware. */
function getDevMiddleware(plugin: Plugin, base: string): Middleware {
  resolveConfig(plugin, base)
  let captured: Middleware | undefined
  const fakeServer = { middlewares: { use: (fn: Middleware) => (captured = fn) } }
  const configureServer = plugin.configureServer as unknown as (server: unknown) => void
  configureServer(fakeServer)
  if (!captured) throw new Error('basalt:app did not register a dev middleware')
  return captured
}

/** Runs the middleware against a fake request, returning the served body (or `undefined`). */
function runMiddleware(middleware: Middleware, url: string): string | undefined {
  let body: string | undefined
  const res: FakeRes = {
    setHeader: () => {},
    end: (data: string) => {
      body = data
    },
  }
  middleware({ url }, res, () => {})
  return body
}

const HTML_NO_VIEWPORT = '<html><head></head><body></body></html>'

describe('basaltAppPlugin — base handling', () => {
  test('default base "/" regression: exact head tag output', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    resolveConfig(plugin, '/')
    const tags = transformHtml(plugin, HTML_NO_VIEWPORT)

    expect(tags).toEqual([
      {
        tag: 'meta',
        attrs: {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
        },
      },
      {
        tag: 'meta',
        attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' },
      },
      {
        tag: 'meta',
        attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#111111' },
      },
      { tag: 'style', children: 'html{background-color:#111111;color-scheme:dark}' },
      { tag: 'link', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
      { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
      { tag: 'link', attrs: { rel: 'icon', sizes: '96x96', href: '/favicon-96x96.png' } },
      {
        tag: 'link',
        attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Test App' } },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
      { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
      {
        tag: 'meta',
        attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      },
      { tag: 'meta', attrs: { name: 'darkreader-lock' } },
      { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
    ])
  })

  test('default base "/" regression: manifest start_url/scope/icon src', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    const middleware = getDevMiddleware(plugin, '/')
    const body = runMiddleware(middleware, '/site.webmanifest')
    const manifest = JSON.parse(body ?? '{}')

    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.id).toBe('/')
    expect(manifest.icons[0].src).toBe('/web-app-manifest-192x192.png')
    expect(manifest.icons[1].src).toBe('/web-app-manifest-512x512.png')
  })

  test('non-root base "/myapp/" prefixes icon hrefs and the manifest link', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    resolveConfig(plugin, '/myapp/')
    const tags = transformHtml(plugin, HTML_NO_VIEWPORT)

    const hrefOf = (rel: string): unknown => {
      const found = tags.find((tag) => tag.tag === 'link' && tag.attrs?.['rel'] === rel)
      return found?.attrs?.['href']
    }

    expect(hrefOf('shortcut icon')).toBe('/myapp/favicon.ico')
    expect(hrefOf('icon')).toBe('/myapp/favicon.svg')
    expect(hrefOf('apple-touch-icon')).toBe('/myapp/apple-touch-icon.png')
    expect(hrefOf('manifest')).toBe('/myapp/site.webmanifest')
  })

  test('non-root base "/myapp/" prefixes manifest start_url/scope/icon src by default', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    const middleware = getDevMiddleware(plugin, '/myapp/')

    // Dev middleware runs before Vite's own base-stripping middleware (see the comment in
    // vite.ts), so the request URL still carries the base prefix — this is the realistic path.
    const bodyPrefixed = runMiddleware(middleware, '/myapp/site.webmanifest')
    expect(bodyPrefixed).toBeDefined()
    const manifest = JSON.parse(bodyPrefixed ?? '{}')
    expect(manifest.start_url).toBe('/myapp/')
    expect(manifest.scope).toBe('/myapp/')
    expect(manifest.id).toBe('/myapp/')
    expect(manifest.icons[0].src).toBe('/myapp/web-app-manifest-192x192.png')
    expect(manifest.icons[1].src).toBe('/myapp/web-app-manifest-512x512.png')

    // Bare (already-stripped) path is accepted too, defensively.
    const bodyBare = runMiddleware(middleware, '/site.webmanifest')
    expect(bodyBare).toBe(bodyPrefixed)
  })

  test('an explicit startUrl/scope is NOT re-prefixed with base', () => {
    const plugin = getPlugin({
      name: 'Test App',
      themeColor: THEME_COLOR,
      startUrl: '/custom/',
      scope: '/custom/',
    })
    const middleware = getDevMiddleware(plugin, '/myapp/')
    const body = runMiddleware(middleware, '/myapp/site.webmanifest')
    const manifest = JSON.parse(body ?? '{}')

    expect(manifest.start_url).toBe('/custom/')
    expect(manifest.scope).toBe('/custom/')
    // id defaults from the (explicit, non-reprefixed) startUrl.
    expect(manifest.id).toBe('/custom/')
  })

  test('manifest: false keeps skipping the manifest link, generation, and dev serving', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR, manifest: false })
    resolveConfig(plugin, '/myapp/')

    const tags = transformHtml(plugin, HTML_NO_VIEWPORT)
    expect(tags.some((tag) => tag.tag === 'link' && tag.attrs?.['rel'] === 'manifest')).toBe(false)

    // manifestEnabled === false -> configureServer must return before registering any middleware.
    let middlewareRegistered = false
    const fakeServer = { middlewares: { use: () => (middlewareRegistered = true) } }
    const configureServer = plugin.configureServer as unknown as (server: unknown) => void
    configureServer(fakeServer)
    expect(middlewareRegistered).toBe(false)
  })

  test('icons: false keeps skipping icon head links entirely', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR, icons: false })
    resolveConfig(plugin, '/myapp/')
    const tags = transformHtml(plugin, HTML_NO_VIEWPORT)

    const iconRels = new Set(['shortcut icon', 'icon', 'apple-touch-icon'])
    expect(tags.some((tag) => tag.tag === 'link' && iconRels.has(String(tag.attrs?.['rel'])))).toBe(
      false,
    )
  })
})
