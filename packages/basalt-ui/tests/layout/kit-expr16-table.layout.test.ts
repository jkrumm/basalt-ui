/**
 * Expression cycle 16 (`v3-expr-16-kit-fixes` 1, 9): a `phone: 'columns'` table fits its headers whole at 390
 * (n77 .16); a group row is tinted the same across the whole row (in the reading look, not at all) and leaves no blank band under its label at 390
 * (n80 .41); a long DataTable in a DataPanel keeps its own scroll box at 390 (n75 .5, probed: it held).
 * Fixtures: `fixture/kit-expr16t-columns-fixture.tsx`, `fixture/kit-expr16t-long-fixture.tsx`.
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
const DESKTOP: Viewport = { name: 'desktop', width: 1280, height: 1600 }

let columns: Expr12Document | undefined
let long: Expr12Document | undefined
beforeAll(async () => {
  columns = await buildExpr12Document('columns', 'expr16t')
  long = await buildExpr12Document('long', 'expr16t')
})
afterAll(() => {
  columns?.cleanup()
  long?.cleanup()
})

async function open(doc: Expr12Document | undefined, viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="data-panel"] tbody [data-slot="table-row"]')
  await page.settle()
  return page
}

layout("a phone: 'columns' table at 390", () => {
  test('draws every header it keeps whole, none cut to an ellipsis', async () => {
    const page = await open(columns, PHONE)
    const heads = await page.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="e16-columns"] thead th')]
        .filter((th) => th.getBoundingClientRect().width > 0)
        .map((th) => {
          const label = th.querySelector<HTMLElement>('.truncate') ?? (th as HTMLElement)
          return {
            text: (label.textContent ?? '').trim(),
            cut: label.scrollWidth - label.clientWidth,
          }
        }),
    )
    expect(heads.map((h) => h.text)).toEqual(['App', 'Landed, %', 'Failed'])
    for (const head of heads) expect(head.cut).toBeLessThanOrEqual(0)
  })
})

layout('a grouped DataTable in a DataPanel', () => {
  test('a group row in the reading look carries no tint, its pinned cell neither', async () => {
    const page = await open(long, DESKTOP)
    const group = await page.raw.evaluate(() => {
      const row = document.querySelector(
        '[data-testid="e16-grouped"] tbody [data-slot="table-row"][data-group]',
      )!
      const pinned = row.querySelector('[data-pin="start"]')!
      return {
        rowBackground: getComputedStyle(row).backgroundColor,
        pinnedImage: getComputedStyle(pinned).backgroundImage,
      }
    })
    // bench-table-reading: the reading look draws a quiet group row, so the pinned cell's tint layer is as
    // clear as the row's ground and the band never stops short at the pinned edge.
    expect(group.rowBackground).toBe('rgba(0, 0, 0, 0)')
    expect(group.pinnedImage).toBe('linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))')
  })

  test('draws no blank band under the label of a group row on the phone card', async () => {
    const page = await open(long, PHONE)
    const { row, label, padding } = await page.raw.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="e16-grouped"] tbody [data-slot="table-row"][data-group]',
      )!
      const style = getComputedStyle(el)
      return {
        row: el.getBoundingClientRect().height,
        label: el.querySelector('[data-slot="table-group"]')!.getBoundingClientRect().height,
        padding: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom),
      }
    })
    expect(row - padding - label).toBeLessThan(1)
  })
})

layout('a long DataTable in a DataPanel at 390', () => {
  test('keeps its own scroll box, not 200 phone cards down the page', async () => {
    const page = await open(long, PHONE)
    const box = await page.raw.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(
        '[data-testid="e16-long"] [data-slot="table-scroller"]',
      )!
      return {
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        overflowY: getComputedStyle(scroller).overflowY,
        panel: document.querySelector('[data-testid="e16-long"]')!.getBoundingClientRect().height,
      }
    })
    expect(box.overflowY).toBe('auto')
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight * 10)
    expect(box.panel).toBeLessThan(2 * PHONE.height)
  })
})
