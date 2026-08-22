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

type HtmlTransformResult = { html: string; tags: HtmlTagDescriptor[] }

/** Invokes the plugin's `transformIndexHtml` hook (object form, `order: 'pre'`). */
function transform(plugin: Plugin, html: string): HtmlTransformResult {
  const hook = plugin.transformIndexHtml as unknown as {
    order: 'pre'
    handler: (html: string) => HtmlTransformResult
  }
  return hook.handler(html)
}

/** Invokes the plugin's `transformIndexHtml` hook and returns the emitted tags. */
function transformHtml(plugin: Plugin, html: string): HtmlTagDescriptor[] {
  return transform(plugin, html).tags
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
      { tag: 'meta', attrs: { charset: 'UTF-8' } },
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
      {
        tag: 'style',
        children:
          'html:not([data-mantine-color-scheme]){background-color:#111111;color-scheme:dark}',
      },
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

  // The head half of `icons: false` shipped; the manifest half did not. `{ manifest: true, icons:
  // false }` emitted a site.webmanifest naming two PNGs the app never ships — an installable app
  // with two 404s, which is why rb went hybrid rather than use the plugin's manifest at all.
  test('icons: false reaches the MANIFEST, not just the head links', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR, icons: false })
    const middleware = getDevMiddleware(plugin, '/myapp/')
    const manifest = JSON.parse(runMiddleware(middleware, '/myapp/site.webmanifest') ?? '{}')

    expect(manifest.icons).toBeUndefined()
    expect(JSON.stringify(manifest)).not.toContain('.png')
    // …and the rest of the manifest is unaffected.
    expect(manifest.start_url).toBe('/myapp/')
    expect(manifest.name).toBe('Test App')
  })

  test('the default (icons on) still carries both manifest icon entries', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    const middleware = getDevMiddleware(plugin, '/')
    const manifest = JSON.parse(runMiddleware(middleware, '/site.webmanifest') ?? '{}')
    expect(manifest.icons).toHaveLength(2)
  })

  test('icons.dir still redirects the manifest icon srcs', () => {
    const plugin = getPlugin({
      name: 'Test App',
      themeColor: THEME_COLOR,
      icons: { dir: '/brand' },
    })
    const middleware = getDevMiddleware(plugin, '/')
    const manifest = JSON.parse(runMiddleware(middleware, '/site.webmanifest') ?? '{}')
    expect(manifest.icons[0].src).toBe('/brand/web-app-manifest-192x192.png')
  })
})

describe('basaltAppPlugin — the anti-FOUC boot rule (V1)', () => {
  const bootStyleOf = (options: Partial<BasaltAppOptions>): string => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR, ...options })
    resolveConfig(plugin, '/')
    const style = transformHtml(plugin, HTML_NO_VIEWPORT).find((tag) => tag.tag === 'style')
    return String(style?.children ?? '')
  }

  test('every mode scopes the rule so Mantine can take it back', () => {
    // The whole defect: an UNLAYERED `html{color-scheme:dark}` outranks Mantine's own layered
    // `:root{color-scheme:var(--mantine-color-scheme)}`, so light mode kept dark native controls
    // forever. Scoping to the absence of the attribute Mantine writes is what expires it.
    for (const colorScheme of ['dark', 'light', 'auto', false] as const) {
      const css = bootStyleOf({ colorScheme })
      expect(css).toContain('html:not([data-mantine-color-scheme])')
      expect(css).not.toMatch(/(^|[};])html\{/)
    }
  })

  test('default is dark — byte-identical to 1.20.0 apart from the scope', () => {
    expect(bootStyleOf({})).toBe(
      'html:not([data-mantine-color-scheme]){background-color:#111111;color-scheme:dark}',
    )
  })

  test('light paints the light surface and declares color-scheme: light', () => {
    expect(bootStyleOf({ colorScheme: 'light' })).toBe(
      'html:not([data-mantine-color-scheme]){background-color:#ffffff;color-scheme:light}',
    )
  })

  test('auto declares `light dark` and follows prefers-color-scheme for the paint', () => {
    expect(bootStyleOf({ colorScheme: 'auto' })).toBe(
      'html:not([data-mantine-color-scheme]){background-color:#ffffff;color-scheme:light dark}' +
        '@media(prefers-color-scheme:dark){html:not([data-mantine-color-scheme])' +
        '{background-color:#111111}}',
    )
  })

  test('an explicit backgroundColor wins over the auto media pair', () => {
    expect(bootStyleOf({ colorScheme: 'auto', backgroundColor: '#abcdef' })).toBe(
      'html:not([data-mantine-color-scheme]){background-color:#abcdef;color-scheme:light dark}',
    )
  })

  test('colorScheme: false is the full opt-out — paint, no color-scheme at all', () => {
    expect(bootStyleOf({ colorScheme: false })).toBe(
      'html:not([data-mantine-color-scheme]){background-color:#111111}',
    )
  })

  test('the manifest theme_color follows the boot scheme', () => {
    const read = (options: Partial<BasaltAppOptions>): Record<string, unknown> => {
      const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR, ...options })
      const body = runMiddleware(getDevMiddleware(plugin, '/'), '/site.webmanifest')
      return JSON.parse(body ?? '{}') as Record<string, unknown>
    }
    expect(read({})['theme_color']).toBe('#111111')
    expect(read({ colorScheme: 'auto' })['theme_color']).toBe('#111111')
    expect(read({ colorScheme: 'light' })['theme_color']).toBe('#ffffff')
    expect(read({ colorScheme: 'light' })['background_color']).toBe('#ffffff')
  })
})

describe('basaltAppPlugin — the encoding declaration (V2)', () => {
  const SHELL =
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n' +
    '    <title>App</title>\n  </head>\n  <body></body>\n</html>'

  test("the consumer's charset is hoisted out of the html and re-emitted first", () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    resolveConfig(plugin, '/')
    const result = transform(plugin, SHELL)

    expect(result.html).not.toContain('charset')
    expect(result.tags[0]).toEqual({ tag: 'meta', attrs: { charset: 'utf-8' } })
    // The hoist takes the whole line — no orphaned indentation left behind.
    expect(result.html).toContain('<head>\n    <title>App</title>')
  })

  test('a shell that declares no encoding gets one', () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    resolveConfig(plugin, '/')
    expect(transform(plugin, HTML_NO_VIEWPORT).tags[0]).toEqual({
      tag: 'meta',
      attrs: { charset: 'UTF-8' },
    })
  })

  test('the legacy http-equiv form is left completely alone', () => {
    const html =
      '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
      '</head><body></body></html>'
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    resolveConfig(plugin, '/')
    const result = transform(plugin, html)

    expect(result.html).toBe(html)
    expect(result.tags.some((tag) => tag.attrs?.['charset'] !== undefined)).toBe(false)
  })

  test("the hook runs `pre` so no other plugin's tags can land ahead of the charset", () => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR })
    expect((plugin.transformIndexHtml as { order?: string }).order).toBe('pre')
  })
})
