/**
 * Proves the page types of the site profile on dist-site/ (`bun run build:site` makes it): every page, at
 * 1440 and 390 px in the light and the dark scheme, never scrolls sideways and passes axe; a page of the four
 * static types also loads with no module script and no island, and an article's code follows the scheme. A
 * picture of each view is kept.
 *
 * Every guide and the showcase page also hold a layout shift of 0: the page is loaded in a viewport as tall
 * as itself (so every part is in view and every island hydrates at once, the worst case), with its scripts
 * held back so the static picture paints first, and the shift is read once the islands are in. The numbers
 * are written to `.astro-matrix/site-pages.md`, which CI keeps with the matrix.
 *
 *   bun scripts/site-pages.ts [--shots <dir>]
 *
 * Exits 1 with every failure listed. `make astro-matrix-run` runs it after the matrix.
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
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

/** The page types and the route that proves each: none of them loads a script. */
const TYPES = {
  guide: '/guides/setup/',
  article: '/posts/color-follows-the-scheme/',
  'post-list': '/posts/',
  changelog: '/changelog/',
} as const

/** Pages that carry islands on purpose: they keep the view checks, not the no-script ones. */
const SCRIPTED = {
  'guide-islands': '/guides/islands/',
  showcase: '/showcase/',
} as const

/** How long the page's scripts are held back, so the static picture is painted before any island arrives. */
const HOLD_MS = 1500
/** The viewport height of a layout-shift run: tall enough that every shift on the page is in view. */
const TALL = 6000
/**
 * Layout shift below this is sub-pixel rounding of text and fonts on a page this tall (a one-pixel move of the whole page reads
 * about 0.0002; the chart jump this gate was written for read 0.0005 to 0.001 beside it), never a part arriving.
 */
const NOISE = 0.0001

/** Every route that must hold a layout shift of 0: each guide, the showcase and the four static types. */
async function shiftRoutes(): Promise<string[]> {
  const guides = (await readdir(join(DIST, 'guides'))).map((name) => `/guides/${name}/`)
  return [...new Set([...guides, ...Object.values(SCRIPTED), ...Object.values(TYPES)])].toSorted()
}

type Shift = { route: string; cls: Record<string, number>; islands: number }

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
const shifts: Shift[] = []
const fail = (where: string, what: string): number => failures.push(`${where}: ${what}`)

/** The color of the first token Shiki colored (it carries both themes' colors as custom properties) in the page's first code block. */
const tokenColor = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const span = document.querySelector('pre.astro-code span[style*="--shiki-"]')
    return span === null ? null : getComputedStyle(span).color
  })

/** The layout shift of each route, per view, with its scripts held back (see the header). */
async function measureShifts(browser: Browser, base: string): Promise<Shift[]> {
  const out: Shift[] = []
  for (const route of await shiftRoutes()) {
    const html = await fetch(base + route).then((r) => r.text())
    const cls: Record<string, number> = {}
    for (const width of VIEWS) {
      for (const scheme of SCHEMES) {
        const where = `${route} at ${width} ${scheme}`
        const context = await browser.newContext({
          viewport: { width, height: TALL },
          colorScheme: scheme,
          reducedMotion: 'reduce',
        })
        const page = await context.newPage()
        await page.addInitScript(() => {
          const w = window as unknown as { __cls: number; __from: number }
          w.__cls = 0
          w.__from = Number.POSITIVE_INFINITY
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as {
              value: number
              hadRecentInput: boolean
              startTime: number
            }[])
              if (!e.hadRecentInput && e.startTime >= w.__from) w.__cls += e.value
          }).observe({ type: 'layout-shift', buffered: true })
        })
        await page.route(/\.js(\?|$)/, async (request) => {
          await new Promise((resolve) => setTimeout(resolve, HOLD_MS))
          await request.continue()
        })
        await page.goto(base + route, { waitUntil: 'load' })
        // A face that swaps in late moves text on a slow host whatever a page does; a shift counts from the moment the faces are in, which is before any held island arrives.
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all([...document.fonts].map((face) => face.load().catch(() => null)))
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
          ;(window as unknown as { __from: number }).__from = performance.now()
        })
        // Every island has hydrated and every chart has measured its box once the page is quiet.
        await page.waitForTimeout(HOLD_MS + 1500)
        const measured = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
        const value = measured < NOISE ? 0 : measured
        cls[`${width} ${scheme}`] = value
        if (value > 0) fail(where, `layout shift ${value}: a part moved the page when it arrived`)
        await context.close()
      }
    }
    out.push({ route, cls, islands: (html.match(/<astro-island/g) ?? []).length })
  }
  return out
}

async function writeShifts(): Promise<void> {
  const views = VIEWS.flatMap((w) => SCHEMES.map((s) => `${w} ${s}`))
  const lines = [
    '# Site pages: layout shift',
    '',
    `Each route loaded in a ${TALL} px tall viewport (every part in view, every island hydrating at once) with its scripts held back ${HOLD_MS} ms, so the static picture paints first. A shift is read after the islands are in; the gate is 0.`,
    '',
    `| Route | Islands | ${views.join(' | ')} |`,
    `|-|-|${views.map(() => '-').join('|')}|`,
    ...shifts.map(
      (s) => `| ${s.route} | ${s.islands} | ${views.map((v) => String(s.cls[v])).join(' | ')} |`,
    ),
    '',
  ]
  await writeFile(join(values.shots, '..', 'site-pages.md'), lines.join('\n'))
}

async function main(): Promise<void> {
  if (!(await exists(DIST))) throw new Error('dist-site/ is missing: run bun run build:site first')
  await mkdir(values.shots, { recursive: true })
  const server = serve()
  const base = `http://localhost:${server.port}`
  const browser = await chromium.launch(testBrowserOptions(readTestBrowser()))
  try {
    for (const [type, route] of [...Object.entries(TYPES), ...Object.entries(SCRIPTED)]) {
      const html = await fetch(base + route).then((r) => r.text())
      const scripted = Object.values(SCRIPTED).includes(route as never)
      if (scripted) {
        if (!/<astro-island/.test(html)) fail(route, 'a page marked scripted carries no island')
      } else {
        if (/<script[^>]*type="module"/.test(html)) fail(route, 'a module script on a static page')
        if (/<astro-island/.test(html)) fail(route, 'an island on a static page')
        if (/<script[^>]*\ssrc=/.test(html)) fail(route, 'an external script on a static page')
      }
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
    shifts.push(...(await measureShifts(browser, base)))
  } finally {
    await browser.close()
    void server.stop()
  }
  await writeShifts()
  const pages = (await readdir(values.shots)).length
  if (failures.length > 0) {
    console.error(
      `site-pages: ${failures.length} failure(s)\n${failures.map((f) => `  - ${f}`).join('\n')}`,
    )
    process.exit(1)
  }
  console.log(
    `site-pages: ${Object.keys(TYPES).length + Object.keys(SCRIPTED).length} page types, ${pages} views, no script on the static types, axe clean, code follows the scheme, layout shift 0 on ${shifts.length} routes`,
  )
}

await main()
