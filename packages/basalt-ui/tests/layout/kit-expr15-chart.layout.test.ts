/**
 * Expression cycle 15 kit fixes (`v3-expr-15-kit-fixes` 6 to 9), chart behaviours in real Chrome.
 * Fixture: `fixture/kit-expr15-chart-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('chart', 'expr15')
})
afterAll(() => doc?.cleanup())

const VARIANTS = ['one', 'same', 'two'] as const

layout('a ChartCard legend on a Bars chart with highlight', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`renders without a loop at ${viewport.name}`, async () => {
      const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
      await page.raw.waitForSelector('[data-testid="x15-legend-two"]')
      await page.raw.waitForTimeout(500)
      const state = await page.raw.evaluate(
        (ids: string[]) => ({
          error: (window as unknown as { __fixtureError?: string }).__fixtureError ?? null,
          charts: ids.map(
            (id) =>
              document.querySelector(`[data-testid="x15-legend-${id}"] svg.ts-chart`) !== null,
          ),
        }),
        [...VARIANTS],
      )
      expect(state.error).toBeNull()
      expect(state.charts).toEqual([true, true, true])
    })
  }
})
