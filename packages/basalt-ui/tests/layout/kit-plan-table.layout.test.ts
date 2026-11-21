/**
 * The table plan and three kit defects (`v3-table-plan`): the sr-only caption of a table never overlaps its first
 * row at 1800 and 390 (`craft-6/overlap`), a `phone: 'columns'` table shows a whole meter value at 390, and the
 * in-page measurer names a column the plan hides at 1800 or no phone card shows (`craft-6/hidden-column`).
 * Fixture: `fixture/kit-plan-table-fixture.tsx` (`?view=plain|meter|returns|nine`).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'
import { finishMeasurement, measureAnchor } from '../../src/cli/shot/measure'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const DESKTOP: Viewport = { name: 'shot 1800', width: 1800, height: 1200 }
const ANCHOR = '[data-testid="plan-table"]'

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('table', 'plan')
})
afterAll(() => doc?.cleanup())

async function open(view: string, viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    viewport,
    `${doc!.path}?view=${view}`,
    'reduce',
    'fine',
  )
  await page.raw.waitForSelector(`${ANCHOR} tbody tr`)
  await page.settle()
  return page
}

/** What `shot` reads of the anchor: the measurer's own function, run in the page. */
async function measure(page: LayoutPage) {
  const handle = await page.raw.$(ANCHOR)
  return finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
}

layout('the table caption', () => {
  for (const viewport of [DESKTOP, PHONE]) {
    test(`covers no row at ${viewport.width}`, async () => {
      const m = await measure(await open('plain', viewport))
      expect(m.overlaps, 'craft-6/overlap').toEqual([])
    })
  }
})

layout('a phone columns table', () => {
  for (const view of ['meter', 'returns']) {
    test(`shows every meter value whole at 390 (${view})`, async () => {
      const page = await open(view, PHONE)
      const read = await page.raw.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
        const edge = scroller.getBoundingClientRect().right
        const values = [
          ...document.querySelectorAll('td[data-kind="meter"] [data-readout] > span:last-child'),
        ]
        return {
          fits: scroller.scrollWidth <= scroller.clientWidth,
          values: values.map((v) => ({
            text: v.textContent ?? '',
            right: v.getBoundingClientRect().right,
            whole: v.scrollWidth <= v.clientWidth + 1,
          })),
          edge,
        }
      })
      expect(read.fits, 'no inner scroll').toBe(true)
      expect(read.values.map((v) => v.text)).toContain('100')
      for (const v of read.values) {
        expect(v.right, v.text).toBeLessThanOrEqual(read.edge + 1)
        expect(v.whole, `${v.text} is whole`).toBe(true)
      }
    })
  }
})

layout('a column the plan hides', () => {
  test('is named by id at 1800', async () => {
    const m = await measure(await open('nine', DESKTOP))
    const ids = (m.hiddenColumns ?? []).map((name) => name.replace('Cycle summary: ', ''))
    // 1800 px of columns stays reduced and the trailing priority 2 columns demote: only they are gone.
    expect(ids).toEqual(['peak', 'low', 'high', 'days', 'gain', 'id'])
    expect(m.cardLeftColumns ?? []).toEqual([])
  })

  test('is named by id when no phone card shows it', async () => {
    const m = await measure(await open('nine', PHONE))
    expect(m.cardLeftColumns ?? []).toContain('Cycle summary: id')
    expect(m.hiddenColumns ?? []).toEqual([])
  })
})
