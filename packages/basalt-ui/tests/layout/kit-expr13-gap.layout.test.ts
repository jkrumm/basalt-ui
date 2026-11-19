/**
 * Expression cycle 13 kit fixes, the phone-card focus gap (`v3-expr-13-kit-fixes` 11): at 390 a real pointer
 * moves from a row of one phone card into the 32 px gap and on into the next card, and the shared focus
 * holds across the gap (60 ms and 400 ms into it) and is taken by the next card's row. Covers two
 * DataTable cards and a BarList card. Fixture: `fixture/kit-expr13-gap-fixture.tsx`.
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
  doc = await buildExpr12Document('gap', 'expr13')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k13-b"] tbody tr')
  await page.settle()
  return page
}

type Box = { x: number; top: number; bottom: number }
type Boxes = Record<'a' | 'b' | 'c' | 'aCard' | 'bCard' | 'cCard', Box>

const boxes = (page: LayoutPage): Promise<Boxes> =>
  page.raw.evaluate(() => {
    const first = (id: string, row: string): Box => {
      const r = document.querySelector(`[data-testid="${id}"] ${row}`)!.getBoundingClientRect()
      return { x: (r.left + r.right) / 2, top: r.top, bottom: r.bottom }
    }
    const card = (id: string): Box => {
      const r = document
        .querySelector(`[data-testid="${id}"] [data-slot="card"]`)!
        .getBoundingClientRect()
      return { x: 0, top: r.top, bottom: r.bottom }
    }
    return {
      a: first('k13-a', 'tbody [data-slot="table-row"]'),
      b: first('k13-b', 'tbody [data-slot="table-row"]'),
      c: first('k13-c', '[data-slot="bar-list-row"]'),
      aCard: card('k13-a'),
      bCard: card('k13-b'),
      cCard: card('k13-c'),
    }
  })

type State = { index: string; dimA: number; dimB: number; dimC: number; litB: number; litC: number }
const state = (page: LayoutPage): Promise<State> =>
  page.raw.evaluate(() => {
    const count = (id: string, attr: string) =>
      document.querySelectorAll(`[data-testid="${id}"] [${attr}]`).length
    return {
      index: (document.querySelector('[data-testid="k13-root"]') as HTMLElement).dataset[
        'focusIndex'
      ]!,
      dimA: count('k13-a', 'data-dimmed'),
      dimB: count('k13-b', 'data-dimmed'),
      dimC: count('k13-c', 'data-dimmed'),
      litB: count('k13-b', 'data-focused'),
      litC: count('k13-c', 'data-focused'),
    }
  })

const mid = (r: Box): number => (r.top + r.bottom) / 2

layout('a phone card focus holds across the gap and is taken by the next card', () => {
  test('from a table card, across the gap, into the next table card', async () => {
    const page = await open()
    const g = await boxes(page)
    const gap = (g.aCard.bottom + g.bCard.top) / 2
    await page.raw.mouse.move(g.a.x, mid(g.a), { steps: 3 })
    await page.settle()
    const atA = await state(page)
    await page.raw.mouse.move(g.a.x, gap, { steps: 6 })
    const at60 = await state(page)
    await page.raw.waitForTimeout(340)
    const at400 = await state(page)
    await page.raw.mouse.move(g.b.x, mid(g.b), { steps: 6 })
    await page.settle()
    const atB = await state(page)
    expect(atA.dimA).toBe(15)
    expect(at60.index).not.toBe('')
    expect(at60.dimA).toBe(15)
    expect(at400).toEqual(at60)
    expect(atB.index).toBe('4')
    expect(atB.litB).toBe(1)
    expect(atB.dimB).toBe(3)
  })

  test('from a table card, across the gap, into the BarList card', async () => {
    const page = await open()
    const g = await boxes(page)
    const gap = (g.bCard.bottom + g.cCard.top) / 2
    await page.raw.mouse.move(g.b.x, mid(g.b), { steps: 3 })
    await page.settle()
    await page.raw.mouse.move(g.b.x, gap, { steps: 6 })
    const at60 = await state(page)
    await page.raw.waitForTimeout(340)
    const at400 = await state(page)
    await page.raw.mouse.move(g.c.x, mid(g.c), { steps: 6 })
    await page.settle()
    const atC = await state(page)
    expect(at60.dimB).toBe(3)
    expect(at400).toEqual(at60)
    expect(atC.litC).toBe(1)
    expect(atC.dimC).toBe(7)
  })
})
