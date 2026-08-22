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
 *
 * It also carries the enforcement notice (`warnIfUnenforced`): this is the one basalt seam that runs
 * on every dev start and every build of a consumer app, so it is the only place that can tell an app
 * it installed the components and skipped `basalt-ui init`.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
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
  /**
   * Print a one-time notice when `basalt-ui init` has never been run in this project (no
   * `.basalt/manifest.json` found at or above the cwd) — see `warnIfUnenforced`. Default `true`.
   * Set `false` to adopt the components without the toolchain and stop being told about it.
   */
  enforcementNotice?: boolean
}

/** How many directories up from `cwd` to look for `.basalt/manifest.json`. Three covers the common
 * shapes: config at the app root, an app in `web/` or `apps/<name>/` under a repo root. */
const UNENFORCED_SEARCH_DEPTH = 3

/** Set once the notice has been printed, so a watch-mode restart doesn't reprint it every reload. */
let unenforcedNoticePrinted = false

/**
 * Print one notice when basalt-ui is installed as a component library and nothing else.
 *
 * `basalt-ui init` is what places the oxlint preset, the theme-guard wiring, the lefthook stub and
 * the agent rules. Skipping it leaves a consumer with the components and NONE of the enforcement —
 * and, critically, no signal that this is the case. The failure is silent and cumulative: every
 * hand-rolled `<Card withBorder radius="md" padding="lg">` renders perfectly, so the app drifts a
 * card idiom at a time until someone looks at a screenshot and asks why the design system did
 * nothing. The first real consumer reached seven such cards across six files that way.
 *
 * This is the only seam basalt owns that runs on every dev start and every build, which makes it
 * the only place that can say so at the time it is still cheap to fix. It stays a notice, never an
 * error: declining to adopt the toolchain is a legitimate choice, and a build that fails because a
 * lint preset is absent would be a worse bug than the one this prevents.
 */
function warnIfUnenforced(cwd: string): void {
  if (unenforcedNoticePrinted) return

  let dir = cwd
  for (let i = 0; i <= UNENFORCED_SEARCH_DEPTH; i++) {
    if (existsSync(resolve(dir, '.basalt/manifest.json'))) return
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  unenforcedNoticePrinted = true
  // oxlint-disable-next-line no-console -- a build-time notice has no other channel
  console.warn(
    '\n[basalt-ui] Installed, but `basalt-ui init` has never run here — no oxlint preset, no theme\n' +
      '            guard, no agent rules. You have the components and none of the enforcement.\n' +
      '            Fix: `bunx basalt-ui init`, then add `oxlint . && basalt-ui check-theme` as your\n' +
      '            lint script. Silence: pass `enforcementNotice: false` to basaltViteConfig().\n',
  )
}

export function basaltViteConfig(opts: BasaltViteOptions): UserConfig {
  const { port, host, allowedHosts, apiTarget, version = '0.0.0' } = opts

  // basaltSrc opt wins; fall back to the BASALT_LOCAL env so a consumer can flip local-source dev
  // on without editing its vite config. process.env (not import.meta.env) — this runs in Node.
  const basaltSrc = opts.basaltSrc ?? process.env['BASALT_LOCAL']

  // Skipped under basaltSrc/BASALT_LOCAL: that path means basalt-ui itself is being developed from
  // a sibling checkout (the playground, or a consumer debugging against local source), where the
  // enforcement config lives in basalt's own repo and a manifest is not expected.
  if (opts.enforcementNotice !== false && basaltSrc === undefined) {
    warnIfUnenforced(process.cwd())
  }

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

/**
 * One icon a consumer names itself — a manifest `icons` member, plus optionally the head `<link>`
 * that points at the same file.
 *
 * The field names are the manifest's own, verbatim, so what a consumer writes here is what ships in
 * `site.webmanifest`. `src` is root-relative (`'/favicon.svg'` or `'favicon.svg'`, both resolve the
 * same) and is prefixed with Vite's `base` exactly like basalt's built-in set.
 */
export type BasaltAppIcon = {
  /** Root-relative path under `public/`. Prefixed with Vite's resolved `base`. */
  src: string
  /** Manifest `sizes`. `'any'` for a scalable SVG; `'192x192'` for a raster. */
  sizes?: string
  /** MIME type, e.g. `'image/svg+xml'`. */
  type?: string
  /** Manifest `purpose`, e.g. `'any maskable'`. */
  purpose?: string
  /**
   * Emit a head `<link rel="…">` for this icon too. Omitted → manifest only, which is what an app
   * that links its own favicon from `index.html` wants.
   */
  rel?: 'icon' | 'shortcut icon' | 'apple-touch-icon' | 'mask-icon'
}

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
  /**
   * Which scheme the anti-FOUC `<style>` paints before the app boots. Default `'dark'` —
   * `BasaltProvider`'s own default. `'light'` paints the light surface, `'auto'` declares
   * `color-scheme: light dark` and picks the background off `prefers-color-scheme`, and `false`
   * paints the background but declares no `color-scheme` at all (leave native controls to Mantine).
   *
   * Set this to whatever the app passes as `defaultColorScheme` — a mismatch is a visible flash of
   * the wrong surface, not a correctness bug: the boot rule stops applying the moment Mantine
   * writes `data-mantine-color-scheme` on `<html>` (see `BOOT_SCOPE`).
   */
  colorScheme?: 'dark' | 'light' | 'auto' | false
  /**
   * Manifest `background_color` + anti-FOUC paint color. Default: the theme color matching
   * `colorScheme` (the dark one for `'dark'` / `'auto'` / `false`, the light one for `'light'`).
   */
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
  /**
   * Which icons the plugin knows about — three forms, one question each.
   *
   * - **omitted / `{ dir }`** — basalt's own six-filename set (the realfavicongenerator layout argo
   *   ships), optionally under a subdirectory of `public/`. Unchanged default.
   * - **`false`** — no head `<link>` icons and no manifest `icons` member, so a manifest is never
   *   emitted pointing at files that 404.
   * - **an array** — the icons this app ACTUALLY has, named by the consumer.
   *
   * The array is the form for every app that was not scaffolded from basalt's icon set, which is
   * most of them. `{ dir }` can only move the six fixed filenames; it cannot rename one, so an app
   * whose single icon is `favicon.svg` had no way to say so and had to keep a hand-written manifest
   * beside the generated head — the last thing standing between rb and deleting a file carrying a
   * permanent `theme-allow-file`. One SVG at `sizes: 'any'` is a complete, installable icon set.
   *
   * Every entry becomes a manifest icon; an entry becomes a head `<link>` only when it names a
   * {@link BasaltAppIcon.rel}. That split is deliberate — an app that already links its favicon
   * from its own `index.html` wants the manifest fixed without a duplicate tag, and an app that
   * wants the plugin to own the head says so per icon. An empty array reads as `false`.
   */
  icons?: false | { dir?: string } | readonly BasaltAppIcon[]
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

/**
 * The three `icons` forms, collapsed to what the two emitters actually need.
 *
 * `'none'` and `'default'` are the pre-existing behaviour verbatim — `'default'` still walks
 * {@link ICON_FILES}, so an app on basalt's own icon layout emits byte-identical head tags and a
 * byte-identical manifest. `'explicit'` is the new form. An EMPTY array collapses to `'none'`
 * rather than to an empty `icons: []` member: a manifest declaring zero icons is a claim, and the
 * honest way to say "this app has no icons" already exists.
 */
type ResolvedIcons =
  | { mode: 'none' }
  | { mode: 'default'; dir: string | undefined }
  | { mode: 'explicit'; icons: readonly BasaltAppIcon[] }

/** `Array.isArray` widens to `any[]` and does not narrow a `readonly T[]` OUT of a union. */
function isIconList(
  icons: { dir?: string } | readonly BasaltAppIcon[],
): icons is readonly BasaltAppIcon[] {
  return Array.isArray(icons)
}

function resolveIcons(icons: BasaltAppOptions['icons']): ResolvedIcons {
  if (icons === false) return { mode: 'none' }
  if (icons === undefined) return { mode: 'default', dir: undefined }
  if (!isIconList(icons)) return { mode: 'default', dir: icons.dir }
  return icons.length === 0 ? { mode: 'none' } : { mode: 'explicit', icons }
}

/** Root-relative `src` (with or without its leading slash) → base-prefixed href. */
function iconHref(base: string, src: string): string {
  return withBase(base, src.startsWith('/') ? src : `/${src}`)
}

function hasViewportMeta(html: string): boolean {
  return /<meta\s+[^>]*name=["']viewport["']/i.test(html)
}

const VIEWPORT_TAG: HtmlTagDescriptor = {
  tag: 'meta',
  attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
}

// ── The anti-FOUC boot rule ───────────────────────────────────────────────────────────────────

/**
 * The selector every anti-FOUC declaration is scoped to.
 *
 * The rule paints the page before any stylesheet lands, so it is UNLAYERED by construction — and an
 * unlayered declaration outranks every layered one regardless of specificity. Through 1.20.0 that
 * meant a flat `html{color-scheme:dark}` permanently beat Mantine's own
 * `@layer mantine{:root{color-scheme:var(--mantine-color-scheme)}}`: a light-scheme consumer got
 * dark scrollbars, dark `<select>` popups and dark date pickers forever, with no opt-out (found
 * independently by two consumers).
 *
 * `MantineProvider` writes `data-mantine-color-scheme` onto `<html>` as soon as it mounts, so
 * scoping the boot rule to its ABSENCE makes it expire exactly when the real theme exists — which
 * is the anti-FOUC contract stated honestly. A cascade layer would also work in principle and is
 * deliberately NOT used: a layer's position is fixed by where its name is first encountered, and in
 * dev Mantine's CSS is injected by JS after this `<style>` is already in the document, so the layer
 * order would depend on bundler mode. Selector scoping depends on nothing.
 */
const BOOT_SCOPE = 'html:not([data-mantine-color-scheme])'

/** The `color-scheme` value each boot mode declares. `false` declares none. */
const BOOT_COLOR_SCHEME = { dark: 'dark', light: 'light', auto: 'light dark' } as const

/**
 * Builds the anti-FOUC stylesheet: paint the surface (and, unless opted out, tell the UA which
 * native-control palette to use) for the frames between first paint and Mantine's stylesheet.
 *
 * `'auto'` with no explicit `backgroundColor` emits a `prefers-color-scheme` pair so the pre-boot
 * paint follows the OS the same way `color-scheme: light dark` does; an explicit `backgroundColor`
 * is used verbatim for both, since the consumer has named one color on purpose.
 */
function buildBootStyle(input: {
  colorScheme: 'dark' | 'light' | 'auto' | false
  themeColor: { light: string; dark: string }
  backgroundColor: string
  explicitBackground: boolean
}): string {
  const { colorScheme, themeColor, backgroundColor, explicitBackground } = input

  if (colorScheme === false) return `${BOOT_SCOPE}{background-color:${backgroundColor}}`

  const scheme = BOOT_COLOR_SCHEME[colorScheme]
  if (colorScheme !== 'auto' || explicitBackground) {
    return `${BOOT_SCOPE}{background-color:${backgroundColor};color-scheme:${scheme}}`
  }
  return (
    `${BOOT_SCOPE}{background-color:${themeColor.light};color-scheme:${scheme}}` +
    `@media(prefers-color-scheme:dark){${BOOT_SCOPE}{background-color:${themeColor.dark}}}`
  )
}

// ── The encoding declaration ──────────────────────────────────────────────────────────────────

/** `<meta charset="…">`, with the value in group 1/2/3 depending on the quoting style. */
const CHARSET_META_RE =
  /[ \t]*<meta\s+charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=]+))\s*\/?>[ \t]*\r?\n?/i
/** The legacy `<meta http-equiv="Content-Type" charset=…>` form — left verbatim, never rewritten. */
const HTTP_EQUIV_CHARSET_RE = /<meta\s[^>]*http-equiv\s*=\s*["']?content-type["']?[^>]*>/i
const DEFAULT_CHARSET = 'UTF-8'

/**
 * Hoists the shell's encoding declaration ahead of everything this plugin injects.
 *
 * Every tag here defaults to `injectTo: 'head-prepend'`, which lands it immediately after `<head>`
 * and therefore AHEAD of the consumer's own `<meta charset>`. On a realistic shell that pushed the
 * declaration to byte 1653 — past the 1024-byte window the HTML spec gives it — and there is no
 * consumer-side fix, because the plugin owns the injection point. So the plugin owns the hoist too:
 * the consumer's tag is removed from the html and re-emitted as this plugin's FIRST head-prepend
 * tag. A shell that declares no encoding at all gets `UTF-8`.
 *
 * The legacy `http-equiv` form is detected and left completely alone — rewriting a consumer's
 * markup into a different (if equivalent) tag is not this plugin's business.
 */
function hoistCharset(html: string): { html: string; tag: HtmlTagDescriptor | undefined } {
  if (HTTP_EQUIV_CHARSET_RE.test(html)) return { html, tag: undefined }

  const match = CHARSET_META_RE.exec(html)
  const charset = match?.[1] ?? match?.[2] ?? match?.[3] ?? DEFAULT_CHARSET
  return {
    html: match ? html.replace(CHARSET_META_RE, '') : html,
    tag: { tag: 'meta', attrs: { charset } },
  }
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
  bootStyle: string
  icons: ResolvedIcons
  darkreader: 'lock' | false
  manifestEnabled: boolean
  base: string
  manifestHref: string
}): HtmlTagDescriptor[] {
  const {
    options,
    shortName,
    themeColor,
    bootStyle,
    icons,
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

  // Anti-FOUC — paints the boot surface before any stylesheet loads. injectTo defaults to
  // 'head-prepend', so this (and every tag below) lands immediately after <head> and the hoisted
  // <meta charset>, ahead of the consumer's own <link rel="stylesheet"> tags. Scoped to
  // BOOT_SCOPE so it expires the moment Mantine resolves the real scheme — see buildBootStyle.
  tags.push({ tag: 'style', children: bootStyle })

  if (icons.mode === 'default') {
    tags.push(
      {
        tag: 'link',
        attrs: {
          rel: 'shortcut icon',
          href: withBase(base, withIconPath(icons.dir, ICON_FILES.favicon)),
        },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'icon',
          type: 'image/svg+xml',
          href: withBase(base, withIconPath(icons.dir, ICON_FILES.svg)),
        },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'icon',
          sizes: '96x96',
          href: withBase(base, withIconPath(icons.dir, ICON_FILES.png96)),
        },
      },
      {
        tag: 'link',
        attrs: {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: withBase(base, withIconPath(icons.dir, ICON_FILES.appleTouch)),
        },
      },
    )
  }

  // A consumer-named icon reaches the head only when it asks to, so the plugin can fix a manifest
  // without duplicating a `<link>` the app's own index.html already writes.
  if (icons.mode === 'explicit') {
    for (const icon of icons.icons) {
      if (icon.rel === undefined) continue
      tags.push({
        tag: 'link',
        attrs: {
          rel: icon.rel,
          ...(icon.type === undefined ? {} : { type: icon.type }),
          ...(icon.sizes === undefined ? {} : { sizes: icon.sizes }),
          href: iconHref(base, icon.src),
        },
      })
    }
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

/** The manifest's `icons` member, or nothing at all — never an empty array. */
function manifestIcons(
  icons: ResolvedIcons,
  base: string,
): { icons?: ReadonlyArray<Record<string, string>> } {
  if (icons.mode === 'none') return {}
  if (icons.mode === 'default') {
    return {
      icons: [
        {
          src: withBase(base, withIconPath(icons.dir, ICON_FILES.manifest192)),
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: withBase(base, withIconPath(icons.dir, ICON_FILES.manifest512)),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    }
  }
  return {
    icons: icons.icons.map((icon) => ({
      src: iconHref(base, icon.src),
      ...(icon.sizes === undefined ? {} : { sizes: icon.sizes }),
      ...(icon.type === undefined ? {} : { type: icon.type }),
      ...(icon.purpose === undefined ? {} : { purpose: icon.purpose }),
    })),
  }
}

function buildManifestJson(input: {
  options: BasaltAppOptions
  shortName: string
  startUrl: string
  scope: string
  id: string
  display: NonNullable<BasaltAppOptions['display']>
  schemeColor: string
  backgroundColor: string
  icons: ResolvedIcons
  base: string
}): string {
  const {
    options,
    shortName,
    startUrl,
    scope,
    id,
    display,
    schemeColor,
    backgroundColor,
    icons,
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
    // A manifest carries ONE theme color, so it follows the boot scheme rather than the dual
    // `<meta name="theme-color">` pair. Unchanged for the default (`'dark'`) and for `'auto'`.
    theme_color: schemeColor,
    background_color: backgroundColor,
    // `icons: false` reaches HERE too, not just the head links. The array was unconditional, so
    // `{ manifest: true, icons: false }` shipped a manifest pointing at two PNGs the app never
    // ships — an installable app with broken icons, and the reason rb went hybrid (plugin for the
    // head, a hand-written manifest for the rest). A manifest with NO icons member is valid.
    // The `'explicit'` arm is the other half of that fix: honest about icons it cannot see was
    // only worth having once a consumer could tell it which icons it DOES have.
    ...manifestIcons(icons, base),
  }
  return JSON.stringify(manifest, null, 2)
}

function createMainPlugin(options: BasaltAppOptions): Plugin {
  const shortName = options.shortName ?? options.name
  const display = options.display ?? 'standalone'
  const darkreader = options.darkreader ?? 'lock'
  const icons = resolveIcons(options.icons)
  const manifestEnabled = options.manifest !== false

  const themeColor = resolveThemeColors(options.themeColor)
  // The boot scheme picks which half of the pair is "the" single color (manifest theme_color, the
  // default paint). `'auto'` and `false` keep the historical dark default.
  const colorScheme = options.colorScheme ?? 'dark'
  const schemeColor = colorScheme === 'light' ? themeColor.light : themeColor.dark
  const backgroundColor = options.backgroundColor ?? schemeColor
  const bootStyle = buildBootStyle({
    colorScheme,
    themeColor,
    backgroundColor,
    explicitBackground: options.backgroundColor !== undefined,
  })

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
        schemeColor,
        backgroundColor,
        icons,
        base,
      })

      staticTags = buildStaticTags({
        options,
        shortName,
        themeColor,
        bootStyle,
        icons,
        darkreader,
        manifestEnabled,
        base,
        manifestHref,
      })
    },
    transformIndexHtml: {
      // `pre` so this plugin's tags are the FIRST head-prepend contributions Vite collects — that
      // ordering is what puts the hoisted <meta charset> at the very top of <head> rather than
      // behind another plugin's tags. Vite injects all collected tags after every hook has run.
      order: 'pre',
      handler(html) {
        const hoisted = hoistCharset(html)
        const tags = [
          ...(hoisted.tag ? [hoisted.tag] : []),
          ...(hasViewportMeta(html) ? [] : [VIEWPORT_TAG]),
          ...staticTags,
        ]
        return { html: hoisted.html, tags }
      },
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
 * Two behaviours worth knowing before adopting it, both of which the plugin owns because the
 * consumer cannot reach them:
 *  • It HOISTS the shell's `<meta charset>` ahead of everything it injects, so the encoding
 *    declaration stays inside the spec's first 1024 bytes (see `hoistCharset`).
 *  • The anti-FOUC `<style>` expires the moment Mantine resolves the real scheme, and `colorScheme`
 *    selects which surface it paints until then (see `BOOT_SCOPE` / `buildBootStyle`).
 *
 * @example
 * // vite.config.ts
 * import { basaltAppPlugin, basaltViteConfig } from 'basalt-ui/vite'
 *
 * export default {
 *   ...basaltViteConfig({ port: 5173 }),
 *   // colorScheme mirrors <BasaltProvider defaultColorScheme> — omit it for the dark default.
 *   plugins: [react(), ...basaltAppPlugin({ name: 'Argo', colorScheme: 'auto' })],
 * }
 */
export function basaltAppPlugin(options: BasaltAppOptions): PluginOption[] {
  const plugins: PluginOption[] = [createMainPlugin(options)]
  if (options.serviceWorker) {
    plugins.push(createServiceWorkerPlugin(options.serviceWorker))
  }
  return plugins
}
