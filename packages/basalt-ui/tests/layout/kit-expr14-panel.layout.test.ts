/**
 * Expression cycle 14, a DataPanel body with fewer rows than its `rows` count (`v3-expr-14-kit-fixes` 7b, n57 and
 * n60): at 1800 the last row of a short table ends at the panel's padding above the panel's bottom edge, no blank
 * row between them. Fixture: `fixture/kit-expr14-panel-fixture.tsx`.
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
  doc = await buildExpr12Document('panel', 'expr14')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k14-short"] tbody tr')
  await page.settle()
  return page
}

/** The gap from a panel's last row to its bottom edge, and the panel's own bottom padding (the card gutter and the inset's). */
const blank = (page: LayoutPage, testid: string): Promise<{ gap: number; padding: number }> =>
  page.raw.evaluate((id) => {
    const panel = document.querySelector(`[data-testid="${id}"] [data-slot="data-panel"]`)!
    const card = panel.querySelector<HTMLElement>('[data-slot="card"]')!.getBoundingClientRect()
    const inset = panel.querySelector<HTMLElement>('[data-slot="inset"]')!
    const rows = [...panel.querySelectorAll('tbody [data-slot="table-row"]')]
    const last = rows[rows.length - 1]!.getBoundingClientRect()
    return {
      gap: card.bottom - last.bottom,
      padding:
        card.bottom -
        inset.getBoundingClientRect().bottom +
        parseFloat(getComputedStyle(inset).paddingBottom),
    }
  }, testid)

layout('a DataPanel with fewer rows than its body holds ends at its last row', () => {
  test('the short table ends at the panel padding, with no blank row under it', async () => {
    const page = await open()
    const b = await blank(page, 'k14-short')
    expect(b.gap - b.padding).toBeLessThanOrEqual(1)
  })

  test('the long table is cut after its last whole row, with no blank row under it', async () => {
    const page = await open()
    const b = await blank(page, 'k14-long')
    expect(b.gap - b.padding).toBeLessThanOrEqual(1)
  })
})
