/**
 * The page top (owner review 1, docs/v3/issues/owner-1/v3-owner-1-page-top.json), measured on the
 * built playground in a real browser at 1800 and 390:
 *
 * - under `AppShell` a page with tabs or controls shows one rule between chrome and content: the
 *   header's rule gives way over main and the band's closes the bar;
 * - content starts one page gutter under the chrome's last rule, with a band (Tickets, Fleet
 *   overview) and without one (the title-only expression scenarios c12, n02, n27), so the distance
 *   is the same token on every page.
 *
 * It serves `apps/playground/dist` (the banded pages) and `apps/expression/dist` (the title-only scenarios), which
 * `make check` and CI build before the layout suite.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openDocument } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip
afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

type App = 'playground' | 'expression'
const APPS: readonly App[] = ['playground', 'expression']
const dist = (app: App): string => resolve(import.meta.dir, '../../../../apps', app, 'dist')
const DESKTOP_1800: Viewport = { name: 'wide desktop', width: 1800, height: 1200 }

const BANDED = ['/cycle/state-2', '/cycle/shell-5'] as const
const BANDLESS = ['/scenarios/expr-c12', '/scenarios/expr-n02', '/scenarios/expr-n27'] as const

const servers = new Map<App, ReturnType<typeof Bun.serve>>()

/** An app build takes about 20 s on a runner; the hook declares its own budget (Bun's default is 5 s). */
const BUILD_BUDGET_MS = 360_000

beforeAll(() => {
  for (const app of APPS) {
    const root = dist(app)
    // `make check` builds both apps before the layout suite; a CI layout shard builds only the package.
    if (!existsSync(join(root, 'index.html'))) {
      const build = Bun.spawnSync(['bun', '--filter', `@basalt-ui/${app}`, 'build'], {
        cwd: resolve(root, '../../..'),
        stdout: 'pipe',
        stderr: 'pipe',
      })
      if (build.exitCode !== 0 || !existsSync(join(root, 'index.html'))) {
        throw new Error(`page-top: the ${app} app did not build:\n${build.stderr.toString()}`)
      }
    }
    servers.set(
      app,
      Bun.serve({
        port: 0,
        async fetch(request) {
          const path = decodeURIComponent(new URL(request.url).pathname)
          const target = resolve(root, `.${path}`)
          if (target !== root && !target.startsWith(root + sep))
            return new Response('', { status: 404 })
          const asset = Bun.file(target)
          if (path !== '/' && (await asset.exists())) return new Response(asset)
          if (/\.[a-z0-9]+$/i.test(path)) return new Response('', { status: 404 })
          return new Response(Bun.file(join(root, 'index.html')), {
            headers: { 'content-type': 'text/html' },
          })
        },
      }),
    )
  }
}, BUILD_BUDGET_MS)

afterAll(() => {
  for (const server of servers.values()) server.stop(true)
})

/** The expression scenarios are served by the expression app, every other page by the playground. */
const serverOf = (route: string): URL => {
  const app: App = route.startsWith('/scenarios/expr-') ? 'expression' : 'playground'
  return servers.get(app)!.url
}

type Top = {
  /** The bottom edge of the chrome's last rule: the band's when there is one, else the header's. */
  chromeBottom: number
  firstContentTop: number
  gutter: number
  banded: boolean
  /** The width of the header's rule, and the rail's width it shrinks to under a band. */
  headerRule: number
  railWidth: number
  headerWidth: number
  bandRule: number
  /** The header's rule over the aside and dock columns, and those columns' width. */
  sideRule: number
  sideColumns: number
}

async function measure(viewport: Viewport, route: string, asideWidth?: number): Promise<Top> {
  const page: LayoutPage = await openDocument('<!doctype html><html><body></body></html>', viewport)
  await page.raw.goto(new URL(route, serverOf(route)).href)
  await page.raw.waitForSelector('[data-slot="page-main"] > :not([data-slot="page-bar"]):not(h1)')
  if (asideWidth !== undefined) {
    // The aside column's width is the grid's variable: widening it stands in for a docked aside.
    await page.raw.evaluate((w) => {
      document
        .querySelector<HTMLElement>('[data-slot="shell"]')
        ?.style.setProperty('--shell-aside-w', `${w}px`)
    }, asideWidth)
  }
  await page.raw.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.settle()
  return page.raw.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-slot="shell-header"]')
    const main = document.querySelector<HTMLElement>('[data-slot="page-main"]')
    if (header === null || main === null) throw new Error('LAYOUT: no shell header or page main')
    const band = main.querySelector<HTMLElement>(':scope > [data-slot="page-bar"]')
    const first = [...main.children].find(
      (el) =>
        el.getAttribute('data-slot') !== 'page-bar' &&
        el.tagName !== 'H1' &&
        el.getBoundingClientRect().height > 2,
    )
    if (first === undefined) throw new Error('LAYOUT: no content in the page')
    const rule = getComputedStyle(header, '::after')
    const shellMain = document.querySelector<HTMLElement>('[data-slot="shell-main"]')
    return {
      chromeBottom: (band ?? header).getBoundingClientRect().bottom,
      firstContentTop: first.getBoundingClientRect().top,
      gutter: parseFloat(getComputedStyle(main).paddingLeft),
      banded: band !== null,
      headerRule: rule.display === 'none' ? 0 : parseFloat(rule.width) || 0,
      // Main starts where the rail ends: its left edge is the rail's width.
      railWidth: shellMain === null ? 0 : shellMain.getBoundingClientRect().left,
      headerWidth: header.getBoundingClientRect().width,
      bandRule: band === null ? 0 : parseFloat(getComputedStyle(band).borderBottomWidth),
      sideRule: (() => {
        const side = getComputedStyle(header, '::before')
        return side.display === 'none' ? 0 : parseFloat(side.width) || 0
      })(),
      sideColumns: ['shell-aside', 'shell-dock']
        .map((s) => document.querySelector<HTMLElement>(`[data-slot="${s}"]`))
        .reduce((sum, el) => sum + (el?.getBoundingClientRect().width ?? 0), 0),
    }
  })
}

layout('the page top on the playground and the expression app', () => {
  for (const viewport of [DESKTOP_1800, PHONE]) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const route of BANDED) {
        test(`${route}: one rule between chrome and content, content one gutter under it`, async () => {
          const m = await measure(viewport, route)
          expect(m.banded, 'the page has a band').toBe(true)
          expect(m.bandRule, 'the band draws the one rule').toBe(1)
          expect(m.headerRule, "the header draws no rule over a band: the band's is the one").toBe(
            0,
          )
          expect(m.firstContentTop - m.chromeBottom).toBeCloseTo(m.gutter, 0)
        })
      }
      for (const route of BANDLESS) {
        test(`${route}: the header's rule, content one gutter under it`, async () => {
          const m = await measure(viewport, route)
          expect(m.banded, 'a title-only PageBar draws no band').toBe(false)
          expect(m.headerRule, "the header's rule spans the header").toBeCloseTo(m.headerWidth, 0)
          expect(m.firstContentTop - m.chromeBottom).toBeCloseTo(m.gutter, 0)
        })
      }

      test('with a band, the header keeps its rule over an aside column', async () => {
        const m = await measure(viewport, BANDED[0], 320)
        expect(m.banded).toBe(true)
        expect(m.sideColumns, 'the aside column took its width').toBeCloseTo(320, 0)
        expect(m.sideRule).toBeCloseTo(m.sideColumns, 0)
      })

      test('the distance from the chrome to the first content is one value on all five pages', async () => {
        const gaps: number[] = []
        for (const route of [...BANDED, ...BANDLESS]) {
          const m = await measure(viewport, route)
          gaps.push(Math.round(m.firstContentTop - m.chromeBottom))
        }
        expect(new Set(gaps).size, `gaps ${gaps.join(', ')}`).toBe(1)
      })
    })
  }
})
