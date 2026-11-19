/**
 * Expression cycle 12 kit fixes (`v3-expr-12-kit-fixes` 6): a frame group's error arm keeps the
 * group's height, one banner and one Retry for the cells that share a source. Fixture:
 * `fixture/kit-expr12-frame-fixture.tsx`.
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
  doc = await buildExpr12Document('frame')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x12-strip-ready"] [data-slot="stat-cell"]')
  await page.settle()
  return page
}

const height = (page: LayoutPage, id: string): Promise<number> =>
  page.raw.evaluate(
    (testid) =>
      document
        .querySelector(`[data-testid="${testid}"] [data-slot="stat-group"]`)!
        .getBoundingClientRect().height,
    id,
  )

for (const viewport of [WIDE, PHONE]) {
  for (const variant of ['strip', 'cards'] as const) {
    layout(`a ${variant} group in error at ${viewport.name}`, () => {
      test('keeps the height of the ready group, with one banner and one Retry', async () => {
        const page = await open(viewport)
        const ready = await height(page, `x12-${variant}-ready`)
        const error = await height(page, `x12-${variant}-error`)
        expect(Math.abs(error - ready), `ready ${ready} error ${error}`).toBeLessThanOrEqual(0.5)
        const counts = await page.raw.evaluate((testid) => {
          const root = document.querySelector(`[data-testid="${testid}"]`)!
          return {
            alerts: root.querySelectorAll('[role="alert"]').length,
            retries: [...root.querySelectorAll('button')].filter((b) => b.textContent === 'Retry')
              .length,
          }
        }, `x12-${variant}-error`)
        expect(counts).toEqual({ alerts: 1, retries: 1 })
      })
    })
  }
}

/** The banner of a collapsed cards group covers the very cards it stands for. */
layout('the one banner of a failed cards group is as tall as the cards it replaces', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`at ${viewport.name}`, async () => {
      const page = await open(viewport)
      const boxes = await page.raw.evaluate(() => {
        const root = document.querySelector('[data-testid="x12-cards-error"]')!
        const pick = (el: Element) => {
          const r = el.getBoundingClientRect()
          return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10 }
        }
        const cells = [...root.querySelectorAll('[data-slot="stat-cell"]')].map(pick)
        return {
          banner: pick(root.querySelector('[data-slot="stat-group-message"]')!),
          first: cells[0]!,
          last: cells[cells.length - 1]!,
        }
      })
      expect(boxes.banner.top).toBeCloseTo(boxes.first.top, 0)
      expect(boxes.banner.bottom).toBeCloseTo(boxes.last.bottom, 0)
    })
  }
})
