/**
 * Layout invariants of the two trial phone navs (Issue 3205), the ones happy-dom cannot see: every
 * target a thumb can hit is at least 44x44, a section's list stays in the bottom half of the screen,
 * nothing a reader must reach sits under a home indicator, More's sidebar holds the same floors, and
 * a focused text field is never under the bar. Each variant at 390x844 and 430x932.
 *
 * The home indicator is `--shell-safe-bottom: 34px` on `<html>` (the fixture's `safeBottom`): the
 * variants read `max(env(safe-area-inset-bottom), var(--shell-safe-bottom))`, and a headless browser's
 * `env()` is always 0. Assertions are relations and bounds, never exact pixels.
 *
 * v3 only: the 2.x oracle has no variants, so under `LAYOUT_TARGET=v2` the file skips.
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

type Variant = NonNullable<FixtureSpec['phoneNav']>

const items = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}`, label: `${prefix} page ${i + 1}` }))

/** Five sections: four bar slots (one holding a single page) and one behind More. */
const spec = (phoneNav: Variant, extra: Partial<FixtureSpec> = {}): FixtureSpec => ({
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
    { label: 'Reference', items: items('ref', 4) },
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

for (const variant of ['tray', 'drawer'] as const) {
  for (const viewport of [PHONE, PHONE_430] as const) {
    suite(`phone nav ${variant} at ${viewport.width}x${viewport.height}`, () => {
      test('every bar target is at least 44x44 and clears the home indicator', async () => {
        const p = await openFixture(spec(variant), viewport)
        await p.waitFor(MORE)
        const found = await targets(p, BAR)
        expect(found.length).toBe(5)
        expect(small(found)).toEqual([])
        expect(found.filter((t) => t.bottom > viewport.height - INSET + 0.5)).toEqual([])
      })

      test("a section's list: rows at least 44 high, in the bottom half, its end above the bar", async () => {
        const p = await openFixture(spec(variant), viewport)
        await p.waitFor(MORE)
        await p.tap(`${BAR} button[aria-label^="Overview"]`)
        await p.waitFor(LIST)
        await p.settle()
        const rows = await targets(p, LIST)
        expect(rows.length).toBeGreaterThan(3)
        expect(rows.filter((t) => t.height < FLOOR - 0.5)).toEqual([])
        const bar = await p.box('bar', BAR)
        const reach = await p.raw.evaluate((sel) => {
          const list = document.querySelector<HTMLElement>(sel)
          if (list === null) return null
          list.scrollTop = list.scrollHeight
          const all = list.querySelectorAll('a, button')
          const end = all[all.length - 1]?.getBoundingClientRect()
          return { top: list.getBoundingClientRect().top, end: end?.bottom ?? 0 }
        }, LIST)
        if (reach === null) throw new Error('no list')
        // Thumb reach: nothing of the list sits in the top half of the screen.
        expect(reach.top).toBeGreaterThanOrEqual(viewport.height / 2 - 0.5)
        expect(reach.end).toBeLessThanOrEqual(bar.box.top + 0.5)
      })

      test("More: the app slides aside, the sidebar's targets are 44 px and clear the indicator", async () => {
        const p = await openFixture(spec(variant), viewport)
        await p.waitFor(MORE)
        await p.tap(MORE)
        await p.settle()
        const sidebar = await p.box('sidebar', slot('shell-phone-sidebar'))
        const shell = await p.box('shell', slot('shell'))
        expect(shell.box.left).toBeGreaterThanOrEqual(sidebar.box.right - 0.5)
        const found = await targets(p, slot('shell-phone-sidebar'))
        expect(found.length).toBeGreaterThan(10)
        expect(small(found)).toEqual([])
        // The rail ends (its footer of settings and account last) above the indicator; what is
        // past its scroll viewport's fold is scrolled to, not covered.
        const rail = await p.box('rail', `${slot('shell-phone-sidebar')} ${slot('shell-rail')}`)
        expect(rail.box.bottom).toBeLessThanOrEqual(viewport.height - INSET + 0.5)
      })

      test('a focused text field is never under the bar', async () => {
        const p = await openFixture(spec(variant, { bodyHeight: 1600, field: true }), viewport)
        await p.waitFor(MORE)
        // The worst place: the field at the very bottom of the scrollport.
        const covered = await p.raw.evaluate(async () => {
          const field = document.querySelector<HTMLInputElement>('[data-testid="field"]')
          if (field === null) return ['no field']
          field.scrollIntoView({ block: 'end' })
          field.focus()
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
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
        const p = await openFixture(spec(variant, { bodyHeight: 2400 }), viewport)
        await p.waitFor(MORE)
        await p.scrollToEnd()
        await p.settle()
        const end = await p.box('content end', '[data-testid="content-end"]')
        const bar = await p.box('bar', BAR)
        expect(end.box.bottom).toBeLessThanOrEqual(bar.box.top + 0.5)
      })
    })
  }
}

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
