import { describe, expect, test } from 'bun:test'
import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite'
import { basaltAppPlugin } from './vite'

type BasaltAppOptions = Parameters<typeof basaltAppPlugin>[0]

/** Fixed, palette-independent theme colors so these tests never couple to `tokens/palette.ts`. */
const THEME_COLOR = { light: '#ffffff', dark: '#111111' } as const
const SCOPE = 'html:not([data-mantine-color-scheme])'
const LIGHT_VARIANT = `${SCOPE}[data-basalt-boot=light]{background-color:#ffffff;color-scheme:light}`
const DARK_VARIANT = `${SCOPE}[data-basalt-boot=dark]{background-color:#111111;color-scheme:dark}`

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
          'html:not([data-mantine-color-scheme]){background-color:#111111;color-scheme:dark}' +
          LIGHT_VARIANT +
          DARK_VARIANT,
      },
      { tag: 'script', children: expect.stringContaining('mantine-color-scheme-value') },
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

  // ── the consumer-named array form ─────────────────────────────────────────
  //
  // `{ dir }` can move basalt's six filenames but not rename one, so an app whose only icon is
  // `favicon.svg` could pick between a manifest naming two PNGs it does not ship and a manifest
  // with no icons at all. Both are wrong for an installable app, and the second is why rb still
  // kept a hand-written manifest one release after `icons: false` was fixed.

  // rb's REAL icon set, copied from apps/web/public/manifest.webmanifest — the manifest this
  // option exists to let the plugin generate.
  const RB_ICONS = [
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ] as const

  test("generates rb's hand-written manifest icons member verbatim", () => {
    const plugin = getPlugin({ name: 'rb', themeColor: THEME_COLOR, icons: RB_ICONS })
    const middleware = getDevMiddleware(plugin, '/')
    const manifest = JSON.parse(runMiddleware(middleware, '/site.webmanifest') ?? '{}')

    expect(manifest.icons).toEqual([
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ])
    expect(JSON.stringify(manifest)).not.toContain('.png')
    expect(manifest.name).toBe('rb')
    expect(manifest.display).toBe('standalone')
  })

  test('a named icon reaches the head only when it asks for a rel', () => {
    const iconLinks = (icons: NonNullable<BasaltAppOptions['icons']>): HtmlTagDescriptor[] => {
      const plugin = getPlugin({ name: 'rb', themeColor: THEME_COLOR, icons })
      resolveConfig(plugin, '/')
      return transformHtml(plugin, HTML_NO_VIEWPORT).filter(
        (tag) => tag.tag === 'link' && String(tag.attrs?.['rel']).includes('icon'),
      )
    }

    // rb's index.html already links favicon.svg — the manifest gets fixed, the head is left alone.
    expect(iconLinks(RB_ICONS)).toHaveLength(0)

    const withRel = iconLinks([{ src: 'favicon.svg', type: 'image/svg+xml', rel: 'icon' }])
    expect(withRel).toHaveLength(1)
    expect(withRel[0]?.attrs).toEqual({
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/favicon.svg',
    })
  })

  test('a named icon src is base-prefixed, with or without its leading slash', () => {
    const plugin = getPlugin({
      name: 'rb',
      themeColor: THEME_COLOR,
      icons: [
        { src: 'favicon.svg', sizes: 'any' },
        { src: '/icon-512.png', sizes: '512x512' },
      ],
    })
    const middleware = getDevMiddleware(plugin, '/myapp/')
    const manifest = JSON.parse(runMiddleware(middleware, '/myapp/site.webmanifest') ?? '{}')

    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      '/myapp/favicon.svg',
      '/myapp/icon-512.png',
    ])
  })

  test('an empty array reads as icons: false — no member, not an empty one', () => {
    const plugin = getPlugin({ name: 'rb', themeColor: THEME_COLOR, icons: [] })
    const middleware = getDevMiddleware(plugin, '/')
    const manifest = JSON.parse(runMiddleware(middleware, '/site.webmanifest') ?? '{}')
    expect(manifest.icons).toBeUndefined()
  })

  test('the array form omits keys the consumer did not write', () => {
    const plugin = getPlugin({ name: 'rb', themeColor: THEME_COLOR, icons: [{ src: '/a.svg' }] })
    const middleware = getDevMiddleware(plugin, '/')
    const manifest = JSON.parse(runMiddleware(middleware, '/site.webmanifest') ?? '{}')
    expect(manifest.icons).toEqual([{ src: '/a.svg' }])
  })
})

describe('basaltAppPlugin — the boot rule and the manifest', () => {
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

describe('basaltAppPlugin — boot tags', () => {
  const tagsOf = (options: Partial<BasaltAppOptions>): HtmlTagDescriptor[] => {
    const plugin = getPlugin({ name: 'Test App', themeColor: THEME_COLOR, ...options })
    resolveConfig(plugin, '/')
    return transformHtml(plugin, HTML_NO_VIEWPORT)
  }

  test('the boot script lands after the charset meta and immediately after the boot style', () => {
    const tags = tagsOf({})
    const style = tags.findIndex((tag) => tag.tag === 'style')
    const script = tags.findIndex((tag) => tag.tag === 'script')
    expect(tags[0]).toEqual({ tag: 'meta', attrs: { charset: 'UTF-8' } })
    expect(style).toBeGreaterThan(0)
    expect(script).toBe(style + 1)
  })

  test('bootScript: false drops the script and the stored-scheme variants', () => {
    const tags = tagsOf({ bootScript: false })
    expect(tags.some((tag) => tag.tag === 'script')).toBe(false)
    const style = tags.find((tag) => tag.tag === 'style')
    expect(String(style?.children)).toBe(`${SCOPE}{background-color:#111111;color-scheme:dark}`)
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
