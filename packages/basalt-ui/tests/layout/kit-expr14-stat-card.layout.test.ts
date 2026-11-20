/**
 * Expression cycle 14, the StatCard string figure (`v3-expr-14-kit-fixes` 5, n65): at 390 a short string value
 * is not ellipsised beside its delta pill and status when it fits at the card's smaller figure size.
 * Fixture: `fixture/kit-expr14-stat-card-fixture.tsx`.
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
  doc = await buildExpr12Document('stat-card', 'expr14')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k14-stat"] [data-slot="stat-figure"]')
  await page.settle()
  return page
}

const figure = (
  page: LayoutPage,
): Promise<{ text: string; scrollWidth: number; clientWidth: number }> =>
  page.raw.evaluate(() => {
    const span = document.querySelector<HTMLElement>(
      '[data-testid="k14-stat"] [data-slot="stat-figure"] > span',
    )!
    return {
      text: span.textContent ?? '',
      scrollWidth: span.scrollWidth,
      clientWidth: span.clientWidth,
    }
  })

layout('a StatCard string value at 358 px is not ellipsised when it fits smaller', () => {
  test('the short name "Gate flake" beside its delta pill and status is whole', async () => {
    const page = await open()
    const f = await figure(page)
    expect(f.text.startsWith('Gate flake')).toBe(true)
    expect(f.scrollWidth).toBeLessThanOrEqual(f.clientWidth)
  })
})
