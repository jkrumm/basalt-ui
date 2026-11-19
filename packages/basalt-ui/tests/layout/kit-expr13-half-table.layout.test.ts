/**
 * Expression cycle 13 kit fixes, the DataTable half-width group (`v3-expr-13-kit-fixes`, finding .57 and the
 * probe's n51 and n62): a table in a 750 px DataPanel cell is 718 px wide, keeps every column its estimated
 * sum fits (the windows table of n62, 696 px, priority 3 included) and folds or drops only what the sum does not
 * fit. Fixture: `fixture/kit-expr13-half-table-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1400 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('half-table', 'expr13')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x13-windows"] tbody tr')
  await page.settle()
  return page
}

type Table = {
  /** The table draws cards (its header is visually hidden). */
  cards: boolean
  /** Each head cell, in drawn order: its priority and whether it is displayed. */
  cells: { priority: number; shown: boolean }[]
  /** The table's own inline width, inside its DataPanel. */
  width: number
}

const table = (page: LayoutPage, testid: string): Promise<Table> =>
  page.raw.evaluate((id) => {
    const root = document.querySelector<HTMLElement>(
      `[data-testid="${id}"] [data-slot="table-root"]`,
    )!
    const header = root.querySelector<HTMLElement>('[data-slot="table-header"]')!
    return {
      cards: getComputedStyle(header).position === 'absolute',
      cells: [...root.querySelectorAll<HTMLElement>('thead th')].map((th) => ({
        priority: Number(th.dataset['priority']),
        shown: getComputedStyle(th).display !== 'none',
      })),
      width: Math.round(root.getBoundingClientRect().width),
    }
  }, testid)

layout('a half-width table keeps the columns its estimated sum fits', () => {
  test('the windows table (696 px of columns) keeps all five columns in a 750 px cell at 1800', async () => {
    const page = await open(WIDE)
    const t = await table(page, 'x13-windows')
    expect(t.width).toBe(718)
    expect(t.cards).toBe(false)
    expect(t.cells.length).toBe(5)
    expect(t.cells.every((cell) => cell.shown)).toBe(true)
  })

  test('the charges table (768 px of columns) keeps its priority 1 and 2 columns and drops the two priority 3 ones', async () => {
    const page = await open(WIDE)
    const t = await table(page, 'x13-charges')
    expect(t.cards).toBe(false)
    expect(t.cells.map((cell) => [cell.priority, cell.shown])).toEqual([
      [1, true],
      [1, true],
      [2, true],
      [3, false],
      [3, false],
    ])
  })

  test('at 390 the windows table still folds to cards', async () => {
    const page = await open(PHONE)
    const t = await table(page, 'x13-windows')
    expect(t.cards).toBe(true)
  })
})
