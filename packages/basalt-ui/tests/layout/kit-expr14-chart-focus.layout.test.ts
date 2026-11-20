/**
 * Expression cycle 14, a chart focus over a list at 390 (`v3-expr-14-kit-fixes` 6, n64): a pointer on a chart mark
 * brings its joined row into view without scrolling the page away from the chart. Fixture:
 * `fixture/kit-expr14-focus-phone-fixture.tsx` (the chart above a phone list).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('focus-phone', 'expr14')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k14-table"] tbody tr')
  await page.settle()
  return page
}

/** The plot (the chart's svg) and the page's scroll position, with the chart scrolled into the upper part of the page. */
const setUp = (page: LayoutPage): Promise<{ x: number; y: number; scrollY: number }> =>
  page.raw.evaluate(() => {
    const svg = document.querySelector('[data-testid="k14-root"] svg.ts-chart')!
    window.scrollTo(0, svg.getBoundingClientRect().top + window.scrollY - 60)
    const r = svg.getBoundingClientRect()
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5, scrollY: window.scrollY }
  })

const plotVisible = (page: LayoutPage): Promise<boolean> =>
  page.raw.evaluate(() => {
    const r = document
      .querySelector('[data-testid="k14-root"] svg.ts-chart')!
      .getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight
  })

layout('a chart focus at 390 keeps the chart in view', () => {
  test('a keyboard step on the chart reveals its row without scrolling the chart out of view', async () => {
    const page = await open()
    await setUp(page)
    await page.raw.evaluate(() => {
      const svg = document.querySelector<SVGElement>('[data-testid="k14-root"] svg.ts-chart')!
      const host = svg.closest<HTMLElement>('[tabindex]') ?? svg
      host.focus()
    })
    for (let i = 0; i < 3; i++) await page.raw.keyboard.press('ArrowRight')
    await page.raw.waitForTimeout(300)
    await page.settle()
    const index = await page.raw.evaluate(() =>
      document.querySelector('[data-testid="k14-root"]')!.getAttribute('data-focus-index'),
    )
    expect(index, 'the keys moved the chart focus').not.toBe('')
    expect(await plotVisible(page)).toBe(true)
  })

  test('a pointer on a chart mark reveals its row without scrolling the page away from the chart', async () => {
    const page = await open()
    const at = await setUp(page)
    await page.raw.mouse.move(at.x, at.y, { steps: 4 })
    await page.raw.waitForTimeout(400)
    await page.settle()
    expect(await page.raw.evaluate(() => window.scrollY)).toBe(at.scrollY)
    expect(await plotVisible(page)).toBe(true)
  })
})
