/**
 * Expression cycle 13 kit fixes, the chart focus over a DataTable (`v3-expr-13-kit-fixes` 6 and 7). A row
 * that holds no item dims with the rest; a held run brings its first row into a fill table, and a run
 * already in view does not move the table. Fixture: `fixture/kit-expr13-hold-fixture.tsx`.
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
  doc = await buildExpr12Document('hold', 'expr13')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k13-run"] tbody tr')
  await page.settle()
  return page
}

const opacities = (page: LayoutPage, testid: string): Promise<Record<string, number>> =>
  page.raw.evaluate((id) => {
    const out: Record<string, number> = {}
    for (const row of document.querySelectorAll<HTMLElement>(`[data-testid="${id}"] tbody tr`)) {
      out[row.textContent?.split(' ')[0] ?? ''] = Number(getComputedStyle(row).opacity)
    }
    return out
  }, testid)

layout('a chart focus dims a table row that holds no item with the rest', () => {
  test('the row that holds nothing takes the same dim as the rows that hold other items', async () => {
    const page = await open()
    await page.raw.click('[data-testid="k13-dim-set"]')
    await page.settle()
    const o = await opacities(page, 'k13-dim')
    expect(o['Tue']).toBeLessThan(1)
    expect(o['Tue']).toBe(o['Wed']!)
    expect(o['Mon']).toBe(1)
  })
})

type Scroll = { inside: boolean; scrolled: number }
const firstRowScroll = (page: LayoutPage, index: number): Promise<Scroll> =>
  page.raw.evaluate((i) => {
    const root = document.querySelector('[data-testid="k13-run"]')!
    const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
    const row = root.querySelectorAll('tbody tr')[i]!.getBoundingClientRect()
    const box = scroller.getBoundingClientRect()
    return {
      inside: row.top >= box.top - 1 && row.bottom <= box.bottom + 1,
      scrolled: scroller.scrollTop,
    }
  }, index)

/** Whether every row of `from` to `to` sits inside the table's scroller. */
const rowsInside = (page: LayoutPage, from: number, to: number): Promise<boolean> =>
  page.raw.evaluate(
    ([a, b]) => {
      const root = document.querySelector('[data-testid="k13-run"]')!
      const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
      const box = scroller.getBoundingClientRect()
      const rows = [...root.querySelectorAll('tbody tr')].slice(a, b + 1)
      return rows.every((r) => {
        const rect = r.getBoundingClientRect()
        return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1
      })
    },
    [from, to] as const,
  )

layout('a held run reveals its first row in a fill table', () => {
  test('a run held past the fold comes into the scroller whole where it fits', async () => {
    const page = await open()
    expect(await rowsInside(page, 12, 14)).toBe(false)
    await page.raw.click('[data-testid="k13-run-far"]')
    await page.settle()
    expect(await rowsInside(page, 12, 14)).toBe(true)
  })

  test('a run held past the fold brings its first row into the scroller', async () => {
    const page = await open()
    expect((await firstRowScroll(page, 12)).inside).toBe(false)
    await page.raw.click('[data-testid="k13-run-far"]')
    await page.settle()
    const after = await firstRowScroll(page, 12)
    expect(after.inside).toBe(true)
    expect(after.scrolled).toBeGreaterThan(0)
  })

  test('a run already in view leaves the table where it is', async () => {
    const page = await open()
    const before = await firstRowScroll(page, 1)
    expect(before.inside).toBe(true)
    await page.raw.click('[data-testid="k13-run-near"]')
    await page.settle()
    expect((await firstRowScroll(page, 1)).scrolled).toBe(before.scrolled)
  })
})
