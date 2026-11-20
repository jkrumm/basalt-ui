/**
 * Expression cycle 14 contract (2), panes that share a card's box (n63 .7, n67; Spec artifact_01a1f6fb,
 * Issue 2500): `ChartPanes` hands each pane its share of the ChartCard's box by weight, at 1800 and at
 * 390, with no pixel height in the page; the panes' plots share one x column.
 * Fixture: `fixture/kit-c14-panes-fixture.tsx`.
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
  doc = await buildExpr12Document('panes', 'c14')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector(
    '[data-testid="c14-three"] [data-slot="chart-pane"]:nth-child(3) svg.ts-chart',
  )
  await page.settle()
  return page
}

/** The chart box, then each pane and the svg its chart drew. */
const geometry = (
  page: LayoutPage,
  id: string,
): Promise<{ box: Rect; panes: Rect[]; svgs: Rect[] }> =>
  page.raw.evaluate((testId: string) => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect()
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        height: r.height,
        width: r.width,
      }
    }
    const root = document.querySelector(`[data-testid="${testId}"]`)!
    const panes = [...root.querySelectorAll('[data-slot="chart-pane"]')]
    return {
      box: rect(root.querySelector('[data-slot="chart-box"]')!),
      panes: panes.map(rect),
      svgs: panes.map((p) => rect(p.querySelector('svg.ts-chart')!)),
    }
  }, id) as Promise<{ box: Rect; panes: Rect[]; svgs: Rect[] }>

const GAP = 4

for (const viewport of [DESKTOP, PHONE]) {
  layout(`ChartPanes at ${viewport.width}`, () => {
    test('two panes weighted 2 and 1 fill the card box', async () => {
      const page = await open(viewport)
      const { box, panes, svgs } = await geometry(page, 'c14-two')
      expect(panes.length).toBe(2)
      expect(panes[0]!.top).toBeCloseTo(box.top, 0)
      expect(Math.abs(panes[1]!.bottom - box.bottom)).toBeLessThanOrEqual(1)
      expect(Math.abs(panes[0]!.height - 2 * panes[1]!.height)).toBeLessThanOrEqual(2)
      expect(Math.abs(panes[0]!.height + panes[1]!.height + GAP - box.height)).toBeLessThanOrEqual(
        1,
      )
      for (const [i, svg] of svgs.entries())
        expect(Math.abs(svg.height - panes[i]!.height)).toBeLessThanOrEqual(1)
    })

    test('three equal panes fill the card box and share one plot width', async () => {
      const page = await open(viewport)
      const { box, panes, svgs } = await geometry(page, 'c14-three')
      expect(panes.length).toBe(3)
      const total = panes.reduce((sum, p) => sum + p.height, 0) + 2 * GAP
      expect(Math.abs(total - box.height)).toBeLessThanOrEqual(1)
      for (const pane of panes)
        expect(Math.abs(pane.height - panes[0]!.height)).toBeLessThanOrEqual(1)
      for (const svg of svgs) {
        expect(svg.height).toBeGreaterThan(30)
        expect(svg.left).toBeCloseTo(svgs[0]!.left, 0)
        expect(svg.width).toBeCloseTo(svgs[0]!.width, 0)
      }
    })
  })
}
