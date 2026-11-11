/**
 * The document head half of `basalt()`, absorbed from 2.x `basaltAppPlugin`: the pre-paint theme
 * script (`basalt-ui/theme-script`) through `transformIndexHtml`, the theme-color pair, and with
 * `app` the web manifest, icons, SEO tags and the optional service worker. The 2.x anti-FOUC
 * `<style>` is gone: the theme script stamps `data-theme` before first paint and `tokens.css`
 * paints the canvas from it.
 */
import type { HtmlTagDescriptor, Plugin } from 'vite'

import { themeScript } from '../css/theme-script'
import type { ThemeScriptOptions } from '../css/theme-script'
import { deriveV3 } from '../tokens/derive'

export type ColorPair = { light: string; dark: string }

/** One icon: a manifest `icons` member, and a head `<link>` when it names `rel`. */
export type BasaltAppIcon = {
  /** Root-relative path under `public/`, prefixed with Vite's `base`. */
  src: string
  sizes?: string
  type?: string
  purpose?: string
  rel?: 'icon' | 'shortcut icon' | 'apple-touch-icon' | 'mask-icon'
}

/** The installable-app half: manifest, icons, SEO and the service worker. */
export type BasaltAppOptions = {
  /** Manifest `name`, OG and Twitter title. */
  name: string
  /** Home-screen label. Default: `name`. */
  shortName?: string
  description?: string
  /** Manifest `display`. Default `'standalone'`. */
  display?: 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser'
  /** Manifest `start_url`, verbatim. Default: Vite's `base`. */
  startUrl?: string
  /** Manifest `scope`, verbatim. Default: Vite's `base`. */
  scope?: string
  /** Manifest `id`. Default: the start URL. */
  id?: string
  /** Manifest `background_color` and `theme_color`. Default: the dark canvas. */
  backgroundColor?: string
  /** The icons this app has; omitted or empty: no icon links and no manifest `icons` member. */
  icons?: readonly BasaltAppIcon[]
  /** `<meta name="darkreader-lock">` unless `false`. */
  darkreader?: 'lock' | false
  /** Site-wide SEO; only the keys given are emitted. */
  seo?: { url?: string; image?: string; twitterCard?: 'summary' | 'summary_large_image' }
  /** `false`: no `site.webmanifest`, no manifest link. */
  manifest?: false
  /**
   * Service worker through the optional peer `vite-plugin-pwa`: `true` for the defaults, an object
   * deep-merged over them. Absent peer: one warning, no service worker.
   */
  serviceWorker?: boolean | Record<string, unknown>
}

export type HeadOptions = {
  /** Options for the pre-paint scheme script, or `false` to leave it out. */
  themeScript?: ThemeScriptOptions | false
  /** `'auto'` (default): the `--vx-canvas` pair of the default palette; or a flat pair; `false`: none. */
  themeColor?: 'auto' | ColorPair | false
  app?: BasaltAppOptions
}

/** Flat colors for `<meta name="theme-color">`: the default palette's canvas. */
export function canvasPair(): ColorPair {
  return deriveV3().colors.canvas
}

const CHARSET_META =
  /[ \t]*<meta\s+charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=]+))\s*\/?>[ \t]*\r?\n?/i
const HTTP_EQUIV_CHARSET = /<meta\s[^>]*http-equiv\s*=\s*["']?content-type["']?[^>]*>/i
const VIEWPORT = /<meta\s+[^>]*name=["']viewport["']/i

/**
 * Every tag here is `head-prepend`, which would push the shell's `<meta charset>` past the spec's
 * first 1024 bytes; so the declaration is taken out and re-emitted first. The `http-equiv` form is
 * left alone; a shell with none gets UTF-8.
 */
function hoistCharset(html: string): { html: string; tag: HtmlTagDescriptor | null } {
  if (HTTP_EQUIV_CHARSET.test(html)) return { html, tag: null }
  const match = CHARSET_META.exec(html)
  const charset = match?.[1] ?? match?.[2] ?? match?.[3] ?? 'UTF-8'
  return {
    html: match ? html.replace(CHARSET_META, '') : html,
    tag: { tag: 'meta', attrs: { charset } },
  }
}

const withBase = (base: string, src: string): string =>
  base + (src.startsWith('/') ? src.slice(1) : src)

const meta = (key: 'name' | 'property', id: string, content: string): HtmlTagDescriptor => ({
  tag: 'meta',
  attrs: { [key]: id, content },
})

function seoTags(app: BasaltAppOptions): HtmlTagDescriptor[] {
  const { name, description, seo } = app
  const tags: HtmlTagDescriptor[] = []
  if (description) tags.push(meta('name', 'description', description))
  if (description || seo?.url || seo?.image) {
    if (seo?.url) {
      tags.push({ tag: 'link', attrs: { rel: 'canonical', href: seo.url } })
      tags.push(meta('property', 'og:url', seo.url))
    }
    tags.push(meta('property', 'og:type', 'website'), meta('property', 'og:title', name))
    if (description) tags.push(meta('property', 'og:description', description))
    if (seo?.image) tags.push(meta('property', 'og:image', seo.image))
  }
  if (seo?.twitterCard) {
    tags.push(meta('name', 'twitter:card', seo.twitterCard), meta('name', 'twitter:title', name))
    if (description) tags.push(meta('name', 'twitter:description', description))
    if (seo.image) tags.push(meta('name', 'twitter:image', seo.image))
  }
  return tags
}

function appTags(app: BasaltAppOptions, base: string, manifestHref: string): HtmlTagDescriptor[] {
  const tags: HtmlTagDescriptor[] = []
  for (const icon of app.icons ?? []) {
    if (icon.rel === undefined) continue
    tags.push({
      tag: 'link',
      attrs: {
        rel: icon.rel,
        ...(icon.type === undefined ? {} : { type: icon.type }),
        ...(icon.sizes === undefined ? {} : { sizes: icon.sizes }),
        href: withBase(base, icon.src),
      },
    })
  }
  const shortName = app.shortName ?? app.name
  tags.push(
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: shortName } },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
    { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' } },
  )
  if (app.darkreader !== false) tags.push({ tag: 'meta', attrs: { name: 'darkreader-lock' } })
  if (app.manifest !== false)
    tags.push({ tag: 'link', attrs: { rel: 'manifest', href: manifestHref } })
  return [...tags, ...seoTags(app)]
}

export function manifestJson(app: BasaltAppOptions, base: string, color: string): string {
  const startUrl = app.startUrl ?? base
  const icons = (app.icons ?? []).map((icon) => ({
    src: withBase(base, icon.src),
    ...(icon.sizes === undefined ? {} : { sizes: icon.sizes }),
    ...(icon.type === undefined ? {} : { type: icon.type }),
    ...(icon.purpose === undefined ? {} : { purpose: icon.purpose }),
  }))
  const manifest = {
    id: app.id ?? startUrl,
    name: app.name,
    short_name: app.shortName ?? app.name,
    ...(app.description ? { description: app.description } : {}),
    start_url: startUrl,
    scope: app.scope ?? base,
    display: app.display ?? 'standalone',
    theme_color: color,
    background_color: app.backgroundColor ?? color,
    ...(icons.length === 0 ? {} : { icons }),
  }
  return JSON.stringify(manifest, null, 2)
}

/** The head plugin: theme script, theme-color pair, and the `app` manifest and tags. */
export function headPlugin(options: HeadOptions): Plugin {
  const script = options.themeScript === false ? null : themeScript(options.themeScript ?? {})
  const colors =
    options.themeColor === false
      ? null
      : options.themeColor === undefined || options.themeColor === 'auto'
        ? canvasPair()
        : options.themeColor
  const app = options.app
  const manifestEnabled = app !== undefined && app.manifest !== false
  let base = '/'
  let manifestHref = '/site.webmanifest'

  return {
    name: 'basalt:head',
    configResolved(config) {
      base = config.base
      manifestHref = withBase(base, 'site.webmanifest')
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const hoisted = hoistCharset(html)
        const tags: HtmlTagDescriptor[] = []
        if (hoisted.tag) tags.push(hoisted.tag)
        if (!VIEWPORT.test(html)) {
          tags.push({
            tag: 'meta',
            attrs: {
              name: 'viewport',
              content: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
            },
          })
        }
        // Once: an index.html that already carries the script keeps its own copy.
        if (script !== null && !html.includes(script))
          tags.push({ tag: 'script', children: script })
        if (colors !== null) {
          for (const scheme of ['light', 'dark'] as const) {
            tags.push({
              tag: 'meta',
              attrs: {
                name: 'theme-color',
                media: `(prefers-color-scheme: ${scheme})`,
                content: colors[scheme],
              },
            })
          }
        }
        if (app !== undefined) tags.push(...appTags(app, base, manifestHref))
        return { html: hoisted.html, tags }
      },
    },
    generateBundle() {
      if (!manifestEnabled) return
      this.emitFile({
        type: 'asset',
        fileName: 'site.webmanifest',
        source: manifestJson(app, base, (colors ?? canvasPair()).dark),
      })
    },
    configureServer(server) {
      if (!manifestEnabled) return
      server.middlewares.use((req, res, next) => {
        if (req.url !== manifestHref && req.url !== '/site.webmanifest') return next()
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(manifestJson(app, base, (colors ?? canvasPair()).dark))
      })
    },
  }
}

const SERVICE_WORKER_DEFAULTS: Record<string, unknown> = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  // basalt() emits the manifest; vite-plugin-pwa never does.
  manifest: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api/],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  },
  devOptions: { enabled: false },
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof RegExp)

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over)) {
    const prior = out[key]
    out[key] = isRecord(prior) && isRecord(value) ? deepMerge(prior, value) : value
  }
  return out
}

type VitePwaModule = { VitePWA: (options: Record<string, unknown>) => Plugin[] }

/** `vite-plugin-pwa` with the merged options, or `false` (and one warning) when it is absent. */
export async function serviceWorkerPlugins(
  serviceWorker: true | Record<string, unknown>,
): Promise<Plugin[] | false> {
  let mod: VitePwaModule
  try {
    mod = (await import('vite-plugin-pwa')) as unknown as VitePwaModule
  } catch {
    // oxlint-disable-next-line no-console -- a build-time notice has no other channel
    console.warn(
      '[basalt-ui] serviceWorker needs the optional peer vite-plugin-pwa; skipping the service ' +
        'worker. Run: bun add -D vite-plugin-pwa workbox-build workbox-window',
    )
    return false
  }
  return mod.VitePWA(
    deepMerge(SERVICE_WORKER_DEFAULTS, serviceWorker === true ? {} : serviceWorker),
  )
}
