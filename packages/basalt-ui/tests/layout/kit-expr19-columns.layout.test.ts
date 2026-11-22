/**
 * Expression cycle 19 (`v3-expr-19-kit-fixes` 6; n93 .9 and .5): a `phone: 'columns'` table with unit headers keeps
 * its three columns and every header inside its card at 390 with no sideways scroll, and in a half-width card at 1800 its
 * empty and error frames keep the header row inside the card. Fixture: `fixture/kit-expr19-columns-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('columns', 'expr19')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport, query: string): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, `${doc!.path}${query}`, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k19-columns"] thead th')
  await page.settle()
  return page
}

const read = (page: LayoutPage) =>
  page.raw.evaluate(() => {
    const root = document.querySelector('[data-testid="k19-columns"]')!
    const inset = root.querySelector('[data-slot="inset"]')!.getBoundingClientRect()
    const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
    const visible = (el: Element): boolean => (el as HTMLElement).offsetParent !== null
    return {
      scroll: scroller.scrollWidth,
      client: scroller.clientWidth,
      card: inset.right,
      heads: [...root.querySelectorAll('thead th')].filter(visible).map((th) => ({
        text: th.textContent ?? '',
        right: th.getBoundingClientRect().right,
        whole: th.scrollWidth <= th.clientWidth + 1,
      })),
    }
  })

layout('a phone columns table with unit headers', () => {
  for (const [name, viewport, query] of [
    ['at 390, loaded', PHONE, ''],
    ['in a half-width card at 1800, empty', WIDE, '?phase=empty'],
    ['in a half-width card at 1800, failed', WIDE, '?phase=error'],
  ] as const) {
    test(`${name}: the header row is whole inside the card, no sideways scroll`, async () => {
      const m = await read(await open(viewport, query))
      expect(m.scroll, 'no inner scroll').toBeLessThanOrEqual(m.client + 1)
      expect(m.heads.length, 'three columns stay').toBeGreaterThanOrEqual(3)
      for (const head of m.heads) {
        expect(head.right, head.text).toBeLessThanOrEqual(m.card + 1)
        expect(head.whole, `${head.text} is whole`).toBe(true)
      }
    })
  }
})
