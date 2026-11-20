/**
 * Expression cycle 14 contract (1), one height for the cards of a row (n64 .16, n65 .25; Spec
 * artifact_01a1f6fb, Issue 2500): in a CardGrid row a ChartCard, a DataPanel and a StatCard end at one
 * height, the shorter card growing its body; at 390 the stacked cards keep their own heights.
 * Fixture: `fixture/kit-c14-row-fixture.tsx`.
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
const DESKTOP: Viewport = { name: 'desktop', width: 1800, height: 1200 }
type Rect = {
  top: number
  bottom: number
  left: number
  right: number
  height: number
  width: number
}

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('row', 'c14')
})
afterAll(() => doc?.cleanup())

/** The rect of the first element matching each selector, or `null`. */
const rects = (page: LayoutPage, selectors: readonly string[]): Promise<(Rect | null)[]> =>
  page.raw.evaluate(
    (all: string[]) =>
      all.map((s) => {
        const el = document.querySelector(s)
        if (el === null) return null
        const r = el.getBoundingClientRect()
        return {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          height: r.height,
          width: r.width,
        }
      }),
    selectors as string[],
  ) as Promise<(Rect | null)[]>

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="c14-lone-chart"] svg.ts-chart')
  await page.settle()
  return page
}

const card = (id: string, slot: string): string => `[data-testid="${id}"] > [data-slot="${slot}"]`
const box = (id: string): string => `[data-testid="${id}"] [data-slot="chart-box"]`

layout('cards of one grid row end at one height', () => {
  test('at 1800 a ChartCard beside a taller DataPanel grows its chart box to the row', async () => {
    const page = await open(DESKTOP)
    const [chart, panel, grown, lone] = await rects(page, [
      card('c14-row-panel-chart', 'chart-card'),
      card('c14-row-panel-table', 'data-panel'),
      box('c14-row-panel-chart'),
      box('c14-lone-chart'),
    ])
    expect(chart!.top).toBeCloseTo(panel!.top, 0)
    expect(Math.abs(chart!.bottom - panel!.bottom)).toBeLessThanOrEqual(1)
    expect(grown!.height).toBeGreaterThan(lone!.height + 20)
  })

  test('at 1800 a StatCard beside a ChartCard ends level with it', async () => {
    const page = await open(DESKTOP)
    const [stat, chart] = await rects(page, [
      card('c14-row-stat-card', 'stat-card') + ' > [data-slot="card"]',
      card('c14-row-stat-chart', 'chart-card') + ' > [data-slot="card"]',
    ])
    expect(Math.abs(stat!.bottom - chart!.bottom)).toBeLessThanOrEqual(1)
  })

  test('at 1800 a DataPanel shorter than its ChartCard grows its body and ends level', async () => {
    const page = await open(DESKTOP)
    const [chart, panel] = await rects(page, [
      card('c14-row-short-chart', 'chart-card') + ' > [data-slot="card"]',
      card('c14-row-short-table', 'data-panel') + ' > [data-slot="card"]',
    ])
    expect(Math.abs(chart!.bottom - panel!.bottom)).toBeLessThanOrEqual(1)
  })

  test('at 390 the stacked cards keep their own heights', async () => {
    const page = await open(PHONE)
    const [inRow, lone] = await rects(page, [box('c14-row-panel-chart'), box('c14-lone-chart')])
    expect(Math.abs(inRow!.height - lone!.height)).toBeLessThanOrEqual(1)
  })
})
