/**
 * Expression cycle 18 chart labels (`v3-expr-18-kit-fixes` 8 and 10; n91 .31 and the panes' ticks 22 px apart).
 * Fixture: `fixture/kit-expr18-labels-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('labels', 'expr18')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector(
    '[data-testid="k18-panes"] [data-slot="chart-pane"]:nth-child(2) svg.ts-chart',
  )
  await page.settle()
  return page
}

/** Each pane's plot: where it starts and how wide it is (the clip the engine draws the marks in). */
const plots = (page: LayoutPage): Promise<{ x: number; width: number }[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll('[data-testid="k18-panes"] [data-slot="chart-pane"]')].map(
      (p) => {
        const rect = p.querySelector('svg.ts-chart clipPath rect')!
        return { x: Number(rect.getAttribute('x')), width: Number(rect.getAttribute('width')) }
      },
    ),
  )

for (const viewport of [WIDE, PHONE]) {
  layout(`stacked panes of one card, ${viewport.name}`, () => {
    test('two panes with different y labels share one plot x and width, so a date is on one x (n91)', async () => {
      const [spend, cache] = await plots(await open(viewport))
      expect(Math.abs(spend!.x - cache!.x)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(spend!.width - cache!.width)).toBeLessThanOrEqual(0.5)
    })
  })
}
