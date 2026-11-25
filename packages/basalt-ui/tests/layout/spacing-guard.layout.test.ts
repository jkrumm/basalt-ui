/**
 * The spacing guard (owner review 3, Issue 3304): real geometry over every tour page of the built playground at
 * 1800 and 390, measured with classic scrollbars (11 px, taking layout room) by `spacing-guard/geometry.ts`.
 *
 * - `inset`: a surface and a scroll region inside it leave the same distance to the edge left and right,
 *   scrollbar included (`scrollbar-gutter: stable both-edges` is how a scroller with inset content does it);
 * - `under-bar`: nothing is drawn over a visible scrollbar;
 * - `row-top`: siblings in a row share their top edge;
 * - `gap`: a declared gap is a rung of the spacing ladder, and one stack keeps one gap;
 * - `edge`: a framed child and a plain sibling in one stack start on one edge or an indent (8 px or more) apart.
 *
 * Tolerance 1 px. The tour pages are the nav's `tour` section, read from `nav-model.tsx`, so a new stop is
 * measured with no edit here. Each rule has a seeded offender below that it must fail, and a clean twin it must pass.
 * `apps/playground/dist` is built by `make check` and CI before the layout suite.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chromium } from 'playwright-core'
import type { Browser } from 'playwright-core'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { readTestBrowser, testBrowserOptions } from '../support/test-browser'
import { PHONE } from './harness'
import type { Viewport } from './harness'
import { CLASSIC_SCROLLBARS, geometryFindings } from './spacing-guard/geometry'
import type { GeometryFinding } from './spacing-guard/geometry'

const layout = describe

const TOLERANCE = 1
const DESKTOP: Viewport = { name: 'wide desktop', width: 1800, height: 1200 }
const APP = resolve(import.meta.dir, '../../../../apps/playground')
const dist = join(APP, 'dist')

/** The tour's routes: each `to` of the nav model's tour section, a `$id` filled from its `params`. */
function tourRoutes(): string[] {
  const source = readFileSync(join(APP, 'src/demo/nav-model.tsx'), 'utf8')
  const tour = source.slice(source.indexOf("id: 'tour'"), source.indexOf("id: 'reference'"))
  const routes = [...tour.matchAll(/to: '([^']+)'(?:, params: \{ (\w+): '([^']+)' \})?/g)].map(
    (m) => (m[2] === undefined ? m[1]! : m[1]!.replace(`$${m[2]}`, m[3]!)),
  )
  if (routes.length < 10)
    throw new Error(`spacing-guard: read ${routes.length} tour routes from nav-model.tsx`)
  return routes
}

let server: ReturnType<typeof Bun.serve> | null = null
/**
 * Its own browser: the harness's launch passes Playwright's default `--hide-scrollbars`, which removes the
 * bar this suite measures.
 */
let browser: Browser | null = null
const BUILD_BUDGET_MS = 360_000
beforeAll(async () => {
  browser = await chromium.launch({
    ...testBrowserOptions(readTestBrowser()),
    ignoreDefaultArgs: ['--hide-scrollbars'],
  })
  if (!existsSync(join(dist, 'index.html'))) {
    const build = Bun.spawnSync(['bun', '--filter', '@basalt-ui/playground', 'build'], {
      cwd: resolve(APP, '../..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (build.exitCode !== 0)
      throw new Error(`spacing-guard: the playground did not build:\n${build.stderr.toString()}`)
  }
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname)
      const target = resolve(dist, `.${path}`)
      if (target !== dist && !target.startsWith(dist + sep))
        return new Response('', { status: 404 })
      const asset = Bun.file(target)
      if (path !== '/' && (await asset.exists())) return new Response(asset)
      if (/\.[a-z0-9]+$/i.test(path)) return new Response('', { status: 404 })
      return new Response(Bun.file(join(dist, 'index.html')), {
        headers: { 'content-type': 'text/html' },
      })
    },
  })
}, BUILD_BUDGET_MS)
afterAll(async () => {
  server?.stop(true)
  await browser?.close()
}, 30_000)

const lines = (found: readonly GeometryFinding[]): string =>
  found.map((f) => `${f.kind}: ${f.where}: ${f.detail}`).join('\n')

/** Opens `url` (or sets `html`), puts classic scrollbars on it, waits for the DOM to go quiet and reads the findings. */
async function measure(
  viewport: Viewport,
  pointer: 'fine' | 'coarse',
  target: { url: string } | { html: string },
): Promise<GeometryFinding[]> {
  const context = await browser!.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: pointer === 'coarse',
    hasTouch: pointer === 'coarse',
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    if ('url' in target) await page.goto(target.url)
    else await page.setContent(target.html)
    await page.addStyleTag({ content: CLASSIC_SCROLLBARS })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          let timer = setTimeout(finish, 250)
          const ceiling = setTimeout(finish, 4000)
          const observer = new MutationObserver(() => {
            clearTimeout(timer)
            timer = setTimeout(finish, 250)
          })
          function finish(): void {
            observer.disconnect()
            clearTimeout(timer)
            clearTimeout(ceiling)
            requestAnimationFrame(() => requestAnimationFrame(() => done()))
          }
          observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
          })
        }),
    )
    return await page.evaluate(geometryFindings, { tolerance: TOLERANCE })
  } finally {
    await context.close()
  }
}

layout('the spacing guard over the tour pages', () => {
  // A narrow window with a mouse draws classic bars; a phone's are overlay bars, so it has no room to lose.
  const CONFIGS: readonly { viewport: Viewport; pointer: 'fine' | 'coarse' }[] = [
    { viewport: DESKTOP, pointer: 'fine' },
    { viewport: { ...PHONE, name: 'narrow window' }, pointer: 'fine' },
    { viewport: PHONE, pointer: 'coarse' },
  ]
  for (const { viewport, pointer } of CONFIGS) {
    describe(`${viewport.name} ${viewport.width} (${pointer})`, () => {
      for (const route of tourRoutes()) {
        test(`${route}: no spacing finding`, async () => {
          const found = await measure(viewport, pointer, { url: new URL(route, server!.url).href })
          expect(found.length, lines(found)).toBe(0)
        })
      }
    })
  }
})

/** A page whose `page-main` holds `body`: the root the guard reads. */
const doc = (body: string): string =>
  `<!doctype html><html><head><style>body{margin:0;font:14px/20px sans-serif}*{box-sizing:border-box}</style></head><body><div data-slot="page-main" style="width:760px;padding:16px">${body}</div></body></html>`

async function offend(body: string): Promise<GeometryFinding[]> {
  return measure(DESKTOP, 'fine', { html: doc(body) })
}

const COLUMN = (list: string): string =>
  `<section style="width:300px;padding:10px;background:#eee;border-radius:8px"><div style="max-height:120px;overflow-y:auto;${list}"><div style="height:400px;background:#ccc"></div></div></section>`

layout('the spacing guard fails what it must', () => {
  test('a column whose scrollbar eats its right inset', async () => {
    const found = await offend(COLUMN(''))
    expect(found.map((f) => f.kind)).toContain('inset')
    expect(lines(found)).toMatch(
      /10 px from the left edge[\s\S]*21 px from the right \(scrollbar 11\)/,
    )
  })

  test('the same column with its gutter on both edges is clean', async () => {
    const found = await offend(COLUMN('scrollbar-gutter:stable both-edges'))
    expect(found.map((f) => f.kind)).not.toContain('inset')
  })

  test('a surface padded unevenly', async () => {
    const found = await offend(
      '<div style="width:300px;padding:10px 4px 10px 12px;background:#eee;border-radius:8px"><p style="margin:0">Text</p></div>',
    )
    expect(lines(found)).toMatch(/inset: .*left 12 px, right 4 px/)
  })

  test('a node drawn over the scrollbar', async () => {
    const found = await offend(
      '<section style="position:relative;width:300px;padding:10px;background:#eee;border-radius:8px">' +
        '<div style="max-height:120px;overflow-y:auto;scrollbar-gutter:stable both-edges"><div style="height:400px;background:#ccc"></div></div>' +
        '<i style="position:absolute;left:268px;top:10px;width:22px;height:120px;background:red"></i></section>',
    )
    expect(found.map((f) => f.kind)).toContain('under-bar')
  })

  test('a scrollbar for two pixels of overflow', async () => {
    const found = await offend(
      '<div style="width:300px;height:100px;overflow-y:auto;background:#eee"><div style="height:102px"></div></div>',
    )
    expect(lines(found)).toMatch(
      /stray-bar: .*draws a 11 px vertical scrollbar for 2 px of overflow/,
    )
  })

  test('an always-on scrollbar with nothing to scroll', async () => {
    const found = await offend(
      '<div style="width:300px;height:100px;overflow-y:scroll;background:#eee"><div style="height:60px"></div></div>',
    )
    expect(lines(found)).toMatch(/stray-bar: .*for 0 px of overflow/)
  })

  test('a reserved gutter with no overflow draws no stray bar', async () => {
    const found = await offend(
      '<div style="width:300px;height:100px;overflow-y:auto;scrollbar-gutter:stable;background:#eee"><div style="height:60px"></div></div>',
    )
    expect(found.map((f) => f.kind)).not.toContain('stray-bar')
  })

  test('siblings in a row that start apart', async () => {
    const found = await offend(
      '<div style="display:flex;align-items:flex-start;gap:8px"><div style="height:40px;width:100px;background:#ccc"></div><div style="height:40px;width:100px;margin-top:4px;background:#ccc"></div></div>',
    )
    expect(lines(found)).toMatch(/row-top: .*siblings start 4 px apart/)
  })

  test('a gap off the ladder', async () => {
    const found = await offend(
      '<div style="display:flex;gap:11px"><div style="height:40px;width:100px;background:#ccc"></div><div style="height:40px;width:100px;background:#ccc"></div></div>',
    )
    expect(lines(found)).toMatch(/gap: .*gap 11 px is off the ladder/)
  })

  test('a header 4 px off the edge of the cards under it', async () => {
    const found = await offend(
      '<div style="width:300px;padding:10px;background:#eee;border-radius:8px"><div style="padding:0 4px;height:36px">Title</div><div style="height:60px;background:#fff;border:1px solid #bbb;border-radius:6px"></div></div>',
    )
    expect(lines(found)).toMatch(/edge: .*do not share their left edge/)
  })

  test('a clean page passes every rule', async () => {
    const found = await offend(
      '<div style="width:300px;padding:10px;background:#eee;border-radius:8px;display:flex;flex-direction:column;gap:8px"><div style="height:36px">Title</div><div style="height:60px;background:#fff;border:1px solid #bbb;border-radius:6px"></div></div>',
    )
    expect(found).toEqual([])
  })
})
