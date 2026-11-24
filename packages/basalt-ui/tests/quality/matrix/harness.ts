/**
 * The matrix harness (quality-contract section 4): bundles the playground and the expression app (`build-app.ts`,
 * each in a child process), serves each output from its own ephemeral port (the playground's with the seeded
 * offenders), drives real Chrome. No dev server is started and no Vite process runs. The package resolves through its built
 * `dist` (`make check` builds first), which is the surface a consumer imports.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, BrowserServer, Page } from 'playwright-core'
import { themeScript } from '../../../src/css/theme-script'
import { readTestBrowser, testBrowserOptions } from '../../support/test-browser'
import type { MatrixApp } from './routes'

const OFFENDERS = resolve(import.meta.dirname, 'offenders')

/** The pre-paint script is in the head as `basaltAppPlugin` puts it in a consumer's document. */
const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <title>Basalt UI playground (quality matrix)</title>
    <script>${themeScript()}</script>
    <link rel="stylesheet" href="/main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

const BUILD = join(import.meta.dirname, 'build-app.ts')

/** Bundles an app in a child process, so the bundler's memory is back with the host before Chrome starts. */
async function buildApp(app: MatrixApp, outdir: string, pseudo: boolean): Promise<void> {
  const child = Bun.spawn([process.execPath, BUILD, app, outdir, ...(pseudo ? ['pseudo'] : [])], {
    stdout: 'ignore',
    stderr: 'pipe',
  })
  const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited])
  if (code !== 0) throw new Error(`matrix: the ${app} build failed (exit ${code}):\n${stderr}`)
}

export type MatrixHarness = {
  /** `http://127.0.0.1:<port>`: the app's English bundle. */
  origin(app: MatrixApp): string
  /** `http://localhost:<port>`: the same app with the pseudo-locale catalog. */
  pseudoOrigin(app: MatrixApp): string
  offenderUrl(name: string): string
  /** A fresh context + page. Closed by {@link MatrixHarness.close}. */
  open(options: PageOptions): Promise<Page>
  close(): Promise<void>
}

export type PageOptions = {
  width: number
  height: number
  /** Default `reduce`: the matrix grades the settled state. */
  reducedMotion?: 'reduce' | 'no-preference'
  /** `coarse` turns on touch emulation (`(pointer: coarse)`). Default `fine`. */
  pointer?: 'coarse' | 'fine'
  forcedColors?: 'active' | 'none'
  locale?: string
}

let shared: Promise<MatrixHarness | null> | undefined
let holders = 0

/**
 * Builds, serves and launches Chrome. Returns `null` (with a warning) when Chrome is missing locally; throws under CI.
 * The test files of one `bun test` process share one harness (one bundle pair, one Chrome, not one each); the last
 * `close()` of the holders shuts it down.
 */
export async function bootMatrix(): Promise<MatrixHarness | null> {
  shared ??= launchMatrix()
  holders += 1
  const harness = await shared
  if (harness === null) return null
  return {
    ...harness,
    async close() {
      holders -= 1
      if (holders > 0) return
      shared = undefined
      await harness.close()
    },
  }
}

async function launchMatrix(): Promise<MatrixHarness | null> {
  // Read first, outside any try: an invalid BASALT_TEST_BROWSER must fail the run (before anything is
  // created), not read as 'no browser installed'.
  const launchOptions = testBrowserOptions(readTestBrowser())
  const dir = await mkdtemp(join(tmpdir(), 'basalt-matrix-'))
  const apps: readonly MatrixApp[] = ['playground', 'expression']
  const servers = new Map<MatrixApp, ReturnType<typeof Bun.serve>>()
  for (const app of apps) {
    const appDir = join(dir, app)
    const pseudoDir = join(appDir, 'pseudo')
    await buildApp(app, appDir, false)
    await buildApp(app, pseudoDir, true)
    servers.set(
      app,
      Bun.serve({
        port: 0,
        async fetch(request) {
          const url = new URL(request.url)
          if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 })
          if (app === 'playground' && url.pathname.startsWith('/offenders/')) {
            const file = Bun.file(join(OFFENDERS, url.pathname.slice('/offenders/'.length)))
            if (!(await file.exists())) return new Response('no such offender', { status: 404 })
            return new Response(file, { headers: { 'content-type': 'text/html' } })
          }
          // `localhost` serves the pseudo-locale bundle, `127.0.0.1` the English one: same routes, same paths.
          const root = url.hostname === 'localhost' ? pseudoDir : appDir
          const asset = Bun.file(join(root, url.pathname))
          if (extname(url.pathname) !== '' && (await asset.exists())) {
            return new Response(asset, {
              headers: {
                'content-type': MIME[extname(url.pathname)] ?? 'application/octet-stream',
              },
            })
          }
          return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html' } })
        },
      }),
    )
  }
  const portOf = (app: MatrixApp): number => servers.get(app)?.port ?? 0
  const stopServers = (): void => {
    for (const server of servers.values()) server.stop(true)
  }

  let chromeProcess: BrowserServer
  let browser: Browser
  try {
    chromeProcess = await chromium.launchServer(launchOptions)
    browser = await chromium.connect(chromeProcess.wsEndpoint())
  } catch (error) {
    stopServers()
    await rm(dir, { recursive: true, force: true })
    if (process.env['CI']) {
      throw new Error(
        'FAILED: could not launch the test browser and CI is set (make browser-shell).',
        { cause: error },
      )
    }
    // oxlint-disable-next-line no-console -- a skipped gate must announce itself
    console.warn(
      `[matrix] SKIPPED: no test browser found, run \`make browser-shell\` (CI runs it regardless).\n${String(error)}`,
    )
    return null
  }

  // Under `bun test` the event loop was observed to wake for the Chrome socket only on its next timer
  // tick (every Playwright call took 1.0 s); a short interval keeps it awake.
  const keepAwake = setInterval(() => {}, 10)
  // A closed context leaves this set: holding all of them kept every page's Playwright objects alive for the run.
  const contexts = new Set<BrowserContext>()
  return {
    origin: (app) => `http://127.0.0.1:${portOf(app)}`,
    pseudoOrigin: (app) => `http://localhost:${portOf(app)}`,
    offenderUrl: (name) => `http://127.0.0.1:${portOf('playground')}/offenders/${name}.html`,
    async open(options) {
      const context = await browser.newContext({
        viewport: { width: options.width, height: options.height },
        reducedMotion: options.reducedMotion ?? 'reduce',
        forcedColors: options.forcedColors ?? 'none',
        hasTouch: options.pointer === 'coarse',
        isMobile: false,
        locale: options.locale ?? 'en-US',
        colorScheme: 'light',
      })
      contexts.add(context)
      context.once('close', () => contexts.delete(context))
      return context.newPage()
    },
    async close() {
      await Promise.all([...contexts].map((context) => context.close().catch(() => {})))
      await browser.close().catch(() => {})
      clearInterval(keepAwake)
      await chromeProcess.kill()
      stopServers()
      await rm(dir, { recursive: true, force: true })
    },
  }
}
