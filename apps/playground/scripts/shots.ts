/**
 * Reproducible playground screenshots: `bun apps/playground/scripts/shots.ts <route>... [--out <dir>] [--dist <dir>]`.
 *
 * Run AFTER a playground build (`bun --filter @basalt-ui/playground build`). Serves `dist/` on an
 * ephemeral port with a single-page fallback, opens Google Chrome, and writes one PNG per route,
 * colour scheme and viewport to `.evidence/v3-shots/<route-slug>--<light|dark>--<WxH>.png`.
 *
 * The scheme is chosen by writing localStorage `basalt:scheme` BEFORE the document loads (an init
 * script), so the boot script paints the right scheme from the first frame and no toggle click is
 * involved. Chrome's lifecycle follows `tests/layout/harness/engine.ts`: `launchServer` + `connect`
 * with the `chrome` channel, ended with `BrowserServer.kill()` because a graceful close has been
 * observed to never resolve on this host. Nothing is downloaded.
 */
import { mkdir } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserServer } from 'playwright-core'

export type Scheme = 'light' | 'dark'
export type ShotViewport = { readonly width: number; readonly height: number }
export type Shot = { readonly scheme: Scheme; readonly viewport: ShotViewport }
export type ShotArgs = {
  readonly routes: readonly string[]
  readonly outDir: string
  readonly distDir: string
}

/** The localStorage key `basalt-ui`'s boot script and `setScheme` read (`core/scheme.ts`). */
export const SCHEME_KEY = 'basalt:scheme'
/** The key Mantine's own scheme manager reads — the 2.x routes still ignore `basalt:scheme`. */
export const LEGACY_SCHEME_KEY = 'mantine-color-scheme-value'

const DESKTOP: ShotViewport = { width: 1800, height: 1200 }
const PHONE: ShotViewport = { width: 390, height: 844 }

/** Every route is shot in this matrix: both schemes at the desktop and the phone size. */
export const SHOTS: readonly Shot[] = (['light', 'dark'] as const).flatMap((scheme) =>
  [DESKTOP, PHONE].map((viewport) => ({ scheme, viewport })),
)

const REPO_ROOT = resolve(import.meta.dir, '../../..')
const DEFAULT_OUT = join(REPO_ROOT, '.evidence/v3-shots')
const DEFAULT_DIST = resolve(import.meta.dir, '../dist')

export class UsageError extends Error {}

/** `/` -> `root`, `/scenarios/a.b` -> `scenarios-a-b`: lowercase, runs of non-alphanumerics -> `-`. */
export function routeSlug(route: string): string {
  const slug = route
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return slug === '' ? 'root' : slug
}

export function shotFileName(route: string, shot: Shot): string {
  const { scheme, viewport } = shot
  return `${routeSlug(route)}--${scheme}--${viewport.width}x${viewport.height}.png`
}

/** Every file a run writes, in write order. */
export function plannedFiles(routes: readonly string[]): string[] {
  return routes.flatMap((route) => SHOTS.map((shot) => shotFileName(route, shot)))
}

export function parseArgs(argv: readonly string[]): ShotArgs {
  const routes: string[] = []
  let outDir = DEFAULT_OUT
  let distDir = DEFAULT_DIST
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--out' || arg === '--dist') {
      const value = argv[++i]
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a path`)
      if (arg === '--out') outDir = resolve(value)
      else distDir = resolve(value)
    } else if (arg.startsWith('--')) {
      throw new UsageError(`unknown flag ${arg}`)
    } else if (arg.startsWith('/')) {
      routes.push(arg)
    } else {
      throw new UsageError(`route "${arg}" must start with "/"`)
    }
  }
  if (routes.length === 0) throw new UsageError('name at least one route, e.g. `/`')
  const slugs = new Set<string>()
  for (const route of routes) {
    const slug = routeSlug(route)
    if (slugs.has(slug)) throw new UsageError(`routes collide on the slug "${slug}"`)
    slugs.add(slug)
  }
  return { routes, outDir, distDir }
}

/** Serves `dist` with the SPA fallback; a path that escapes it is a 404, never a read. */
function serve(distDir: string): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname)
      const file = resolve(distDir, `.${path}`)
      if (file !== distDir && !file.startsWith(distDir + sep)) {
        return new Response('not found', { status: 404 })
      }
      const asset = Bun.file(file)
      if (path !== '/' && (await asset.exists())) return new Response(asset)
      // An asset-looking path that is missing is a real 404; everything else is a client route.
      if (/\.[a-z0-9]+$/i.test(path)) return new Response('not found', { status: 404 })
      return new Response(Bun.file(join(distDir, 'index.html')), {
        headers: { 'content-type': 'text/html' },
      })
    },
  })
}

async function launchChrome(): Promise<{ browser: Browser; process: BrowserServer }> {
  const chromeProcess = await chromium.launchServer({
    channel: 'chrome',
    chromiumSandbox: !process.env['CI'],
  })
  const browser = await chromium.connect(chromeProcess.wsEndpoint())
  return { browser, process: chromeProcess }
}

async function capture(args: ShotArgs): Promise<string[]> {
  if (!(await Bun.file(join(args.distDir, 'index.html')).exists())) {
    throw new UsageError(
      `no build at ${args.distDir} — run \`bun --filter @basalt-ui/playground build\` first`,
    )
  }
  await mkdir(args.outDir, { recursive: true })
  const server = serve(args.distDir)
  const chrome = await launchChrome()
  const written: string[] = []
  try {
    for (const shot of SHOTS) {
      const context = await chrome.browser.newContext({
        viewport: shot.viewport,
        colorScheme: shot.scheme,
        deviceScaleFactor: 1,
      })
      // Before any document script runs, so the boot script reads it on the first paint.
      await context.addInitScript(
        ({ keys, value }) => {
          for (const key of keys) window.localStorage.setItem(key, value)
        },
        { keys: [SCHEME_KEY, LEGACY_SCHEME_KEY], value: shot.scheme },
      )
      try {
        for (const route of args.routes) {
          const page = await context.newPage()
          await page.goto(new URL(route, server.url).href, { waitUntil: 'networkidle' })
          await page.evaluate(() => document.fonts.ready.then(() => undefined))
          // Two frames: let the router commit and the layout settle before the pixels are read.
          await page.evaluate(
            () =>
              new Promise<void>((done) =>
                requestAnimationFrame(() => requestAnimationFrame(() => done())),
              ),
          )
          const file = join(args.outDir, shotFileName(route, shot))
          await page.screenshot({ path: file })
          written.push(file)
          await page.close()
        }
      } finally {
        await context.close()
      }
    }
  } finally {
    chrome.process.kill()
    server.stop(true)
  }
  return written
}

if (import.meta.main) {
  try {
    const files = await capture(parseArgs(Bun.argv.slice(2)))
    // oxlint-disable-next-line no-console -- the script's output is its list of files
    console.log(files.join('\n'))
  } catch (error) {
    // oxlint-disable-next-line no-console -- a CLI reports its failure on stderr
    console.error(error instanceof UsageError ? `shots: ${error.message}` : error)
    process.exit(1)
  }
}
