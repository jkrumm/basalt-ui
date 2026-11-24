/**
 * Proves the four page types of the site profile on dist-site/ (`bun run build:site` makes it): every page, at
 * 1440 and 390 px in the light and the dark scheme, loads with no module script and no island, never scrolls
 * sideways, passes axe, and an article's code follows the scheme. A picture of each view is kept.
 *
 *   bun scripts/site-pages.ts [--shots <dir>]
 *
 * Exits 1 with every failure listed. `make astro-matrix-run` runs it after the matrix.
 */
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'
import { quality } from 'basalt-ui/testing'
import {
  readTestBrowser,
  testBrowserOptions,
} from '../../../packages/basalt-ui/tests/support/test-browser'

const ROOT = join(import.meta.dir, '..')
const DIST = join(ROOT, 'dist-site')
const { values } = parseArgs({
  options: { shots: { type: 'string', default: join(ROOT, '.astro-matrix/site-shots') } },
})

/** The page types and the route that proves each. */
const TYPES = {
  guide: '/guides/setup/',
  article: '/posts/color-follows-the-scheme/',
  'post-list': '/posts/',
  changelog: '/changelog/',
} as const

const VIEWS = [1440, 390] as const
const SCHEMES = ['light', 'dark'] as const

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

function serve(): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: 0,
    async fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname)
      let file = join(DIST, path)
      if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 })
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html')
      const body = await readFile(file).catch(() => null)
      if (!body) return new Response('not found', { status: 404 })
      return new Response(body, {
        headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' },
      })
    },
  })
}

const failures: string[] = []
const fail = (where: string, what: string): number => failures.push(`${where}: ${what}`)

/** The color of the first token Shiki colored (it carries both themes' colors as custom properties) in the page's first code block. */
const tokenColor = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const span = document.querySelector('pre.astro-code span[style*="--shiki-"]')
    return span === null ? null : getComputedStyle(span).color
  })

async function main(): Promise<void> {
  if (!(await exists(DIST))) throw new Error('dist-site/ is missing: run bun run build:site first')
  await mkdir(values.shots, { recursive: true })
  const server = serve()
  const base = `http://localhost:${server.port}`
  const browser = await chromium.launch(testBrowserOptions(readTestBrowser()))
  try {
    for (const [type, route] of Object.entries(TYPES)) {
      const html = await fetch(base + route).then((r) => r.text())
      if (/<script[^>]*type="module"/.test(html)) fail(route, 'a module script on a static page')
      if (/<astro-island/.test(html)) fail(route, 'an island on a static page')
      if (/<script[^>]*\ssrc=/.test(html)) fail(route, 'an external script on a static page')
      for (const width of VIEWS) {
        for (const scheme of SCHEMES) {
          const where = `${type} ${route} at ${width} ${scheme}`
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
          })
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(e.message))
          page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
          await page.goto(base + route, { waitUntil: 'load' })
          await page.evaluate(() => document.fonts.ready)
          const shot = `${type}-${width}-${scheme}.png`
          await page.screenshot({ path: join(values.shots, shot), fullPage: true })
          if (errors.length > 0) fail(where, `console errors: ${errors.join('; ')}`)
          try {
            await quality.axe(page)
          } catch (e) {
            fail(where, (e as Error).message)
          }
          const wide = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          if (wide > 0) fail(where, `the document scrolls sideways by ${wide} px`)
          await context.close()
        }
      }
    }
    // The article's code follows the scheme: the system scheme and an explicit attribute both pick the dark color.
    const colors: Record<string, string | null> = {}
    for (const [name, scheme, attribute] of [
      ['light', 'light', null],
      ['dark', 'dark', null],
      ['attribute', 'light', 'dark'],
    ] as const) {
      const context = await browser.newContext({ colorScheme: scheme })
      const page = await context.newPage()
      await page.goto(base + TYPES.article, { waitUntil: 'load' })
      if (attribute !== null)
        await page.evaluate(
          (a) => document.documentElement.setAttribute('data-theme', a),
          attribute,
        )
      colors[name] = await tokenColor(page)
      await context.close()
    }
    if (colors['light'] === null) fail(TYPES.article, 'no highlighted code on the article')
    if (colors['light'] === colors['dark'])
      fail(TYPES.article, 'code color ignores the system scheme')
    if (colors['attribute'] !== colors['dark']) fail(TYPES.article, 'code color ignores data-theme')
  } finally {
    await browser.close()
    void server.stop()
  }
  const pages = (await readdir(values.shots)).length
  if (failures.length > 0) {
    console.error(
      `site-pages: ${failures.length} failure(s)\n${failures.map((f) => `  - ${f}`).join('\n')}`,
    )
    process.exit(1)
  }
  console.log(
    `site-pages: ${Object.keys(TYPES).length} page types, ${pages} views, no script, axe clean, code follows the scheme`,
  )
}

await main()
