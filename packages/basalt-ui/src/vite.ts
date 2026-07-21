/**
 * basaltViteConfig — a partial Vite config for apps consuming basalt-ui.
 *
 * Grounded verbatim in argo `apps/dashboard/vite.config.ts`: the Mantine dedupe list, the Mantine
 * subpackage `optimizeDeps.include`, the `strictPort` dev server with `allowedHosts`, the `/api`
 * prefix-strip proxy, the `__APP_VERSION__` define, and the local-checkout `BASALT_LOCAL` alias
 * branch.
 *
 * Returns ONLY config (no `plugins`) — plugins stay app-side, since they carry app-specific
 * concerns (router codegen, PWA, react-compiler babel) that don't belong in a shared spine. Argo's
 * `@mantine/schedule` is likewise app-domain and is not pre-bundled here; consumers add their own
 * extra subpackages to `optimizeDeps.include` if needed.
 *
 * NEVER reference `import.meta.env` here — this file is invoked inside the consumer's vite config
 * at config-evaluation time (plain Node), where only `process.env` exists.
 */
import { resolve } from 'node:path'
import { searchForWorkspaceRoot } from 'vite'
import type { HtmlTagDescriptor, Plugin, PluginOption, UserConfig } from 'vite'
import { SURFACE } from './tokens/palette'
import { resolveColorMix } from './vite-color-mix'

export type BasaltViteOptions = {
  /** Dev server port. Passed with `strictPort: true` so the app fails fast on a busy port. */
  port: number
  /** Dev server host (bind address, or `true` to listen on all interfaces). */
  host?: string | boolean
  /**
   * Hostnames the dev server accepts (Vite's `server.allowedHosts`). Needed when fronting the dev
   * server behind a local reverse proxy on a custom domain (e.g. `['app.test']`).
   */
  allowedHosts?: string[]
  /**
   * When set, enable the `/api` dev proxy: requests to `/api/*` strip the `/api` prefix and proxy
   * to this target. For prod debugging point at a target that already includes `/api`
   * (e.g. `https://example.com/api`); for a bare local API that serves routes without a prefix,
   * point at its origin (e.g. `http://localhost:4040`).
   */
  apiTarget?: string
  /**
   * Absolute path to a sibling basalt-ui `src/` checkout. When set (or when the `BASALT_LOCAL` env
   * var is set), alias the `basalt-ui` import to that source for live local development and allow
   * Vite's dev server to serve files from it. Because `resolve.alias` is part of Vite's prebundle
   * cache key, toggling this auto-invalidates the optimizer cache.
   */
  basaltSrc?: string
  /** App version surfaced via the `__APP_VERSION__` define. Defaults to `0.0.0`. */
  version?: string
}

export function basaltViteConfig(opts: BasaltViteOptions): UserConfig {
  const { port, host, allowedHosts, apiTarget, version = '0.0.0' } = opts

  // basaltSrc opt wins; fall back to the BASALT_LOCAL env so a consumer can flip local-source dev
  // on without editing its vite config. process.env (not import.meta.env) — this runs in Node.
  const basaltSrc = opts.basaltSrc ?? process.env['BASALT_LOCAL']

  const config: UserConfig = {
    define: {
      __APP_VERSION__: JSON.stringify(process.env['BUILD_VERSION'] ?? version),
      // basalt-ui source uses `process.env.NODE_ENV` for cross-bundler dev-only stripping (the
      // package bans `import.meta.env`). When consumed as a pre-bundled dist dep, Vite's optimizer
      // replaces it — but the source-aliased playground / BASALT_LOCAL path bypasses optimization,
      // leaving `process` undefined in the browser. Define it here so source-served basalt-ui runs.
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
    resolve: {
      // Force these packages to a single instance. Without dedupe, Vite's optimizer can stamp a
      // second copy of @mantine/core into another subpackage's pre-bundle, which breaks
      // MantineProvider context.
      dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
    },
    optimizeDeps: {
      // Pre-bundle the Mantine subpackages together so they share one @mantine/core instance (and
      // one MantineProvider context). Consumers append their own (e.g. @mantine/schedule).
      include: [
        '@mantine/core',
        '@mantine/hooks',
        '@mantine/form',
        '@mantine/modals',
        '@mantine/notifications',
      ],
    },
    server: {
      port,
      strictPort: true,
      ...(host !== undefined ? { host } : {}),
      ...(allowedHosts !== undefined ? { allowedHosts } : {}),
    },
  }

  if (apiTarget) {
    config.server = {
      ...config.server,
      proxy: {
        '/api': {
          target: apiTarget,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
          changeOrigin: true,
          // Prod targets sit behind HTTPS — must be set or SNI/cert chatter surfaces as 502s.
          secure: true,
        },
      },
    }
  }

  // BASALT_LOCAL: develop against a sibling basalt-ui checkout's source.
  if (basaltSrc) {
    const srcDir = resolve(basaltSrc)
    config.resolve = {
      ...config.resolve,
      alias: { 'basalt-ui': srcDir },
    }
    // Serving from an out-of-root srcDir requires widening fs.allow, but an explicit allow list
    // replaces Vite's default (the workspace root) — so the consumer's own root must be re-added,
    // else its index.html / source falls outside the list. searchForWorkspaceRoot finds it.
    config.server = {
      ...config.server,
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), srcDir] },
    }
  }

  return config
}

// ──────────────────────────────────────────────────────────────────────────────
// basaltAppPlugin — PWA / favicon / head-metadata plugin, one config object
// ──────────────────────────────────────────────────────────────────────────────

/** The realfavicongenerator filenames argo already ships under its `public/` root. */
const ICON_FILES = {
  favicon: 'favicon.ico',
  svg: 'favicon.svg',
  png96: 'favicon-96x96.png',
  appleTouch: 'apple-touch-icon.png',
  manifest192: 'web-app-manifest-192x192.png',
  manifest512: 'web-app-manifest-512x512.png',
} as const

export type BasaltAppOptions = {
  /** App display name — used verbatim as the manifest `name` and (unless overridden) OG title. */
  name: string
  /** Short name for home-screen labels. Default: `name`. */
  shortName?: string
  /** Site-wide description — feeds the `<meta name="description">` and OG/Twitter description. */
  description?: string
  /**
   * `'auto'` (default) resolves the flat theme-color pair from `SURFACE.bg` (basalt's own page
   * background token, a `color-mix()` expression) via the color-mix resolver — the reason this
   * plugin exists. Pass an explicit `{ light, dark }` pair of already-flat CSS colors to override.
   */
  themeColor?: 'auto' | { light: string; dark: string }
  /** Manifest `background_color` + anti-FOUC paint color. Default: the resolved dark theme color. */
  backgroundColor?: string
  /** Manifest `display` mode. Default: `'standalone'`. */
  display?: 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser'
  /**
   * Manifest `start_url`. Defaults to Vite's resolved `base` (so a non-root deploy — e.g. GitHub
   * Pages' `/repo/` — gets a correct value with zero config). An explicit value is used verbatim:
   * it is NOT re-prefixed with `base`, so pass the fully base-aware path yourself if you set it.
   */
  startUrl?: string
  /**
   * Manifest `scope`. Defaults to Vite's resolved `base`. An explicit value is used verbatim (not
   * re-prefixed with `base`) — same rule as `startUrl`.
   */
  scope?: string
  /** Manifest `id`. Default: the resolved `startUrl` (default- or explicitly-derived, per above). */
  id?: string
  /** Icon links + manifest icon paths. `false` skips the head `<link>` icons entirely. */
  icons?: false | { dir?: string }
  /** Emits `<meta name="darkreader-lock">` when `'lock'` (default). Pass `false` to omit it. */
  darkreader?: 'lock' | false
  /** Site-wide SEO metadata — only the keys provided are emitted, no per-page SEO. */
  seo?: { url?: string; image?: string; twitterCard?: 'summary' | 'summary_large_image' }
  /** `false` skips manifest generation/serving and the `<link rel="manifest">` tag entirely. */
  manifest?: false
  /**
   * Opt-in service worker via the optional peer `vite-plugin-pwa`. `true` uses argo-tuned workbox
   * defaults; an object is deep-merged over those defaults. Default `false` (no service worker).
   * Degrades to a one-line console warning (no service worker, no throw) when the peer — plus its
   * non-optional peers `workbox-build` / `workbox-window` — is not installed.
   */
  serviceWorker?: boolean | Record<string, unknown>
}

/** Hand-written peer type for `vite-plugin-pwa` (optional peer — never statically imported). */
type VitePwaModule = {
  VitePWA: (options: Record<string, unknown>) => Plugin[]
}

/** Argo-derived workbox defaults, deep-merged under any user-supplied `serviceWorker` object. */
const DEFAULT_SERVICE_WORKER_OPTIONS: Record<string, unknown> = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  // We emit our own manifest (theme-color-resolved, site.webmanifest) — never let VitePWA emit one.
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = result[key]
    result[key] =
      isPlainObject(baseValue) && isPlainObject(value) ? deepMerge(baseValue, value) : value
  }
  return result
}

function resolveThemeColors(themeColor: BasaltAppOptions['themeColor']): {
  light: string
  dark: string
} {
  if (themeColor === undefined || themeColor === 'auto') {
    return { light: resolveColorMix(SURFACE.bg.light), dark: resolveColorMix(SURFACE.bg.dark) }
  }
  return themeColor
}

function withIconPath(dir: string | undefined, file: string): string {
  if (!dir) return `/${file}`
  const trimmed = dir.replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/${file}` : `/${file}`
}

/**
 * Joins Vite's resolved `base` (always leading+trailing slash — `'/'` or e.g. `'/myapp/'`) with a
 * root-relative path (leading slash, e.g. `/favicon.ico`) without doubling or dropping the slash
 * between them. `base === '/'` is a no-op (`'/' + path.slice(1)` reconstructs `path` verbatim),
 * which is what keeps default-base output byte-identical to the pre-base-aware behavior.
 */
function withBase(base: string, path: string): string {
  return base + path.slice(1)
}

function hasViewportMeta(html: string): boolean {
  return /<meta\s+[^>]*name=["']viewport["']/i.test(html)
}

const VIEWPORT_TAG: HtmlTagDescriptor = {
  tag: 'meta',
  attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
}

function buildSeoTags(input: {
  name: string
  description: string | undefined
  seo: BasaltAppOptions['seo']
}): HtmlTagDescriptor[] {
  const { name, description, seo } = input
  const tags: HtmlTagDescriptor[] = []

  if (description) {
    tags.push({ tag: 'meta', attrs: { name: 'description', content: description } })
  }

  if (description || seo?.url || seo?.image) {
    if (seo?.url) {
      tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: seo.url } },
        { tag: 'meta', attrs: { property: 'og:url', content: seo.url } },
      )
    }
    tags.push(
      { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
      { tag: 'meta', attrs: { property: 'og:title', content: name } },
    )
    if (description) {
      tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description } })
    }
    if (seo?.image) {
      tags.push({ tag: 'meta', attrs: { property: 'og:image', content: seo.image } })
    }
  }

  if (seo?.twitterCard) {
    tags.push(
      { tag: 'meta', attrs: { name: 'twitter:card', content: seo.twitterCard } },
      { tag: 'meta', attrs: { name: 'twitter:title', content: name } },
    )
    if (description) {
      tags.push({ tag: 'meta', attrs: { name: 'twitter:description', content: description } })
    }
    if (seo?.image) {
      tags.push({ tag: 'meta', attrs: { name: 'twitter:image', content: seo.image } })
    }
  }

  return tags
}

/**
 * Builds the plugin's static head tags (everything except the viewport meta, which is
 * conditional on the consumer's own `index.html` — see `hasViewportMeta`).
 */
function buildStaticTags(input: {
  options: BasaltAppOptions
  shortName: string
  themeColor: { light: string; dark: string }
  backgroundColor: string
  iconsEnabled: boolean
  iconsDir: string | undefined
  darkreader: 'lock' | false
  manifestEnabled: boolean
  base: string
  manifestHref: string
}): HtmlTagDescriptor[] {
  const {
    options,
    shortName,
    themeColor,
    backgroundColor,
    iconsEnabled,
    iconsDir,
    darkreader,
    manifestEnabled,
    base,
    manifestHref,
  } = input
  const tags: HtmlTagDescriptor[] = []

  // Dual theme-color — flat resolved hex, never the raw color-mix() expression.
  tags.push(
    {
      tag: 'meta',
      attrs: {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: themeColor.light,
      },
    },
    {
      tag: 'meta',
      attrs: {
        name: 'theme-color',
        media: '(prefers-color-scheme: dark)',
        content: themeColor.dark,
      },
    },
  )

  // Anti-FOUC — BasaltProvider defaults to dark, so this paints the dark surface before any
  // stylesheet loads. injectTo defaults to 'head-prepend', so this (and every tag below) lands
  // immediately after <head>, ahead of the consumer's own <link rel="stylesheet"> tags.
  tags.push({
    tag: 'style',
    children: `html{background-color:${backgroundColor};color-scheme:dark}`,
  })

  if (iconsEnabled) {
    tags.push(
      {
        tag: 'link',
        attrs: {
          rel: 'shortcut icon',
          href: withBase(base, withIconPath(iconsDir, ICON_FILES.favicon)),
        },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'icon',
          type: 'image/svg+xml',
          href: withBase(base, withIconPath(iconsDir, ICON_FILES.svg)),
        },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'icon',
          sizes: '96x96',
          href: withBase(base, withIconPath(iconsDir, ICON_FILES.png96)),
        },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: withBase(base, withIconPath(iconsDir, ICON_FILES.appleTouch)),
        },
      },
    )
  }

  tags.push(
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: shortName } },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
    { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
    { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' } },
  )

  if (darkreader === 'lock') {
    tags.push({ tag: 'meta', attrs: { name: 'darkreader-lock' } })
  }

  if (manifestEnabled) {
    tags.push({ tag: 'link', attrs: { rel: 'manifest', href: manifestHref } })
  }

  tags.push(
    ...buildSeoTags({ name: options.name, description: options.description, seo: options.seo }),
  )

  return tags
}

function buildManifestJson(input: {
  options: BasaltAppOptions
  shortName: string
  startUrl: string
  scope: string
  id: string
  display: NonNullable<BasaltAppOptions['display']>
  themeColor: { light: string; dark: string }
  backgroundColor: string
  iconsDir: string | undefined
  base: string
}): string {
  const {
    options,
    shortName,
    startUrl,
    scope,
    id,
    display,
    themeColor,
    backgroundColor,
    iconsDir,
    base,
  } = input
  const manifest = {
    id,
    name: options.name,
    short_name: shortName,
    ...(options.description ? { description: options.description } : {}),
    start_url: startUrl,
    scope,
    display,
    theme_color: themeColor.dark,
    background_color: backgroundColor,
    icons: [
      {
        src: withBase(base, withIconPath(iconsDir, ICON_FILES.manifest192)),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: withBase(base, withIconPath(iconsDir, ICON_FILES.manifest512)),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
  return JSON.stringify(manifest, null, 2)
}

function createMainPlugin(options: BasaltAppOptions): Plugin {
  const shortName = options.shortName ?? options.name
  const display = options.display ?? 'standalone'
  const darkreader = options.darkreader ?? 'lock'
  const iconsEnabled = options.icons !== false
  const iconsDir = options.icons === false ? undefined : options.icons?.dir
  const manifestEnabled = options.manifest !== false

  const themeColor = resolveThemeColors(options.themeColor)
  const backgroundColor = options.backgroundColor ?? themeColor.dark

  // Icon hrefs, the manifest link, and the manifest's start_url/scope/icon src all depend on
  // Vite's resolved `base`, which is only known once `configResolved` fires — so manifestJson and
  // staticTags are computed there instead of at plugin-construction time. The pre-configResolved
  // values below are never actually served or rendered from.
  let manifestJson = ''
  let manifestHref = '/site.webmanifest'
  let staticTags: HtmlTagDescriptor[] = []

  return {
    name: 'basalt:app',
    configResolved(config) {
      const base = config.base
      const startUrl = options.startUrl ?? base
      const scope = options.scope ?? base
      const id = options.id ?? startUrl

      manifestHref = withBase(base, '/site.webmanifest')

      manifestJson = buildManifestJson({
        options,
        shortName,
        startUrl,
        scope,
        id,
        display,
        themeColor,
        backgroundColor,
        iconsDir,
        base,
      })

      staticTags = buildStaticTags({
        options,
        shortName,
        themeColor,
        backgroundColor,
        iconsEnabled,
        iconsDir,
        darkreader,
        manifestEnabled,
        base,
        manifestHref,
      })
    },
    transformIndexHtml(html) {
      const tags = hasViewportMeta(html) ? staticTags : [VIEWPORT_TAG, ...staticTags]
      return { html, tags }
    },
    generateBundle() {
      if (!manifestEnabled) return
      this.emitFile({ type: 'asset', fileName: 'site.webmanifest', source: manifestJson })
    },
    configureServer(server) {
      if (!manifestEnabled) return
      server.middlewares.use((req, res, next) => {
        // Vite adds its own base-stripping middleware (`viteBaseMiddleware`) AFTER plugin
        // `configureServer` hooks push middleware directly onto the stack (confirmed against this
        // repo's installed vite: configureServer hooks run first, then
        // `if (config.base !== '/') middlewares.use(baseMiddleware(...))`), so `req.url` here still
        // carries the raw, un-stripped base prefix rather than the stripped path. Match both the
        // base-prefixed and bare path defensively so this keeps working regardless of that
        // internal ordering.
        if (req.url === manifestHref || req.url === '/site.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.end(manifestJson)
          return
        }
        next()
      })
    },
  }
}

/**
 * Resolves the optional `vite-plugin-pwa` peer (plus its non-optional peers `workbox-build` /
 * `workbox-window`) and returns its plugin array, or `false` when the peer is absent.
 *
 * A Vite plugin factory is synchronous, but `vite-plugin-pwa` can only be loaded via a dynamic
 * `import()` (it must stay an OPTIONAL peer — `basaltAppPlugin` has to keep resolving cleanly when
 * it isn't installed). Vite's own `PluginOption` type is a `Thenable` that recursively allows
 * `Promise<Plugin | Plugin[] | false>`, so returning a promise for this half of the plugin array —
 * rather than shoehorning the dynamic import into a synchronous hook — is the idiomatic way to
 * resolve an optional async plugin dependency in Vite 7/8 (confirmed directly against this repo's
 * installed `vite` package's `.d.ts`, not from memory).
 */
function createServiceWorkerPlugin(
  serviceWorker: boolean | Record<string, unknown>,
): Promise<Plugin[] | false> {
  return (async (): Promise<Plugin[] | false> => {
    let mod: VitePwaModule
    try {
      mod = (await import('vite-plugin-pwa')) as unknown as VitePwaModule
    } catch {
      console.warn(
        '[basalt-ui] serviceWorker was requested but the optional peer "vite-plugin-pwa" ' +
          '(plus its own peers workbox-build, workbox-window) is not installed — skipping the ' +
          'service worker. Install with: bun add -D vite-plugin-pwa workbox-build workbox-window',
      )
      return false
    }
    const overrides = typeof serviceWorker === 'object' ? serviceWorker : {}
    const pwaOptions = deepMerge(DEFAULT_SERVICE_WORKER_OPTIONS, overrides)
    return mod.VitePWA(pwaOptions)
  })()
}

/**
 * Generates PWA / favicon / head metadata for a consumer app from one config object — a Vite
 * plugin (well, plugin array — see the service-worker note below) placed in the consumer's own
 * `plugins` array (never returned by `basaltViteConfig`, which stays plugin-free by contract).
 *
 * The core value over hand-authoring this yourself: `themeColor: 'auto'` (the default) derives
 * the flat `<meta name="theme-color">` / manifest `theme_color` pair from basalt's own
 * `SURFACE.bg` design token, so the value tracks the palette instead of being a copied hex that
 * silently rots when the palette is retuned.
 *
 * `SURFACE.bg` is generated by `tokens/derive.ts` and currently resolves to plain hex, which the
 * resolver passes through untouched. It is run through `resolveColorMix` anyway because the token
 * layer has historically expressed surfaces as `color-mix()` and may again — a meta tag and a
 * manifest `theme_color` both need a FLAT color, so the flattening step is the contract this
 * plugin owes its output regardless of which shape the palette hands it.
 *
 * @example
 * // vite.config.ts
 * import { basaltAppPlugin, basaltViteConfig } from 'basalt-ui/vite'
 *
 * export default {
 *   ...basaltViteConfig({ port: 5173 }),
 *   plugins: [react(), ...basaltAppPlugin({ name: 'Argo' })],
 * }
 */
export function basaltAppPlugin(options: BasaltAppOptions): PluginOption[] {
  const plugins: PluginOption[] = [createMainPlugin(options)]
  if (options.serviceWorker) {
    plugins.push(createServiceWorkerPlugin(options.serviceWorker))
  }
  return plugins
}
