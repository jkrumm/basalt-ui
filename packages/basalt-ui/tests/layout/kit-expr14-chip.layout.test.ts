/**
 * Expression cycle 14 kit fixes (`v3-expr-14-kit-fixes` 9): the x hover chip of a date axis keeps clear of its
 * neighbouring tick labels, at 1800 and at 390 (n67: '18 Aug' over '17 Aug', '26 Sep' over '16 Sep'). The check is
 * the quality matrix's hover guard. Fixture: `fixture/kit-expr14-chip-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chipFindingsNow } from '../quality/matrix/hover-shift'
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
const SHARES = Array.from({ length: 41 }, (_, i) => 0.03 + (0.94 * i) / 40)

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('chip', 'expr14')
})
afterAll(() => doc?.cleanup())

const frame = (page: LayoutPage): Promise<void> =>
  page.raw.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )

/** The text of each x chip drawn in the box `id`. */
const chipsIn = (page: LayoutPage, id: string): Promise<string[]> =>
  page.raw.evaluate(
    (testid) =>
      [
        ...document.querySelectorAll(
          `[data-testid="${testid}"] .ts-chart__crosshair-label--x.ts-chart__crosshair-label-text`,
        ),
      ]
        .filter((el) => getComputedStyle(el).visibility !== 'hidden')
        .map((el) => (el.textContent ?? '').trim()),
    id,
  )

for (const viewport of [WIDE, PHONE]) {
  layout(`a chart in another card at ${viewport.name}`, () => {
    test('draws no x chip for a pointer on a chip-less pane that is not in its stack', async () => {
      const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
      await page.raw.waitForSelector('[data-testid="x14-chip"] svg.ts-chart')
      await page.settle()
      const box = await page.raw.evaluate(() => {
        const r = document
          .querySelector('[data-testid="x14-chip"] svg.ts-chart')!
          .getBoundingClientRect()
        return { l: r.left, t: r.top, w: r.width, h: r.height }
      })
      await page.raw.mouse.move(box.l + box.w * 0.4, box.t + box.h / 2)
      await frame(page)
      await page.raw.waitForTimeout(150)
      expect(await chipsIn(page, 'x14-lone'), 'the lone chart follows with its rule alone').toEqual(
        [''],
      )
      const stacked = await chipsIn(page, 'x14-chip')
      expect(
        stacked.filter((t) => t !== '').length,
        'the labelled pane of the stack carries the chip',
      ).toBe(1)
    })
  })
}

for (const viewport of [WIDE, PHONE]) {
  layout(`a date axis's x chip at ${viewport.name}`, () => {
    test('covers no tick label across a sweep of either pane', async () => {
      const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
      await page.raw.waitForSelector('[data-testid="x14-chip"] svg.ts-chart')
      await page.settle()
      const boxes = await page.raw.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-testid="x14-chip"] svg.ts-chart, [data-testid="x14-lone"] svg.ts-chart',
          ),
        ].map((svg) => {
          const r = svg.getBoundingClientRect()
          return { l: r.left, t: r.top, w: r.width, h: r.height }
        }),
      )
      const offenders = new Set<string>()
      let drawn = 0
      for (const [pane, box] of boxes.entries())
        for (const share of SHARES) {
          await page.raw.mouse.move(box.l + box.w * share, box.t + box.h / 2)
          await frame(page)
          await page.raw.waitForTimeout(100)
          drawn += await page.raw.evaluate(
            () =>
              [
                ...document.querySelectorAll(
                  '.ts-chart__crosshair-label--x.ts-chart__crosshair-label-text',
                ),
              ].filter((el) => (el.textContent ?? '').trim() !== '').length,
          )
          for (const text of await chipFindingsNow(page.raw))
            offenders.add(`pane ${pane} at ${share.toFixed(2)}: ${text}`)
        }
      expect(drawn, 'the labelled pane draws an x chip').toBeGreaterThan(0)
      expect([...offenders]).toEqual([])
    })
  })
}
