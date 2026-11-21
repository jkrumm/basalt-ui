/**
 * Expression cycle 18 (`v3-expr-18-kit-fixes` 9; n91 .33 and .36, probe n86): a `phone: 'columns'` table in a
 * DataPanel at 390 fits its card with every header whole, and its loading frame is as tall as its ready one.
 * Fixture: `fixture/kit-expr18-columns-fixture.tsx`.
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
  doc = await buildExpr12Document('columns', 'expr18')
})
afterAll(() => doc?.cleanup())

async function open(query: string, wait: string): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, `${doc!.path}${query}`, 'reduce', 'fine')
  await page.raw.waitForSelector(wait)
  await page.settle()
  return page
}

type Read = {
  scroll: number
  client: number
  card: number
  panel: number
  heads: { text: string; right: number; whole: boolean }[]
  rowHeights: number[]
}

const read = (page: LayoutPage): Promise<Read> =>
  page.raw.evaluate(() => {
    const root = document.querySelector('[data-testid="k18-columns"]')!
    const inset = root.querySelector('[data-slot="inset"]')!.getBoundingClientRect()
    const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')
    const visible = (el: Element): boolean => (el as HTMLElement).offsetParent !== null
    return {
      scroll: scroller?.scrollWidth ?? 0,
      client: scroller?.clientWidth ?? 0,
      card: inset.right,
      panel: root.querySelector('[data-slot="card"]')!.getBoundingClientRect().height,
      heads: [...root.querySelectorAll('thead th')].filter(visible).map((th) => ({
        text: th.textContent ?? '',
        right: th.getBoundingClientRect().right,
        whole: th.scrollWidth <= th.clientWidth + 1,
      })),
      rowHeights: [...root.querySelectorAll('tbody tr')]
        .filter(visible)
        .map((tr) => tr.getBoundingClientRect().height),
    }
  })

layout('a phone columns table in a card at 390', () => {
  test('fits its card with its headers whole', async () => {
    const m = await read(await open('', '[data-testid="k18-columns"] tbody tr'))
    expect(m.scroll, 'no inner scroll').toBeLessThanOrEqual(m.client)
    for (const head of m.heads) {
      expect(head.right, head.text).toBeLessThanOrEqual(m.card + 1)
      expect(head.whole, `${head.text} is whole`).toBe(true)
    }
  })

  test('the loading frame is as tall as the ready one', async () => {
    const loading = await read(
      await open('?phase=loading', '[data-testid="k18-columns"] [data-slot="card-phase"]'),
    )
    const loaded = await read(await open('', '[data-testid="k18-columns"] tbody tr'))
    expect(Math.abs(loading.panel - loaded.panel)).toBeLessThanOrEqual(1)
  })
})
