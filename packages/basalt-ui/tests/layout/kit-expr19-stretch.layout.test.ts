/**
 * Expression cycle 19 (`v3-expr-19-kit-fixes` 1; n98 .38, probe n88, n90, n92, n70, n76): a card a grid row stretches
 * leaves no blank band under what it PAINTS. Cycle 18's test read the inset's box, which grows by itself and so
 * passed while the pages kept the band; this one reads the lowest text or bar the card draws. The extra height goes
 * into the rows (a list's rows share it, a table fills its box), so the band under the last row stays within a
 * share of one row of the natural card's. Fixture: `fixture/kit-expr19-stretch-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 2400 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('stretch', 'expr19')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k19-list"] [data-slot="bar-list-row"]')
  await page.settle()
  return page
}

/** The px between a card's bottom edge and the lowest thing it paints: a text, a bar, a rule. */
const band = (page: LayoutPage, id: string): Promise<{ band: number; height: number }> =>
  page.raw.evaluate((testid: string) => {
    const card = document.querySelector(`[data-testid="${testid}"] [data-slot="card"]`)!
    let lowest = card.getBoundingClientRect().top
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!n.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        const b = range.getBoundingClientRect()
        if (b.height > 0) lowest = Math.max(lowest, b.bottom)
        continue
      }
      const el = n as Element
      const style = getComputedStyle(el)
      const b = el.getBoundingClientRect()
      if (style.visibility === 'hidden' || b.height === 0 || b.width === 0) continue
      const leaf = el.children.length === 0
      const paints =
        leaf &&
        (style.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(style.borderBottomWidth) > 0)
      if (paints) lowest = Math.max(lowest, b.bottom)
    }
    const box = card.getBoundingClientRect()
    return { band: box.bottom - lowest, height: box.height }
  }, id)

layout('a long entity name in a half-width table', () => {
  test('wraps onto a second line, never ends in an ellipsis', async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const name = document.querySelector(
        '[data-testid="k19-panel"] [data-slot="table-entity-name"]',
      ) as HTMLElement
      const box = name.getBoundingClientRect()
      return { cut: name.scrollWidth - name.clientWidth, height: box.height }
    })
    expect(m.cut, 'the name is whole').toBeLessThanOrEqual(1)
    expect(m.height, 'it took a second line').toBeGreaterThan(24)
  })
})

layout('a stretched card leaves no blank band under what it paints', () => {
  for (const id of ['list', 'panel']) {
    test(`${id}: the band under the last row is the natural card's, plus a share of the extra`, async () => {
      const page = await open()
      const stretched = await band(page, `k19-${id}`)
      const natural = await band(page, `k19-${id}-natural`)
      expect(stretched.height, 'the row stretched the card').toBeGreaterThan(natural.height + 60)
      // A band of the extra height would be 60 px and more: the rows took it.
      expect(stretched.band, id).toBeLessThanOrEqual(natural.band + 40)
    })
  }
})
