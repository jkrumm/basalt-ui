/**
 * Layout invariants of the phone nav (the section bar and its short drawer, Issues 3205 and 3246), the
 * ones happy-dom cannot see: every target a thumb can hit is at least 44x44, the drawer rests at a
 * short snap in the bottom half of the screen and a tall one at most 85 % of it, a drag moves it
 * between them and closes it, its list scrolls at the tall snap and hands the gesture back at the top,
 * nothing a reader must reach sits under a home indicator, More's sidebar uses the desktop rail's row
 * height and a tap on any of its links navigates and closes it, search
 * is in thumb reach and a focused text field is never under the bar. Each at 390x844 and 430x932.
 *
 * The home indicator is `--shell-safe-bottom: 34px` on `<html>` (the fixture's `safeBottom`): the
 * phone nav reads `max(env(safe-area-inset-bottom), var(--shell-safe-bottom))`, and a headless
 * browser's `env()` is always 0. Assertions are relations and bounds, never exact pixels.
 *
 * v3 only: the 2.x oracle has no section bar, so under `LAYOUT_TARGET=v2` the file skips.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { LAYOUT_TARGET } from './shell-slots'
import type { FixtureSpec } from './fixture/spec'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()
const suite = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

const PHONE_430: Viewport = { name: 'iPhone Pro Max', width: 430, height: 932 }
const INSET = 34
const FLOOR = 44

const items = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}`, label: `${prefix} page ${i + 1}` }))

/** Five sections: four bar slots (one holding a single page) and one behind More. */
const spec = (phoneNav: 'drawer' | 'default', extra: Partial<FixtureSpec> = {}): FixtureSpec => ({
  nav: { maxTabs: 5 },
  sections: [
    {
      label: 'Overview',
      items: [
        { key: 'home', label: 'Home', active: true },
        { key: 'cards', label: 'Cards', count: 4 },
        { key: 'table', label: 'Table' },
        { key: 'shell', label: 'Shell' },
        { key: 'widgets', label: 'Widgets' },
        { key: 'more-a', label: 'Another page' },
        { key: 'more-b', label: 'And one more' },
      ],
    },
    { label: 'Solo', items: [{ key: 'solo', label: 'Solo page' }] },
    { label: 'Kit', items: items('kit', 6) },
    // Longer than the tall snap holds, so its list scrolls.
    { label: 'Reference', items: items('ref', 16) },
    { label: 'Trials', collapsible: true, items: items('trial', 3) },
  ],
  phoneNav,
  safeBottom: INSET,
  search: true,
  ...extra,
})

const BAR = slot('shell-phone-bar')
const MORE = slot('shell-phone-more')
const LIST = slot('shell-phone-list')

type Target = { name: string; top: number; bottom: number; width: number; height: number }

/** Every visible link and button under `selector`, outside an inert subtree. */
function targets(p: LayoutPage, selector: string): Promise<Target[]> {
  return p.raw.evaluate((sel) => {
    const out: Target[] = []
    for (const root of document.querySelectorAll(sel)) {
      for (const el of root.querySelectorAll<HTMLElement>('a, button')) {
        if (el.getClientRects().length === 0 || el.closest('[inert]') !== null) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const name = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName
        out.push({ name, top: r.top, bottom: r.bottom, width: r.width, height: r.height })
      }
    }
    return out
  }, selector)
}

const small = (found: readonly Target[]): Target[] =>
  found.filter((t) => t.height < FLOOR - 0.5 || t.width < FLOOR - 0.5)

const SHEET = slot('shell-phone-sheet')
const GRABBER = slot('shell-phone-grabber')
const SEARCH = slot('shell-phone-search')

/** A finger dragging from (x, y) to (x, y + dy) in real touch events, the ones Base UI's swipe reads. */
async function touchDrag(p: LayoutPage, x: number, y: number, dy: number): Promise<void> {
  const cdp = await p.raw.context().newCDPSession(p.raw)
  const point = (py: number) => [{ x, y: py, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(y) })
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(y + (dy * i) / steps),
    })
    await p.raw.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  // The drawer settles on the kit's spring, 500 ms.
  await p.raw.waitForTimeout(800)
  await p.settle()
}

const top = async (p: LayoutPage, selector: string): Promise<number> =>
  (await p.box('box', selector)).box.top

/** Open a section's drawer and let it rest. */
async function open(p: LayoutPage, section: string): Promise<void> {
  await p.waitFor(MORE)
  await p.tap(`${BAR} button[aria-label^="${section}"]`)
  await p.waitFor(LIST)
  await p.raw.waitForTimeout(800)
  await p.settle()
}

for (const viewport of [PHONE, PHONE_430] as const) {
  suite(`phone nav at ${viewport.width}x${viewport.height}`, () => {
    test('a nav with no pick is the section bar; every bar target is at least 44x44 and clears the home indicator', async () => {
      const p = await openFixture(spec('default'), viewport)
      await p.waitFor(MORE)
      const found = await targets(p, BAR)
      expect(found.length).toBe(5)
      expect(small(found)).toEqual([])
      expect(found.filter((t) => t.bottom > viewport.height - INSET + 0.5)).toEqual([])
    })

    test("the short snap: the drawer's foot is on the bar, its top in the bottom half, its rows 44 high", async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await open(p, 'Overview')
      const bar = await p.box('bar', BAR)
      const sheet = await p.box('sheet', SHEET)
      // Thumb reach: nothing of the drawer sits in the top half of the screen.
      expect(sheet.box.top).toBeGreaterThanOrEqual(viewport.height / 2 - 1)
      const rows = (await targets(p, LIST)).filter((t) => t.bottom <= bar.box.top + 0.5)
      expect(rows.length).toBeGreaterThan(3)
      expect(rows.filter((t) => t.height < FLOOR - 0.5)).toEqual([])
      // The first row is whole; the list does not scroll at the short snap, a drag grows it instead.
      // The page behind is dimmed: the scrim is on, over the page and under the bar.
      const dim = await p.raw.evaluate((sel) => {
        const scrim = document.querySelector(sel)
        return scrim === null ? null : Number(getComputedStyle(scrim).opacity)
      }, slot('shell-phone-list-scrim'))
      expect(dim).toBe(1)
      const scrolls = await p.raw.evaluate(
        (sel) => getComputedStyle(document.querySelector(sel) as Element).overflowY,
        LIST,
      )
      expect(scrolls).toBe('hidden')
    })

    test('a drag up grows the drawer to its tall snap, at most 85 % of the screen, and a drag down shrinks it', async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await open(p, 'Reference')
      const shortTop = await top(p, SHEET)
      const grab = await p.box('grabber', GRABBER)
      const x = grab.box.left + grab.box.width / 2
      await touchDrag(p, x, grab.box.top + grab.box.height / 2, -400)
      const tallTop = await top(p, SHEET)
      expect(tallTop).toBeLessThan(shortTop - 100)
      // The status bar and a strip of the page stay in view: the screen's top 15 % is not the drawer's.
      expect(tallTop).toBeGreaterThanOrEqual(viewport.height * 0.15 - 1)
      const grabTall = await p.box('grabber', GRABBER)
      await touchDrag(p, x, grabTall.box.top + grabTall.box.height / 2, 300)
      expect(await top(p, SHEET)).toBeGreaterThan(tallTop + 100)
    })

    test('at the tall snap the list scrolls inside, its last row ends above the bar, and the top of the list hands the drag back', async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await open(p, 'Reference')
      const grab = await p.box('grabber', GRABBER)
      const x = grab.box.left + grab.box.width / 2
      await touchDrag(p, x, grab.box.top + grab.box.height / 2, -400)
      const tallTop = await top(p, SHEET)
      const reach = await p.raw.evaluate((sel) => {
        const list = document.querySelector<HTMLElement>(sel)
        if (list === null) return null
        const before = {
          scrolls: getComputedStyle(list).overflowY,
          over: list.scrollHeight - list.clientHeight,
        }
        list.scrollTop = list.scrollHeight
        const all = list.querySelectorAll('a, button')
        return { ...before, end: all[all.length - 1]?.getBoundingClientRect().bottom ?? 0 }
      }, LIST)
      if (reach === null) throw new Error('no list')
      expect(reach.scrolls).toBe('auto')
      expect(reach.over).toBeGreaterThan(0)
      const bar = await p.box('bar', BAR)
      expect(reach.end).toBeLessThanOrEqual(bar.box.top + 0.5)
      // Back at the top of the list, a drag down on a row moves the drawer, not the list.
      await p.raw.evaluate((sel) => {
        const list = document.querySelector<HTMLElement>(sel)
        if (list !== null) list.scrollTop = 0
      }, LIST)
      const row = await p.box('row', `${LIST} a`)
      await touchDrag(p, row.box.left + row.box.width / 2, row.box.top + row.box.height / 2, 300)
      expect(await top(p, SHEET)).toBeGreaterThan(tallTop + 100)
    })

    test('a drag down from the short snap closes the drawer', async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await open(p, 'Overview')
      const grab = await p.box('grabber', GRABBER)
      await touchDrag(
        p,
        grab.box.left + grab.box.width / 2,
        grab.box.top + grab.box.height / 2,
        400,
      )
      const present = await p.raw.evaluate((sel) => document.querySelector(sel) !== null, SHEET)
      expect(present).toBe(false)
    })

    test("another section swaps the drawer's rows and it stays open at the rest the reader chose", async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await open(p, 'Overview')
      await p.tap(`${BAR} button[aria-label^="Kit"]`)
      await p.raw.waitForTimeout(800)
      const sheet = await p.box('sheet', SHEET)
      const bar = await p.box('bar', BAR)
      expect(sheet.box.top).toBeGreaterThanOrEqual(viewport.height / 2 - 1)
      const names = await p.raw.evaluate(
        (sel) => document.querySelector(sel)?.textContent ?? '',
        LIST,
      )
      expect(names).toContain('kit page 1')
      expect(names).not.toContain('Cards')
      expect(bar.box.top).toBeGreaterThan(sheet.box.top)
    })

    test('search is in thumb reach: in the drawer head and at the foot of More, 44 px, over the indicator', async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await open(p, 'Overview')
      const inDrawer = await p.box('search', SEARCH)
      expect(inDrawer.box.top).toBeGreaterThanOrEqual(viewport.height / 2 - 1)
      expect(Math.min(inDrawer.box.width, inDrawer.box.height)).toBeGreaterThanOrEqual(FLOOR - 0.5)
      await p.tap(MORE)
      await p.settle()
      const inMore = await p.box('search', `${slot('shell-phone-sidebar')} ${SEARCH}`)
      // A phone zooms out to fit the shifted app's width, so the screen is what the page reports now.
      const screen = await p.raw.evaluate(() => window.innerHeight)
      expect(inMore.box.top).toBeGreaterThanOrEqual(screen / 2)
      expect(inMore.box.bottom).toBeLessThanOrEqual(screen - INSET + 0.5)
      expect(inMore.box.height).toBeGreaterThanOrEqual(FLOOR - 0.5)
      // The rail's own search row, at the top of the sidebar, is not drawn.
      const rail = await p.raw.evaluate(
        (sel) => document.querySelector(`${sel} [data-slot="shell-rail-search"]`) !== null,
        slot('shell-phone-sidebar'),
      )
      expect(rail).toBe(false)
    })

    test("More: the app slides aside, the sidebar's rows are the desktop rail's and clear the indicator", async () => {
      const p = await openFixture(spec('drawer'), viewport)
      await p.waitFor(MORE)
      await p.tap(MORE)
      await p.settle()
      const sidebar = await p.box('sidebar', slot('shell-phone-sidebar'))
      const shell = await p.box('shell', slot('shell'))
      expect(shell.box.left).toBeGreaterThanOrEqual(sidebar.box.right - 0.5)
      const found = await targets(p, slot('shell-phone-sidebar'))
      expect(found.length).toBeGreaterThan(10)
      // The rail's own row height (32 px), not the touch floor; the search at its foot keeps the floor.
      const rows = found.filter((t) => t.name !== 'Search')
      expect(rows.filter((t) => t.height > 36)).toEqual([])
      expect(small(found.filter((t) => t.name === 'Search'))).toEqual([])
      // The rail ends (its footer of settings and account last) above the indicator; what is
      // past its scroll viewport's fold is scrolled to, not covered.
      const rail = await p.box('rail', `${slot('shell-phone-sidebar')} ${slot('shell-rail')}`)
      expect(rail.box.bottom).toBeLessThanOrEqual(viewport.height - INSET + 0.5)
    })

    test('a tap on a link in More navigates and closes it, the current route included', async () => {
      const p = await openFixture(spec('drawer'), viewport)
      const sidebar = slot('shell-phone-sidebar')
      const isOpen = (): Promise<boolean> =>
        p.raw.evaluate(
          (sel) =>
            document.querySelector(sel)?.hasAttribute('inert') === false &&
            document.querySelector('[data-slot="shell"]')?.hasAttribute('data-phone-sidebar') ===
              true,
          sidebar,
        )
      await p.waitFor(MORE)
      await p.tap(MORE)
      await p.settle()
      expect(await isOpen()).toBe(true)
      await p.tap(`${sidebar} a[href$="/cards"]`)
      await p.raw.waitForTimeout(800)
      expect((await p.navigations()).at(-1)).toBe('/cards')
      expect(await isOpen()).toBe(false)

      await p.tap(MORE)
      await p.settle()
      expect(await isOpen()).toBe(true)
      await p.tap(`${sidebar} a[href$="/cards"]`)
      await p.raw.waitForTimeout(800)
      expect(await isOpen()).toBe(false)
    })

    test('a focused text field is never under the bar', async () => {
      const p = await openFixture(spec('drawer', { bodyHeight: 1600, field: true }), viewport)
      await p.waitFor(MORE)
      // The worst place: the field at the very bottom of the scrollport.
      const covered = await p.raw.evaluate(async () => {
        const field = document.querySelector<HTMLInputElement>('[data-testid="field"]')
        if (field === null) return ['no field']
        field.scrollIntoView({ block: 'end' })
        field.focus()
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const r = field.getBoundingClientRect()
        const points = [
          [r.left + 4, r.top + r.height / 2],
          [r.left + r.width / 2, r.top + r.height / 2],
          [r.right - 4, r.bottom - 2],
        ] as const
        return points.flatMap(([x, y]) => {
          const hit = document.elementFromPoint(x, y)
          return hit === field
            ? []
            : [
                `(${Math.round(x)},${Math.round(y)}) hits ${hit?.outerHTML.slice(0, 80) ?? 'nothing'}`,
              ]
        })
      })
      expect(covered).toEqual([])
    })

    test('scrolled to the end, the last content pixel sits above the bar', async () => {
      const p = await openFixture(spec('drawer', { bodyHeight: 2400 }), viewport)
      await p.waitFor(MORE)
      await p.scrollToEnd()
      await p.settle()
      const end = await p.box('content end', '[data-testid="content-end"]')
      const bar = await p.box('bar', BAR)
      expect(end.box.bottom).toBeLessThanOrEqual(bar.box.top + 0.5)
    })
  })
}

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
