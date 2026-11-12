/**
 * `InnerNav` and `SplitPage` in a real browser, on the v3 fixture
 * (`fixture/v3/scenarios/inner-nav.ts`), shell-less, over a test-local push field on the address bar:
 * - one DOM: the nav's markup is byte-identical at 1440 and 390, and only CSS changes it from a
 *   vertical list to a horizontally scrolling link strip;
 * - real links: every item is an `<a href>`, exactly one carries `aria-current`;
 * - Back walks sections: three clicks, two `history.back()` calls, the first section again;
 * - `SplitPage` at 390 shows the list while unset and the pane once set, and the pane scrolls the
 *   page, not an inner scroller; at 1440 both show and the list is sticky;
 * - axe finds nothing serious or critical.
 *
 * v3 only: the 2.x oracle has neither part.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { providedSlots } from './fixture/v3/registry'
import type { InnerNavSpec } from './fixture/v3/scenarios/inner-nav'
import { LAYOUT_TARGET } from './shell-slots'
import {
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { Viewport } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['inner-nav', 'split-page'].every((s) => providedSlots().has(s))
const layout = runnable ? describe : describe.skip

const specOf = (mode: 'standalone' | 'split'): InnerNavSpec => ({
  sections: [],
  innerNav: { mode },
})

const ITEMS = 6
const NAV = slot('inner-nav')
const frames = `await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(0))))`

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
let axeSource = ''
beforeAll(() => {
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

const html = async (viewport: Viewport): Promise<string> => {
  const page = await openFixture(specOf('standalone'), viewport)
  return page.raw.evaluate((sel) => document.querySelector(sel)?.innerHTML ?? 'MISSING', NAV)
}

const readLayout = async (viewport: Viewport) => {
  const page = await openFixture(specOf('standalone'), viewport)
  return page.raw.evaluate(
    ({ nav, item }) => {
      const el = document.querySelector<HTMLElement>(nav)
      if (el === null) throw new Error('LAYOUT: no inner nav')
      const tops = [...el.querySelectorAll<HTMLElement>(item)].map((i) =>
        Math.round(i.getBoundingClientRect().top),
      )
      return {
        overflowX: getComputedStyle(el).overflowX,
        scrolls: el.scrollWidth > el.clientWidth + 1,
        rows: new Set(tops).size,
        count: tops.length,
      }
    },
    { nav: NAV, item: slot('inner-nav-item') },
  )
}

const display = (page: Awaited<ReturnType<typeof openFixture>>) =>
  page.raw.evaluate(
    ({ list, detail }) => ({
      list: getComputedStyle(document.querySelector(list) as Element).display,
      detail: getComputedStyle(document.querySelector(detail) as Element).display,
    }),
    { list: slot('split-page-list'), detail: slot('split-page-detail') },
  )

layout('InnerNav is one DOM', () => {
  test('the nav markup is identical at 1440 and 390', async () => {
    const wide = await html(DESKTOP_1440)
    const narrow = await html(PHONE)
    expect(wide).not.toBe('MISSING')
    expect(wide.length).toBeGreaterThan(200)
    expect(narrow).toBe(wide)
  })

  test('1440: a vertical list; 390: one scrolling row of links', async () => {
    const wide = await readLayout(DESKTOP_1440)
    expect(wide.rows).toBe(wide.count)
    expect(wide.scrolls).toBe(false)
    const narrow = await readLayout(PHONE)
    expect(narrow.overflowX).toBe('auto')
    expect(narrow.scrolls).toBe(true)
    expect(narrow.rows).toBe(1)
  })
})

for (const viewport of [DESKTOP_1440, PHONE]) {
  layout(`InnerNav links at ${viewport.width}`, () => {
    test('every item is an <a href> and exactly one has aria-current', async () => {
      const page = await openFixture(specOf('standalone'), viewport)
      const found = await page.raw.evaluate(
        (sel) => ({
          links: document.querySelectorAll(`${sel} a[href]`).length,
          current: document.querySelectorAll(`${sel} [aria-current]`).length,
          currentIsLink: document.querySelector(`${sel} [aria-current]`)?.tagName,
        }),
        NAV,
      )
      expect(found).toEqual({ links: ITEMS, current: 1, currentIsLink: 'A' })
    })

    test('after three section clicks, two history.back() calls return to the first section', async () => {
      const page = await openFixture(specOf('standalone'), viewport)
      const current = await page.raw.evaluate(
        async ({ nav, frames }) => {
          const wait = new Function(`return (async () => { ${frames} })()`) as () => Promise<void>
          const active = (): string | null =>
            document.querySelector(`${nav} [aria-current]`)?.textContent?.trim() ?? null
          const click = async (name: string): Promise<void> => {
            const link = [...document.querySelectorAll<HTMLAnchorElement>(`${nav} a[href]`)].find(
              (a) => a.textContent?.includes(name),
            )
            if (link === undefined) throw new Error(`LAYOUT: no link ${name}`)
            link.click()
            await wait()
          }
          const back = async (): Promise<void> => {
            const popped = new Promise<void>((resolve) =>
              window.addEventListener('popstate', () => resolve(), { once: true }),
            )
            history.back()
            await popped
            await wait()
          }
          await click('Billing')
          await click('Team')
          await click('Security')
          const trail = [active()]
          await back()
          await back()
          trail.push(active())
          return trail
        },
        { nav: NAV, frames },
      )
      expect(current[0]).toContain('Security')
      expect(current[1]).toContain('Billing')
    })

    test('axe finds nothing serious or critical', async () => {
      for (const mode of ['standalone', 'split'] as const) {
        const page = await openFixture(specOf(mode), viewport)
        await page.raw.addScriptTag({ content: axeSource })
        const violations = await page.raw.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: () => Promise<{
                  violations: { id: string; impact: string; nodes: { html: string }[] }[]
                }>
              }
            }
          ).axe
          const result = await axe.run()
          return result.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map(
              (v) =>
                `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 160)).join(' | ')}`,
            )
        })
        expect(violations, mode).toEqual([])
      }
    })

    test('nothing overflows horizontally', async () => {
      for (const mode of ['standalone', 'split'] as const) {
        const page = await openFixture(specOf(mode), viewport)
        expectNoHorizontalOverflow(
          await page.horizontalOverflow(),
          `${mode} nav at ${viewport.width}`,
          viewport,
        )
      }
    })
  })
}

layout('SplitPage at 390', () => {
  test('unset: only the list shows; set: only the pane shows', async () => {
    const page = await openFixture(specOf('split'), PHONE)
    const unset = await display(page)
    expect(unset.list).not.toBe('none')
    expect(unset.detail).toBe('none')
    await page.raw.evaluate(
      ({ nav, frames }) => {
        const wait = new Function(`return (async () => { ${frames} })()`) as () => Promise<void>
        const link = document.querySelectorAll<HTMLAnchorElement>(`${nav} a[href]`)[1]
        link?.click()
        return wait()
      },
      { nav: NAV, frames },
    )
    const set = await display(page)
    expect(set.list).toBe('none')
    expect(set.detail).not.toBe('none')
  })

  test('the pane scrolls the page, not an inner scroller, and a section change resets it', async () => {
    const page = await openFixture(specOf('split'), PHONE)
    const read = await page.raw.evaluate(
      async ({ nav, detail, frames }) => {
        const wait = new Function(`return (async () => { ${frames} })()`) as () => Promise<void>
        document.querySelectorAll<HTMLAnchorElement>(`${nav} a[href]`)[1]?.click()
        await wait()
        const pane = document.querySelector<HTMLElement>(detail)
        if (pane === null) throw new Error('LAYOUT: no pane')
        window.scrollTo(0, 600)
        await wait()
        const scrolled = document.scrollingElement?.scrollTop ?? 0
        const overflows: string[] = []
        for (
          let node: HTMLElement | null = pane;
          node !== null && node !== document.body;
          node = node.parentElement
        ) {
          overflows.push(getComputedStyle(node).overflowY)
        }
        return { scrolled, paneTop: pane.scrollTop, overflows }
      },
      { nav: NAV, detail: slot('split-page-detail'), frames },
    )
    expect(read.scrolled).toBeGreaterThan(500)
    expect(read.paneTop).toBe(0)
    expect(read.overflows.every((o) => o === 'visible')).toBe(true)
  })
})

layout('SplitPage at 1440', () => {
  test('both panes show and the list column is sticky with a scroll area', async () => {
    const page = await openFixture(specOf('split'), DESKTOP_1440)
    const found = await page.raw.evaluate(
      ({ list, detail }) => {
        const l = document.querySelector<HTMLElement>(list)
        const d = document.querySelector<HTMLElement>(detail)
        if (l === null || d === null) throw new Error('LAYOUT: split panes missing')
        return {
          list: getComputedStyle(l).display,
          detail: getComputedStyle(d).display,
          sticky: getComputedStyle(l).position,
          scrollArea: l.querySelector('[data-slot="scroll-area"]') !== null,
          side: l.getBoundingClientRect().right <= d.getBoundingClientRect().left + 1,
        }
      },
      { list: slot('split-page-list'), detail: slot('split-page-detail') },
    )
    expect(found.list).not.toBe('none')
    expect(found.detail).not.toBe('none')
    expect(found.sticky).toBe('sticky')
    expect(found.scrollArea).toBe(true)
    expect(found.side).toBe(true)
  })

  test('a section change resets the page scroll', async () => {
    const page = await openFixture(specOf('split'), DESKTOP_1440)
    const after = await page.raw.evaluate(
      async ({ nav, frames }) => {
        const wait = new Function(`return (async () => { ${frames} })()`) as () => Promise<void>
        window.scrollTo(0, 800)
        await wait()
        const before = document.scrollingElement?.scrollTop ?? 0
        document.querySelectorAll<HTMLAnchorElement>(`${nav} a[href]`)[2]?.click()
        await wait()
        return { before, after: document.scrollingElement?.scrollTop ?? -1 }
      },
      { nav: NAV, frames },
    )
    expect(after.before).toBeGreaterThan(500)
    expect(after.after).toBe(0)
  })
})
