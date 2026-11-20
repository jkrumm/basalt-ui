/**
 * Expression cycle 16, the arrow keys of a chart at 390 (`v3-expr-16-kit-fixes` 7, n73, n78, n80): a step
 * brings its joined phone card into the list's own region only; the region that holds the chart (the
 * shell's scrolling main) never moves for a card, so the chart stays in view. Fixture:
 * `fixture/kit-expr16f-keys-fixture.tsx`.
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
  doc = await buildExpr12Document('keys', 'expr16f')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k16f-table"] tbody tr', { state: 'attached' })
  await page.settle()
  return page
}

const view = (
  page: LayoutPage,
): Promise<{ scrollTop: number; plotInside: boolean; card: number }> =>
  page.raw.evaluate(() => {
    const page = document.querySelector<HTMLElement>('[data-testid="k16f-page"]')!
    const box = page.getBoundingClientRect()
    const plot = page.querySelector('svg.ts-chart')!.getBoundingClientRect()
    const card = page.querySelector('[data-testid="k16f-table"] tbody tr')!.getBoundingClientRect()
    return {
      scrollTop: page.scrollTop,
      plotInside: plot.top >= box.top && plot.bottom <= box.bottom,
      card: card.top - box.bottom,
    }
  })

layout('the arrow keys of a chart at 390 keep the chart in view', () => {
  test('two steps leave the scrolling page where it is', async () => {
    const page = await open()
    const rest = await view(page)
    expect(rest.plotInside).toBe(true)
    expect(rest.card, 'the phone list starts below the fold').toBeGreaterThan(0)
    await page.raw.evaluate(() => {
      document.querySelector<HTMLElement>('[data-testid="k16f-page"] [data-chart-focus]')!.focus()
    })
    for (let i = 0; i < 2; i++) await page.raw.keyboard.press('ArrowRight')
    await page.raw.waitForTimeout(300)
    await page.settle()
    const index = await page.raw.evaluate(() =>
      document.querySelector('[data-testid="k16f-page"]')!.getAttribute('data-focus-index'),
    )
    expect(index, 'the keys moved the chart focus').not.toBe('')
    const after = await view(page)
    expect(after.scrollTop).toBe(rest.scrollTop)
    expect(after.plotInside).toBe(true)
  })
})
