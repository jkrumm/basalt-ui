/**
 * Expression cycle 18 (`v3-expr-18-kit-fixes` 4, n87 .10): an empty or failed `DataPanel` over a table keeps its
 * column header across the panel and its cause in view: at 390 above the fold's tab bar (the panel is
 * 19 rows tall, so a centred cause falls below it), and at 1800 centred in the panel, not in the packed
 * columns. Fixture: `fixture/kit-expr18-empty-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const PHONE: Viewport = { name: 'phone 390', width: 390, height: 844 }
/** The phone tab bar's height: the cause ends above this much of the fold. */
const TAB_BAR = 64

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('empty', 'expr18')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport, query: string): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, `${doc!.path}${query}`, 'reduce', 'fine')
  await page.raw.waitForSelector(
    '[data-testid="k18-panel"] [data-slot="table-empty"], [data-testid="k18-panel"] [data-slot="table-error"]',
  )
  await page.settle()
  return page
}

type Read = {
  panel: [number, number]
  head: [number, number]
  columns: number[]
  cause: [number, number, number]
  fold: number
}

/** The panel's and the head row's inline extent, the cause's centre, top and bottom, and the fold. */
const read = (page: LayoutPage): Promise<Read> =>
  page.raw.evaluate(() => {
    const root = document.querySelector('[data-testid="k18-panel"]')!
    const inset = root.querySelector<HTMLElement>(
      '[data-slot="data-panel-rows"], [data-slot="card-phase"]',
    )!
    const box = (el: Element): DOMRect => el.getBoundingClientRect()
    const head = root.querySelector('thead')!
    const cause = root.querySelector('[data-slot="table-empty"], [data-slot="table-error"]')!
    const i = box(inset)
    const h = box(head)
    const c = box(cause)
    return {
      panel: [i.left, i.right] as [number, number],
      head: [h.left, h.right] as [number, number],
      columns: [...head.querySelectorAll('th')].map((th) => box(th).width),
      cause: [(c.left + c.right) / 2, c.top, c.bottom] as [number, number, number],
      fold: window.innerHeight,
    }
  })

layout('an empty DataPanel table keeps its columns and its cause in view', () => {
  for (const [name, query] of [
    ['empty', ''],
    ['failed', '?phase=error'],
  ] as const) {
    test(`wide 1800, ${name}: the head spans the panel and the cause is centred in it`, async () => {
      const m = await read(await open(WIDE, query))
      expect(m.head[0]).toBeCloseTo(m.panel[0], 0)
      expect(m.head[1]).toBeCloseTo(m.panel[1], 0)
      expect(m.cause[0]).toBeCloseTo((m.panel[0] + m.panel[1]) / 2, 0)
      // The columns keep the widths the ready table draws (a text-like column fills the panel), so the
      // cause centres in the panel and in the columns alike.
      expect(m.columns.reduce((sum, width) => sum + width, 0)).toBeCloseTo(
        m.panel[1] - m.panel[0],
        -1,
      )
    })
    test(`phone 390, ${name}: the cause is above the tab bar`, async () => {
      const m = await read(await open(PHONE, query))
      expect(m.cause[2]).toBeLessThanOrEqual(m.fold - TAB_BAR)
    })
  }
})
