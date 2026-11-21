/**
 * Expression cycle 17, a mono id in a phone row (`v3-expr-17-kit-fixes` 8, n84 'atlas-fast' and n86
 * 'unused-exports'): at 390 a `phone: 'columns'` table keeps a mono id on one line, whole, and never breaks
 * it at a hyphen. Fixture: `fixture/kit-expr17-ids-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('ids', 'expr17')
})
afterAll(() => doc?.cleanup())

layout('a mono id in a phone row', () => {
  test('stays on one line, whole', async () => {
    const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="k17-ids"] tbody [data-slot="table-row"]')
    await page.settle()
    const names = await page.raw.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="k17-ids"] tbody [data-slot="table-entity-name"]',
        ),
      ].map((el) => ({
        text: (el.textContent ?? '').trim(),
        lines: Math.round(
          el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
        ),
        cut: el.scrollWidth - el.clientWidth,
      })),
    )
    expect(names.map((n) => n.text)).toEqual([
      'unused-exports',
      'atlas-fast',
      'circular-imports',
      'dead-code',
    ])
    for (const n of names) {
      expect(n.lines, n.text).toBe(1)
      expect(n.cut, n.text).toBeLessThanOrEqual(0)
    }
  })
})
