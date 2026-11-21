/**
 * Expression cycle 18 (`v3-expr-18-kit-fixes` 5; n88 .17, n90 .26, n92 .44, probe n70 and n76): a card a grid row
 * stretches leaves no blank band under its content. The lowest thing a card draws (its inset's box, its footer's
 * text) ends where an unstretched copy of it ends, within a pixel of the card's own gutter: the extra height
 * goes into the inset (a table or list body grows) or above a footer that stays at the card's bottom.
 * Fixture: `fixture/kit-expr18-stretch-fixture.tsx`.
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
  doc = await buildExpr12Document('stretch', 'expr18')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k18-stat"] [data-slot="stat-footer"]')
  await page.settle()
  return page
}

/** The px between a card's bottom edge and the lowest box it paints: an inset, a footer fact. */
const tail = (page: LayoutPage, id: string): Promise<{ tail: number; height: number }> =>
  page.raw.evaluate((testid: string) => {
    const card = document.querySelector(`[data-testid="${testid}"] [data-slot="card"]`)!
    const bottom = card.getBoundingClientRect().bottom
    const painted = [...card.querySelectorAll('[data-slot="inset"], [data-slot="stat-footer"] > *')]
    const lowest = Math.max(...painted.map((el) => el.getBoundingClientRect().bottom))
    return { tail: bottom - lowest, height: card.getBoundingClientRect().height }
  }, id)

layout('a stretched card leaves no blank band under its content', () => {
  for (const id of ['panel', 'list', 'stat']) {
    test(`${id}: the stretched card ends where its content ends, as the natural one does`, async () => {
      const page = await open()
      const stretched = await tail(page, `k18-${id}`)
      const natural = await tail(page, `k18-${id}-natural`)
      expect(stretched.height, 'the row stretched the card').toBeGreaterThan(natural.height + 100)
      expect(stretched.tail).toBeLessThanOrEqual(natural.tail + 1)
    })
  }
})
