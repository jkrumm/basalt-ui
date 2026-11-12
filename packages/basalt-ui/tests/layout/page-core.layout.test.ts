/**
 * The page core in a real browser, on the v3 fixture (`fixture/v3/scenarios/page-core.tsx`),
 * shell-less (spike S1):
 * - the band: a `Section` anchor, a cold load, a restored scroll and a table head all land at the
 *   band's bottom edge (0.5 px), at 1440 and 390, and `--page-bar-h` is published before paint;
 * - the aside: a second column from the `wide` container tier, a `Sheet` below it, and with no
 *   `PageAside` mounted no column and no ghost;
 * - one `h1`.
 *
 * v3 only: the 2.x oracle has no `Page`. The shell-measured docked seam is I5's.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { providedSlots } from './fixture/v3/registry'
import type { PageCoreSpec } from './fixture/v3/scenarios/page-core'
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
  ['page-bar', 'section', 'page-aside'].every((s) => providedSlots().has(s))
const layout = runnable ? describe : describe.skip

const specOf = (pageCore: NonNullable<PageCoreSpec['pageCore']> = {}): PageCoreSpec => ({
  sections: [],
  pageCore,
})

const TOLERANCE = 0.5
const frames = `await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(0))))`

/** The distance of `#id`'s top below the band's bottom edge, after the browser's own anchor scroll. */
async function gapAfterJump(
  viewport: Viewport,
  id: string,
  restoreY?: number,
): Promise<{ gap: number; barBottom: number; barTop: number }> {
  const page = await openFixture(specOf(), viewport)
  return page.raw.evaluate(
    async ({ id, restoreY, frames }) => {
      const wait = new Function(`return (async () => { ${frames} })()`) as () => Promise<void>
      if (restoreY !== undefined) {
        window.scrollTo(0, restoreY)
        await wait()
      }
      document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
      await wait()
      const bar = document.querySelector('[data-slot="page-bar"]')
      const target = document.getElementById(id)
      if (!bar || !target) throw new Error('FAILED: band or section did not render')
      const b = bar.getBoundingClientRect()
      return {
        gap: target.getBoundingClientRect().top - b.bottom,
        barBottom: b.bottom,
        barTop: b.top,
      }
    },
    { id, restoreY, frames },
  )
}

for (const viewport of [DESKTOP_1440, PHONE]) {
  layout(`the band at ${viewport.width}`, () => {
    for (const id of ['overview', 'latency', 'errors']) {
      test(`#${id}: the section top equals the band bottom within 0.5 px after a jump`, async () => {
        const { gap, barBottom } = await gapAfterJump(viewport, id)
        expect(barBottom).toBeGreaterThan(0)
        expect(Math.abs(gap)).toBeLessThanOrEqual(TOLERANCE)
      })
    }

    test('a restored scroll does not move the band, and the jump still lands on its edge', async () => {
      const { gap, barTop } = await gapAfterJump(viewport, 'errors', 650)
      expect(Math.abs(barTop)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs(gap)).toBeLessThanOrEqual(TOLERANCE)
    })

    test('the table head sticks at the band bottom while its section scrolls', async () => {
      const page = await openFixture(specOf(), viewport)
      const delta = await page.raw.evaluate(async (frames) => {
        const wait = new Function(`return (async () => { ${frames} })()`) as () => Promise<void>
        const table = document.querySelector('[data-testid="table"]')
        const head = document.querySelector('[data-testid="thead"]')
        const bar = document.querySelector('[data-slot="page-bar"]')
        if (!table || !head || !bar) throw new Error('FAILED: table, head or band missing')
        const top = table.getBoundingClientRect().top + window.scrollY
        window.scrollTo(0, top + 300)
        await wait()
        return head.getBoundingClientRect().top - bar.getBoundingClientRect().bottom
      }, frames)
      expect(Math.abs(delta)).toBeLessThanOrEqual(TOLERANCE)
    })

    test('cold load at /#latency: the section lands below the band once --page-bar-h is published', async () => {
      const page = await openFixture(specOf(), viewport, '/#latency')
      const read = await page.raw.evaluate(() => {
        const root = document.querySelector<HTMLElement>('[data-slot="page"]')
        const bar = document.querySelector('[data-slot="page-bar"]')
        const target = document.getElementById('latency')
        if (!root || !bar || !target) throw new Error('FAILED: page, band or section missing')
        const b = bar.getBoundingClientRect()
        return {
          published: parseFloat(root.style.getPropertyValue('--page-bar-h')),
          height: b.height,
          gap: target.getBoundingClientRect().top - b.bottom,
        }
      })
      expect(Math.abs(read.published - read.height)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs(read.gap)).toBeLessThanOrEqual(TOLERANCE)
    })

    test('exactly one h1, and no horizontal overflow', async () => {
      const page = await openFixture(specOf(), viewport)
      expect(await page.raw.evaluate(() => document.querySelectorAll('h1').length)).toBe(1)
      expectNoHorizontalOverflow(
        await page.horizontalOverflow(),
        `page core at ${viewport.width}`,
        viewport,
      )
    })
  })
}

layout('the aside, shell-less', () => {
  test('1440: a second column beside the content, the band stays in the first', async () => {
    const page = await openFixture(specOf({ aside: true }), DESKTOP_1440)
    const m = await page.raw.evaluate(
      ({ aside, main }) => {
        const a = document.querySelector(aside)
        const c = document.querySelector(main)
        const bar = document.querySelector('[data-slot="page-bar"]')
        if (!a || !c || !bar) throw new Error('FAILED: aside, main or band missing')
        const ar = a.getBoundingClientRect()
        const cr = c.getBoundingClientRect()
        return {
          asideLeft: ar.left,
          asideWidth: ar.width,
          mainRight: cr.right,
          barRight: bar.getBoundingClientRect().right,
          viewport: window.innerWidth,
        }
      },
      { aside: slot('page-aside'), main: slot('page-main') },
    )
    expect(m.asideWidth).toBeCloseTo(360, 0)
    expect(m.asideLeft).toBeGreaterThanOrEqual(m.mainRight - TOLERANCE)
    expect(m.barRight).toBeLessThanOrEqual(m.mainRight + TOLERANCE)
    expect(m.asideLeft + m.asideWidth).toBeLessThanOrEqual(m.viewport + TOLERANCE)
  })

  test('390: no column; a trigger opens the same content in a sheet', async () => {
    const page = await openFixture(specOf({ aside: true }), PHONE)
    expect(
      await page.raw.evaluate((s) => document.querySelector(s) !== null, slot('page-aside')),
    ).toBe(false)
    await page.raw.click('[data-aside-trigger]')
    await page.raw.waitForSelector('[data-testid="aside-body"]')
    expect(
      await page.raw.evaluate(() => document.querySelectorAll('[data-testid="aside-body"]').length),
    ).toBe(1)
  })

  for (const viewport of [DESKTOP_1440, PHONE]) {
    test(`${viewport.width}: with no PageAside mounted no column and no ghost is rendered`, async () => {
      const page = await openFixture(specOf(), viewport)
      const m = await page.raw.evaluate(
        ({ aside, slotSel, main }) => {
          const s = document.querySelector<HTMLElement>(slotSel)
          const c = document.querySelector(main)
          if (!c) throw new Error('FAILED: main missing')
          return {
            asides: document.querySelectorAll(aside).length,
            slotWidth: s === null ? 0 : s.getBoundingClientRect().width,
            mainRight: c.getBoundingClientRect().right,
            viewport: document.documentElement.clientWidth,
          }
        },
        { aside: slot('page-aside'), slotSel: slot('page-aside-slot'), main: slot('page-main') },
      )
      expect(m.asides).toBe(0)
      expect(m.slotWidth).toBe(0)
      expect(Math.abs(m.mainRight - m.viewport)).toBeLessThanOrEqual(TOLERANCE)
    })
  }
})
