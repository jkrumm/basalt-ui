/**
 * Expression cycle 12 kit fixes (`v3-expr-12-kit-fixes` 3): a shared focus holds while the pointer
 * crosses the gap between two cards that hold linked lists, 44 px side by side at 1800 and 32 px
 * stacked at 390, and the next list takes it over; it releases once the pointer rests outside.
 * The sweep is the lead tool's: pointer on a row of A, to the middle of the gap, 60 ms and 340 ms
 * there, then onto a row of B. Fixture: `fixture/kit-expr12-focus-fixture.tsx`.
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
  doc = await buildExpr12Document('focus')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x12-focus"] tbody tr')
  await page.settle()
  return page
}

const index = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(
    () =>
      document.querySelector<HTMLElement>('[data-testid="x12-focus"]')!.dataset['focusedIndex']!,
  )

type Points = {
  a: { x: number; y: number }
  gap: { x: number; y: number }
  b: { x: number; y: number }
}

/** The centre of the last row of each panel (the first of B, for its arrival) and the middle of the gap between the two cards. */
const points = (page: LayoutPage): Promise<Points> =>
  page.raw.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="x12-focus"] [data-slot="card"]')]
    const rows = cards.map((card) => {
      const all = card.querySelectorAll('tbody tr')
      return all[all.length - 1]!.getBoundingClientRect()
    })
    const [ca, cb] = cards.map((card) => card.getBoundingClientRect()) as [DOMRect, DOMRect]
    const side = cb.left > ca.right
    const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    return {
      a: centre(rows[0]!),
      b: centre(cards[1]!.querySelector('tbody tr')!.getBoundingClientRect()),
      // On the row's own line, so the path from A never crosses another row of its list.
      gap: side
        ? { x: (ca.right + cb.left) / 2, y: centre(rows[0]!).y }
        : { x: centre(rows[0]!).x, y: (ca.bottom + cb.top) / 2 },
    }
  })

for (const viewport of [WIDE, PHONE]) {
  layout(`a shared focus across the card gap at ${viewport.name}`, () => {
    test('holds in the gap and moves to the next list on arrival', async () => {
      const page = await open(viewport)
      const p = await points(page)
      await page.raw.mouse.move(2, 2)
      await page.raw.mouse.move(p.a.x, p.a.y, { steps: 4 })
      await page.settle()
      expect(await index(page), 'on A').toBe('2')
      await page.raw.mouse.move(p.gap.x, p.gap.y, { steps: 4 })
      await page.raw.waitForTimeout(60)
      expect(await index(page), 'gap +60 ms').toBe('2')
      await page.raw.waitForTimeout(340)
      expect(await index(page), 'gap +400 ms').toBe('2')
      await page.raw.mouse.move(p.b.x, p.b.y, { steps: 4 })
      await page.settle()
      expect(await index(page), 'on B').toBe('3')
    })

    test('releases once the pointer rests outside both lists', async () => {
      const page = await open(viewport)
      const p = await points(page)
      await page.raw.mouse.move(p.a.x, p.a.y, { steps: 4 })
      await page.settle()
      expect(await index(page)).toBe('2')
      await page.raw.mouse.move(p.gap.x, p.gap.y, { steps: 4 })
      await page.raw.waitForTimeout(700)
      expect(await index(page)).toBe('')
    })
  })
}
