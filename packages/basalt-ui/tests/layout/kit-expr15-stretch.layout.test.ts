/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 3): a card a grid row stretches puts its extra height where its
 * content can use it. A DataPanel's table takes the box, its rows sharing the extra height (n70 .15; cycle 19
 * reversed the cycle 15 band under the last row), and a StatCard inset keeps its own height (n71 .20).
 * Fixture: `fixture/kit-expr15-stretch-fixture.tsx`.
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
const DESKTOP: Viewport = { name: 'desktop', width: 1280, height: 1600 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('stretch', 'expr15')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP, doc?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="st-panel"] tbody tr')
  await page.settle()
  return page
}

layout('a card a grid row stretches puts its extra height where its content uses it', () => {
  test('a DataPanel table fills the box: its last row ends at the inset bottom, no band under it (cycle 19)', async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const panel = document.querySelector('[data-testid="st-panel"] [data-slot="data-panel"]')!
      const card = panel.querySelector('[data-slot="card"]')!.getBoundingClientRect()
      const inset = panel.querySelector('[data-slot="inset"]')!.getBoundingClientRect()
      const rows = [...panel.querySelectorAll('tbody [data-slot="table-row"]')]
      const last = rows.at(-1)!.getBoundingClientRect()
      return { card: card.bottom, inset: inset.bottom, lastRow: last.bottom, rows: rows.length }
    })
    expect(m.rows).toBe(9)
    expect(m.inset - m.lastRow).toBeLessThan(24)
    expect(m.card - m.inset).toBeLessThan(12)
  })

  test('a StatCard inset keeps its content height and the extra height sits below it, above its footer', async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const stat = document.querySelector('[data-testid="st-stat"] [data-slot="stat-card"]')!
      const card = stat.querySelector('[data-slot="card"]')!.getBoundingClientRect()
      const inset = stat.querySelector('[data-slot="inset"]')!.getBoundingClientRect()
      return { card: card.bottom, insetHeight: inset.height, insetBottom: inset.bottom }
    })
    expect(m.insetHeight).toBeLessThanOrEqual(64)
    expect(m.card - m.insetBottom).toBeGreaterThan(100)
  })
})
