/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 4): a StatCell empty cause wraps inside its cell at 390 rather
 * than ellipsising (n73 .41, 'Nothing is waiting. Add on...'). Fixture: `fixture/kit-expr15-empty-fixture.tsx`.
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
  doc = await buildExpr12Document('empty', 'expr15')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="ex-strip"] [data-phase="empty"]')
  await page.settle()
  return page
}

layout('a StatCell empty cause wraps at 390', () => {
  test('the cause is whole: two lines tall, not clipped, no ellipsis', async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const cell = document.querySelector('[data-testid="ex-strip"] [data-phase="empty"]')!
      const cause = [...cell.querySelectorAll('p')].find(
        (p) => p.textContent === 'Nothing is waiting. Add one to start.',
      )!
      const style = getComputedStyle(cause)
      return {
        height: cause.getBoundingClientRect().height,
        scrollWidth: cause.scrollWidth,
        clientWidth: cause.clientWidth,
        textOverflow: style.textOverflow,
      }
    })
    expect(m.height).toBeGreaterThanOrEqual(30)
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth + 1)
    expect(m.textOverflow).not.toBe('ellipsis')
  })
})
