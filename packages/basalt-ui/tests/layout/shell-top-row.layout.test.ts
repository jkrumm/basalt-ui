/**
 * The frame's top row on the built playground (Issue 3292), in a real browser:
 *
 * - at 1800x1200 the brand zone (workspace switcher, collapse button) and the breadcrumb strip are
 *   one row: one top, one height, and their text on one baseline, on a list page and a record page;
 * - a route two levels deep shows every ancestor, each a link, joined by the separator, the record
 *   name last and not a link; a phone keeps the nearest ancestor and the leaf;
 * - the strip's trailing slot holds the app's typed `GlobalAction` entries (connection, appearance).
 *
 * It serves `apps/playground/dist`, which `make check` and CI build before the layout suite.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openDocument } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip
afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const DIST = resolve(import.meta.dir, '../../../../apps/playground/dist')
const DESKTOP_1800: Viewport = { name: 'wide desktop', width: 1800, height: 1200 }
/** An app build takes about 20 s on a runner; the hook declares its own budget (Bun's default is 5 s). */
const BUILD_BUDGET_MS = 360_000

let server: ReturnType<typeof Bun.serve> | undefined

beforeAll(() => {
  // `make check` builds the playground before the layout suite; a CI layout shard builds only the package.
  if (!existsSync(join(DIST, 'index.html'))) {
    const build = Bun.spawnSync(['bun', '--filter', '@basalt-ui/playground', 'build'], {
      cwd: resolve(DIST, '../../..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (build.exitCode !== 0 || !existsSync(join(DIST, 'index.html'))) {
      throw new Error(`shell-top-row: the playground did not build:\n${build.stderr.toString()}`)
    }
  }
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname)
      const target = resolve(DIST, `.${path}`)
      if (target !== DIST && !target.startsWith(DIST + sep))
        return new Response('', { status: 404 })
      const asset = Bun.file(target)
      if (path !== '/' && (await asset.exists())) return new Response(asset)
      if (/\.[a-z0-9]+$/i.test(path)) return new Response('', { status: 404 })
      return new Response(Bun.file(join(DIST, 'index.html')), {
        headers: { 'content-type': 'text/html' },
      })
    },
  })
}, BUILD_BUDGET_MS)

afterAll(() => server?.stop(true))

async function open(route: string, viewport: Viewport, leaf: string): Promise<LayoutPage> {
  const page = await openDocument('<!doctype html><html><body></body></html>', viewport)
  await page.raw.goto(new URL(route, server!.url).href)
  await page.raw.waitForFunction(
    (text) => document.querySelector('[data-slot="page-breadcrumb-leaf"]')?.textContent === text,
    leaf,
  )
  await page.raw.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.settle()
  return page
}

type Row = {
  brand: { top: number; height: number; right: number }
  header: { top: number; height: number; left: number }
  /** The bottom of the first line box of each text: equal fonts on one baseline share it. */
  brandText: { bottom: number; size: string }
  crumbText: { bottom: number; size: string }
}

function measureRow(page: LayoutPage): Promise<Row> {
  return page.raw.evaluate(() => {
    const box = (sel: string): DOMRect => {
      const el = document.querySelector<HTMLElement>(sel)
      if (el === null) throw new Error(`LAYOUT: no ${sel}`)
      return el.getBoundingClientRect()
    }
    const text = (sel: string): { bottom: number; size: string } => {
      const el = document.querySelector<HTMLElement>(sel)
      const node =
        el === null ? null : document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()
      if (el === null || node === null) throw new Error(`LAYOUT: no text in ${sel}`)
      const range = document.createRange()
      range.selectNodeContents(node)
      return {
        bottom: range.getClientRects()[0]!.bottom,
        size: getComputedStyle(node.parentElement!).fontSize,
      }
    }
    const brand = box('[data-slot="shell-brand-zone"]')
    const header = box('[data-slot="shell-header"]')
    return {
      brand: { top: brand.top, height: brand.height, right: brand.right },
      header: { top: header.top, height: header.height, left: header.left },
      brandText: text('[data-slot="shell-brand-zone"] [data-slot="menu-trigger"]'),
      crumbText: text('[data-slot="shell-breadcrumb"] > :first-child'),
    }
  })
}

/** The trail as read: every child of the strip's breadcrumb, separators included, and which are links. */
function trailOf(page: LayoutPage): Promise<{ text: string; link: string | null }[]> {
  return page.raw.evaluate(() =>
    [...(document.querySelector('[data-slot="shell-breadcrumb"]')?.children ?? [])].map((el) => ({
      text: el.textContent ?? '',
      link: el.tagName === 'A' ? new URL((el as HTMLAnchorElement).href).pathname : null,
    })),
  )
}

const SUPPLIER = 'Brenner Verbindungstechnik'
const PART = 'Hex bolt M8 x 40, A2 stainless'

layout('the frame top row on the playground', () => {
  for (const [route, leaf] of [
    ['/kit/board', 'Pipeline'],
    ['/ref/suppliers/sup-1', SUPPLIER],
  ] as const) {
    test(`1800 ${route}: the brand zone and the strip are one row on one baseline`, async () => {
      const m = await measureRow(await open(route, DESKTOP_1800, leaf))
      expect(m.header.top, 'the strip is the window top row').toBe(0)
      expect([m.brand.top, m.brand.height], 'one top, one height').toEqual([
        m.header.top,
        m.header.height,
      ])
      expect(m.brand.right, 'the strip starts where the brand zone ends').toBe(m.header.left)
      expect(m.brandText.size, 'one text size on the row').toBe(m.crumbText.size)
      expect(Math.abs(m.brandText.bottom - m.crumbText.bottom), 'one baseline').toBeLessThanOrEqual(
        1,
      )
    })
  }

  test('1800: a route two levels deep shows every ancestor, each a link, joined by the separator', async () => {
    // The supplier record sits under the tour's nav section, its page names the parts list as parent.
    const supplier = await trailOf(await open('/ref/suppliers/sup-1', DESKTOP_1800, SUPPLIER))
    expect(supplier).toEqual([
      { text: 'Tour', link: null },
      { text: '/', link: null },
      { text: 'Parts', link: '/ref/parts' },
      { text: '/', link: null },
      { text: SUPPLIER, link: null },
    ])
    // A part's record is in no nav section: its trail is the parent it names, then its name.
    const part = await trailOf(await open('/ref/part/fa-1008', DESKTOP_1800, PART))
    expect(part).toEqual([
      { text: 'Parts', link: '/ref/parts' },
      { text: '/', link: null },
      { text: PART, link: null },
    ])
  })

  test('390: the phone header keeps the nearest ancestor and the leaf', async () => {
    const trail = await trailOf(await open('/ref/suppliers/sup-1', PHONE, SUPPLIER))
    expect(trail).toEqual([
      { text: 'Parts', link: '/ref/parts' },
      { text: '/', link: null },
      { text: SUPPLIER, link: null },
    ])
  })

  test("1800: the strip's trailing slot holds the app's typed global actions", async () => {
    const page = await open('/kit/board', DESKTOP_1800, 'Pipeline')
    const items = await page.raw.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-slot="shell-trail"] > [data-item]')].map(
        (el) => el.dataset['item'],
      ),
    )
    expect(items).toEqual(['connection', 'appearance'])
    expect(await page.count('[data-slot="shell-trail"] [data-slot="connection-indicator"]')).toBe(1)
  })
})
