/**
 * Expression cycle 17, a DataPanel's rows body (`v3-expr-17-kit-fixes` 1 and 7, n82 and n86): the panel
 * measures the whole rows it holds, and a focus that scrolls its table to a late row (a pointer on the
 * last bar of the chart beside it) does not change that measure, so the panel keeps its height and
 * everything under or beside it stays put; the last row it shows is whole. Fixture:
 * `fixture/kit-expr17-panel-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const PHONE: Viewport = { name: 'phone 390', width: 390, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('panel', 'expr17')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k17-panel"] tbody tr')
  await page.settle()
  return page
}

type Read = { card: number; scroll: number; wholeRows: boolean }

/** The panel card's height, how far its table is scrolled, and whether every row the body shows ends inside the body. */
const read = (page: LayoutPage): Promise<Read> =>
  page.raw.evaluate(() => {
    const panel = document.querySelector('[data-testid="k17-panel"] [data-slot="data-panel"]')!
    const card = panel.querySelector<HTMLElement>('[data-slot="card"]')!
    const body = panel.querySelector<HTMLElement>('[data-slot="data-panel-rows"]')!
    const scroller = panel.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
    const box = body.getBoundingClientRect()
    const rows = [...panel.querySelectorAll('tbody [data-slot="table-row"]')]
    const shown = rows.filter((r) => {
      const b = r.getBoundingClientRect()
      return b.bottom > box.top + 1 && b.top < box.bottom - 1
    })
    return {
      card: card.getBoundingClientRect().height,
      scroll: scroller.scrollTop,
      wholeRows: shown.every((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= box.top - 1 && b.bottom <= box.bottom + 1
      }),
    }
  })

async function pointOnLastBar(page: LayoutPage): Promise<void> {
  const box = await page.raw.evaluate(() => {
    const r = document
      .querySelector('[data-testid="k17-chart"] [data-basalt-chart]')!
      .getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  await page.raw.mouse.move(box.x + box.width * 0.97, box.y + box.height / 2)
  await page.raw.waitForTimeout(500)
  await page.settle()
}

layout('a DataPanel keeps its height when a focus scrolls its table', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`${viewport.name}: the panel is the same height with the last row focused`, async () => {
      const page = await open(viewport)
      const rest = await read(page)
      await pointOnLastBar(page)
      const after = await read(page)
      expect(after.scroll, 'the focus scrolled the table').toBeGreaterThan(0)
      expect(after.card).toBeCloseTo(rest.card, 1)
      expect(rest.wholeRows).toBe(true)
    })
  }
})
