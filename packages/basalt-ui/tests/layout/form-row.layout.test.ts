/**
 * `FormRow`'s label/control swap by CONTAINER width, not the viewport (`docs/waves/PLAN.md` wave 5,
 * n2). `@container` outcomes are a layout fact happy-dom cannot see — and this one specifically
 * caught a real defect a unit test could not: a container cannot reliably query ITSELF for a
 * layout-affecting property (`.row` establishing the container AND being the queried grid silently
 * kept the un-queried column count even once its own width crossed the condition), only a
 * descendant can. `.row`/`.grid` is the fix; this test is what would have caught the regression.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  forms: { widths: [458, 599, 600, 770] },
}

layout('FormRow label/control swap by container width', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test.each([
    [458, 1],
    [599, 1],
    [600, 2],
    [770, 2],
  ])('a %ipx-wide row renders %i grid column(s)', async (width, columns) => {
    const columnCount = await p.raw.evaluate((testId) => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"] > div > div`)
      if (el === null) throw new Error(`no FormRow grid under [data-testid="${testId}"]`)
      return getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
    }, `form-row-${width}`)
    expect(columnCount).toBe(columns)
  })

  test('label sits ABOVE the input below 600px, and BESIDE it from 600px', async () => {
    for (const [width, stacked] of [
      [458, true],
      [770, false],
    ] as const) {
      const label = await p.box('label', `[data-testid="form-row-${width}"] label`)
      const input = await p.box('input', `[data-testid="form-row-${width}"] input`)
      // Stacked: the input starts below the label's bottom edge. Beside: they share a top edge
      // (within a px of rounding) and the input is to the label's right.
      if (stacked) {
        expect(input.box.top).toBeGreaterThanOrEqual(label.box.bottom - 1)
      } else {
        expect(Math.abs(input.box.top - label.box.top)).toBeLessThan(4)
        expect(input.box.left).toBeGreaterThan(label.box.right)
      }
    }
  })
})
