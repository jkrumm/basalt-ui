/**
 * Expression cycle 16, a held run in a fill table (`v3-expr-16-kit-fixes` 10d, n61): a pointer on a list row
 * that holds a run of Issues brings the run into the table's own scroll region where it fits. The
 * list row the pointer stands on is registered under every index of the run, and it sits in no scroll
 * region: that used to end the reveal before the table was reached. Fixture:
 * `fixture/kit-expr16f-run-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1400 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('run', 'expr16f')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k16f-table"] tbody tr')
  await page.settle()
  return page
}

/** The table's rows (the first to the last of the run) inside its scroller, and how far it scrolled. */
const runInside = (page: LayoutPage): Promise<{ inside: boolean; scrolled: number }> =>
  page.raw.evaluate(() => {
    const root = document.querySelector('[data-testid="k16f-table"]')!
    const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
    const box = scroller.getBoundingClientRect()
    const run = [...root.querySelectorAll('tbody tr')].slice(18, 25)
    return {
      inside: run.every((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= box.top - 1 && b.bottom <= box.bottom + 1
      }),
      scrolled: scroller.scrollTop,
    }
  })

layout('a pointer on a list row that holds a run reveals the run in the table', () => {
  test('the Checking run comes into the table whole', async () => {
    const page = await open()
    const before = await runInside(page)
    expect(before.inside).toBe(false)
    const row = await page.raw.evaluate(() => {
      const li = [...document.querySelectorAll('[data-testid="k16f-states"] li')].find((n) =>
        /checking/i.test(n.textContent ?? ''),
      )!
      const r = li.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    await page.raw.mouse.move(2, 2)
    await page.raw.mouse.move(row.x, row.y, { steps: 4 })
    await page.raw.waitForTimeout(400)
    await page.settle()
    const after = await runInside(page)
    expect(after.scrolled).toBeGreaterThan(0)
    expect(after.inside).toBe(true)
  })
})
