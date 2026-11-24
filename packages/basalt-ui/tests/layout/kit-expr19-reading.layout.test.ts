/**
 * Issue 3162, the DataTable reading look. A table fills its container on a padded page: the text columns share the
 * free width and the last column ends at the container's edge; a right-aligned header's label ends where its
 * figures end; a phone card keeps the meter column that answers the page. Fixture:
 * `fixture/kit-expr19-reading-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1400 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('reading', 'expr19')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k3162-phone"] [data-slot="table-cell"]')
  await page.settle()
  return page
}

layout('a reading table in a padded container', () => {
  test('its last column ends at the container edge', async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const box = document.querySelector('[data-testid="k3162-fill"]')!.getBoundingClientRect()
      const heads = Array.from(
        document.querySelectorAll('[data-testid="k3162-fill"] [data-slot="table-head"]'),
      )
      const last = heads[heads.length - 1]!.getBoundingClientRect()
      return { container: box.right, last: last.right, cols: heads.length }
    })
    expect(m.cols).toBe(5)
    expect(Math.abs(m.container - m.last), 'the last column ends at the edge').toBeLessThanOrEqual(
      1,
    )
  })

  test("a right-aligned header's label ends where its cells' figures end", async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const textRight = (el: Element): number => {
        const range = document.createRange()
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let right = 0
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue
          range.selectNodeContents(n)
          right = Math.max(right, range.getBoundingClientRect().right)
        }
        return right
      }
      const root = document.querySelector('[data-testid="k3162-fill"]')!
      const heads = Array.from(root.querySelectorAll('[data-slot="table-head"]'))
      const index = heads.findIndex((h) => h.textContent?.includes('Amount'))
      const label = heads[index]!.querySelector('button')!
      const cell = root.querySelector(
        `tbody tr:first-child [data-slot="table-cell"]:nth-child(${index + 1})`,
      )!
      const hint = heads[index]!.querySelectorAll('button')[1]
      return {
        label: textRight(label),
        figure: textRight(cell),
        icon: !!label.querySelector('svg'),
        hint: hint ? hint.getBoundingClientRect().left : null,
        labelLeft: label.getBoundingClientRect().left,
      }
    })
    expect(m.icon, 'the reading look draws no header icon').toBe(false)
    expect(Math.abs(m.label - m.figure)).toBeLessThanOrEqual(1)
    expect(m.hint, 'the help mark is on the outer side of the label').not.toBeNull()
    expect(m.hint!).toBeLessThanOrEqual(m.labelLeft)
  })
})

layout('a phone table with a meter and number columns', () => {
  test('the card shows the meter', async () => {
    const page = await open()
    const m = await page.raw.evaluate(() => {
      const cell = document.querySelector(
        '[data-testid="k3162-phone"] tbody tr:first-child [data-slot="table-cell"][data-kind="meter"]',
      )
      if (!cell) return null
      const box = cell.getBoundingClientRect()
      return {
        shown: getComputedStyle(cell).display !== 'none',
        width: box.width,
        height: box.height,
      }
    })
    expect(m, 'the meter cell exists').not.toBeNull()
    expect(m?.shown).toBe(true)
    expect(m?.width).toBeGreaterThan(0)
    expect(m?.height).toBeGreaterThan(0)
  })
})
