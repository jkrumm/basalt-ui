/**
 * The matrix harness (quality-contract section 4): bundles the playground with `Bun.build`, serves
 * the output plus the seeded offenders from one ephemeral port, drives real Chrome. No dev server is
 * started and no Vite process runs.
 *
 * `Bun.build` cannot run Tailwind or read `?inline`, so a build plugin does both for this one app:
 * `src/index.css` goes through the Tailwind CLI (the same compile the playground's Vite plugin does)
 * and `<css>?inline` becomes a string module. The package resolves through its built `dist`
 * (`make check` builds first), which is the surface a consumer imports.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, BrowserServer, Page } from 'playwright-core'
import { themeScript } from '../../../src/css/theme-script'
import { PLAYGROUND, REPO } from './routes'

const OFFENDERS = resolve(import.meta.dirname, 'offenders')
const TAILWIND = join(REPO, 'node_modules/.bin/tailwindcss')

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

function compileTailwind(entry: string): string {
  const result = Bun.spawnSync([TAILWIND, '--input', entry, '--output', '-'], {
    cwd: PLAYGROUND,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`matrix: Tailwind failed on ${entry}:\n${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

const PSEUDO_FORMAT = join(import.meta.dirname, 'pseudo-format.ts')

/** `pseudo` swaps the playground's `demo/page-format` for one that also carries the pseudo catalog. */
const playgroundPlugin = (pseudo: boolean): Bun.BunPlugin => ({
  name: 'playground-css',
  setup(build) {
    if (pseudo) {
      build.onResolve({ filter: /\/demo\/page-format$/ }, () => ({ path: PSEUDO_FORMAT }))
    }
    build.onResolve({ filter: /\?inline$/ }, (args) => {
      const bare = args.path.slice(0, -'?inline'.length)
      return {
        path: Bun.resolveSync(bare, args.importer ? resolve(args.importer, '..') : PLAYGROUND),
        namespace: 'inline-css',
      }
    })
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => ({
      contents: `export default ${JSON.stringify(await Bun.file(args.path).text())}`,
      loader: 'js',
    }))
    build.onLoad({ filter: /apps\/playground\/src\/index\.css$/ }, (args) => ({
      contents: compileTailwind(args.path),
      loader: 'css',
    }))
  },
})

/** Generates the (gitignored) route tree the playground imports, then bundles the app. */
async function buildPlayground(outdir: string, pseudo: boolean): Promise<void> {
  const generate = Bun.spawnSync([join(PLAYGROUND, 'node_modules/.bin/tsr'), 'generate'], {
    cwd: PLAYGROUND,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (generate.exitCode !== 0) {
    throw new Error(`matrix: tsr generate failed:\n${generate.stderr.toString()}`)
  }
  const build = await Bun.build({
    entrypoints: [join(PLAYGROUND, 'src/main.tsx')],
    outdir,
    naming: '[name].[ext]',
    target: 'browser',
    plugins: [playgroundPlugin(pseudo)],
    // basalt source reads `process.env["NODE_ENV"]` in bracket form, which only a whole-object
    // define matches (tests/layout/harness/engine.ts).
    define: {
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false, PROD: true }),
    },
  })
  if (!build.success) {
    throw new Error(`matrix: the playground did not bundle:\n${build.logs.map(String).join('\n')}`)
  }
}

export type MatrixHarness = {
  /** `http://127.0.0.1:<port>`: the English bundle. */
  origin: string
  /** `http://localhost:<port>`: the same app with the pseudo-locale catalog. */
  pseudoOrigin: string
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

/** Builds, serves and launches Chrome. Returns `null` (with a warning) when Chrome is missing locally; throws under CI. */
export async function bootMatrix(): Promise<MatrixHarness | null> {
  const dir = await mkdtemp(join(tmpdir(), 'basalt-matrix-'))
  const pseudoDir = join(dir, 'pseudo')
  await buildPlayground(dir, false)
  await buildPlayground(pseudoDir, true)

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 })
      if (url.pathname.startsWith('/offenders/')) {
        const file = Bun.file(join(OFFENDERS, url.pathname.slice('/offenders/'.length)))
        if (!(await file.exists())) return new Response('no such offender', { status: 404 })
        return new Response(file, { headers: { 'content-type': 'text/html' } })
      }
      // `localhost` serves the pseudo-locale bundle, `127.0.0.1` the English one: same routes, same paths.
      const root = url.hostname === 'localhost' ? pseudoDir : dir
      const asset = Bun.file(join(root, url.pathname))
      if (extname(url.pathname) !== '' && (await asset.exists())) {
        return new Response(asset, {
          headers: { 'content-type': MIME[extname(url.pathname)] ?? 'application/octet-stream' },
        })
      }
      return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html' } })
    },
  })

  let chromeProcess: BrowserServer
  let browser: Browser
  try {
    chromeProcess = await chromium.launchServer({
      channel: 'chrome',
      chromiumSandbox: !process.env['CI'],
    })
    browser = await chromium.connect(chromeProcess.wsEndpoint())
  } catch (error) {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
    if (process.env['CI']) {
      throw new Error('FAILED: could not launch Google Chrome and CI is set.', { cause: error })
    }
    // oxlint-disable-next-line no-console -- a skipped gate must announce itself
    console.warn('[matrix] SKIPPED: no Google Chrome found (CI runs it regardless).')
    return null
  }

  // Under `bun test` the event loop was observed to wake for the Chrome socket only on its next timer
  // tick (every Playwright call took 1.0 s); a short interval keeps it awake.
  const keepAwake = setInterval(() => {}, 10)
  const contexts: BrowserContext[] = []
  return {
    origin: `http://127.0.0.1:${server.port}`,
    pseudoOrigin: `http://localhost:${server.port}`,
    offenderUrl: (name) => `http://127.0.0.1:${server.port}/offenders/${name}.html`,
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
      contexts.push(context)
      return context.newPage()
    },
    async close() {
      await Promise.all(contexts.map((context) => context.close().catch(() => {})))
      await browser.close().catch(() => {})
      clearInterval(keepAwake)
      await chromeProcess.kill()
      server.stop(true)
      await rm(dir, { recursive: true, force: true })
    },
  }
}
