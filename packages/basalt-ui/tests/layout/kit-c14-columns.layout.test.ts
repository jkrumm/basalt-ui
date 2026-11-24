/**
 * Expression cycle 14 contract (3), `phone: 'columns'` (n65 .23, cycle 13 n62 .57; Spec artifact_01a1f6fb,
 * Issue 2500): at 390 a twelve-row, five-column numeric table keeps its header, the name, the answer
 * column and one count in view with no sideways overflow, at under half the height of its fields form.
 * Fixture: `fixture/kit-c14-columns-fixture.tsx`.
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
  doc = await buildExpr12Document('columns', 'c14')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="c14-columns"] [data-slot="table-row"]')
  await page.settle()
  return page
}

type Shown = { header: number; cells: string[][]; overflow: number; right: number; height: number }

const shown = (page: LayoutPage, id: string): Promise<Shown> =>
  page.raw.evaluate((testId: string) => {
    const root = document.querySelector(`[data-testid="${testId}"]`)!
    const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'
    }
    const rows = [...root.querySelectorAll('tbody [data-slot="table-row"]')]
    let right = 0
    const cells = rows.map((row) =>
      [...row.querySelectorAll('[data-slot="table-cell"]')].filter(visible).map((cell) => {
        right = Math.max(right, cell.getBoundingClientRect().right)
        return (cell.textContent ?? '').trim()
      }),
    )
    const head = root.querySelector('[data-slot="table-header"]')!
    return {
      header: head.getBoundingClientRect().height,
      cells,
      overflow: scroller.scrollWidth - scroller.clientWidth,
      right,
      height: root.getBoundingClientRect().height,
    }
  }, id) as Promise<Shown>

layout("a long numeric table as phone: 'columns' at 390", () => {
  test('keeps its header and the name, the answer and one count of every row in view', async () => {
    const page = await open()
    const table = await shown(page, 'c14-columns')
    expect(table.header).toBeGreaterThan(16)
    expect(table.cells.length).toBe(12)
    for (const row of table.cells) expect(row.length).toBe(3)
    expect(table.cells[2]![0]).toContain('Merge conflict on the plan file')
    expect(table.cells[0]![1]).toBe('12')
    expect(table.cells[0]![2]).toBe('40')
    expect(table.overflow).toBeLessThanOrEqual(0)
    expect(table.right).toBeLessThanOrEqual(PHONE.width)
  })

  test('is under half the height of the same rows as fields', async () => {
    const page = await open()
    const [columns, cards] = await Promise.all([
      shown(page, 'c14-columns'),
      shown(page, 'c14-cards'),
    ])
    expect(columns.height).toBeLessThan(cards.height / 2)
  })
})

layout("phone: 'columns' with the answer demoted to priority 3", () => {
  test('still shows the answer at 390', async () => {
    const page = await open()
    const table = await shown(page, 'c14-demoted')
    for (const row of table.cells) expect(row.length).toBe(3)
    expect(table.cells[0]![2]).toBe('12')
    expect(table.overflow).toBeLessThanOrEqual(0)
  })
})

layout('a narrow scroll table in a DataPanel', () => {
  test('keeps the six rows it declared, not the loading estimate of six cards', async () => {
    const page = await open()
    const { box, row } = await page.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="c14-panel"]')!
      return {
        box: root.querySelector('[data-slot="data-panel-rows"]')!.getBoundingClientRect().height,
        row: root.querySelector('tbody [data-slot="table-row"]')!.getBoundingClientRect().height,
      }
    })
    expect(box).toBeLessThanOrEqual(6 * row + 1)
  })
})
