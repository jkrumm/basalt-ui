/**
 * Expression cycle 14, the chart focus over a phone list (`v3-expr-14-kit-fixes` 7a, n42 and n52): at 390 the
 * pointer leaving one phone card for the space under the list, then arriving on the next card inside the
 * release grace, takes the shared focus. Fixture: `fixture/kit-expr14-focus-phone-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { RELEASE_MS } from '../../src/core/focus-release'
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
  doc = await buildExpr12Document('focus-phone', 'expr14')
})
afterAll(() => doc?.cleanup())

const ROWS = '[data-testid="k14-table"] tbody tr'

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector(ROWS)
  await page.settle()
  return page
}

/** The centres of the first two cards, and a point under the first card that the list does not cover. */
const geometry = (
  page: LayoutPage,
): Promise<{ a: { x: number; y: number }; b: { x: number; y: number }; beyond: number | null }> =>
  page.raw.evaluate((sel) => {
    document.querySelector('[data-testid="k14-table"]')!.scrollIntoView({ block: 'center' })
    const rows = [...document.querySelectorAll(sel as string)]
    const list = rows[0]!.parentElement!
    const [ra, rb] = rows.slice(0, 2).map((el) => el.getBoundingClientRect())
    const card = document.querySelector('[data-testid="k14-table"]')!.getBoundingClientRect()
    let beyond: number | null = null
    for (let y = Math.ceil(ra!.bottom); y < card.bottom; y++) {
      const hit = document.elementFromPoint((ra!.left + ra!.right) / 2, y)
      if (hit !== null && !list.contains(hit)) {
        beyond = y
        break
      }
    }
    return {
      a: { x: (ra!.left + ra!.right) / 2, y: (ra!.top + ra!.bottom) / 2 },
      b: { x: (rb!.left + rb!.right) / 2, y: (rb!.top + rb!.bottom) / 2 },
      beyond,
    }
  }, ROWS)

const focus = (page: LayoutPage): Promise<{ index: string; dimmed: number; rows: number }> =>
  page.raw.evaluate(
    (sel) => ({
      index: (document.querySelector('[data-testid="k14-root"]') as HTMLElement).dataset[
        'focusIndex'
      ]!,
      dimmed: document.querySelectorAll(`${sel}[data-dimmed]`).length,
      rows: document.querySelectorAll(sel as string).length,
    }),
    ROWS,
  )

layout('a phone card the pointer arrives on takes the shared focus after the list is left', () => {
  test('the next card takes the focus when the pointer arrives inside the release grace', async () => {
    const page = await open()
    const { a, b, beyond } = await geometry(page)
    expect(beyond).not.toBeNull()
    await page.raw.mouse.move(a.x, a.y, { steps: 4 })
    await page.settle()
    expect((await focus(page)).index).toBe('22')
    await page.raw.mouse.move(a.x, beyond!, { steps: 1 })
    await page.raw.waitForTimeout(60)
    expect((await focus(page)).index).toBe('22')
    await page.raw.waitForTimeout(340)
    expect((await focus(page)).index).toBe('22')
    await page.raw.mouse.move(b.x, b.y, { steps: 4 })
    await page.raw.waitForTimeout(RELEASE_MS + 100)
    const after = await focus(page)
    expect(after.index).toBe('19')
    expect(after.dimmed).toBe(after.rows - 1)
  })
})
