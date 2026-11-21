/**
 * Expression cycle 17 contract (`v3-expr-17-contract`, Issue 2717, Spec "Stacked chart panes keep a
 * 160 px floor each and the card box grows"): n82 drew five panes in a `tall` card and got about 58 px
 * each at 390, so it wrapped the card in a hand `min-h-180`; n84's daily pane was about 114 px. Without a
 * page floor, every pane keeps 160 px and the card's chart box grows to hold the floors; above them
 * `weight` still splits the box. Fixture: `fixture/kit-expr17-panes-fixture.tsx`.
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
const FLOOR = 160
const GAP = 4

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('panes', 'expr17')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector(
    '[data-testid="k17-n82"] [data-slot="chart-pane"]:nth-child(5) svg.ts-chart',
  )
  await page.raw.waitForSelector(
    '[data-testid="k17-n84"] [data-slot="chart-pane"]:nth-child(2) svg.ts-chart',
  )
  await page.settle()
  return page
}

type Geometry = { box: number; panes: number[]; svgs: number[] }

/** The chart box's height, each pane's and the height of the svg its chart drew. */
const geometry = (page: LayoutPage, id: string): Promise<Geometry> =>
  page.raw.evaluate((testId: string) => {
    const root = document.querySelector(`[data-testid="${testId}"]`)!
    const panes = [...root.querySelectorAll('[data-slot="chart-pane"]')]
    return {
      box: root.querySelector('[data-slot="chart-box"]')!.getBoundingClientRect().height,
      panes: panes.map((p) => p.getBoundingClientRect().height),
      svgs: panes.map((p) => p.querySelector('svg.ts-chart')!.getBoundingClientRect().height),
    }
  }, id) as Promise<Geometry>

const filled = ({ box, panes }: Geometry): number =>
  Math.abs(panes.reduce((sum, h) => sum + h, 0) + GAP * (panes.length - 1) - box)

for (const viewport of [PHONE, DESKTOP]) {
  layout(`stacked panes keep a readable height at ${viewport.width}`, () => {
    test('n82: five panes keep 160 px each, the box grows to hold them, no page floor', async () => {
      const page = await open(viewport)
      const g = await geometry(page, 'k17-n82')
      expect(g.panes.length).toBe(5)
      expect(g.box).toBeGreaterThanOrEqual(5 * FLOOR + 4 * GAP - 1)
      expect(filled(g)).toBeLessThanOrEqual(1)
      for (const [i, h] of g.panes.entries()) {
        expect(h).toBeGreaterThanOrEqual(FLOOR - 0.5)
        expect(Math.abs(g.svgs[i]! - h)).toBeLessThanOrEqual(1)
      }
    })

    test('n84: the daily pane keeps its floor, above it the 3:2 weight holds', async () => {
      const page = await open(viewport)
      const g = await geometry(page, 'k17-n84')
      expect(g.panes.length).toBe(2)
      expect(filled(g)).toBeLessThanOrEqual(1)
      for (const [i, h] of g.panes.entries()) {
        expect(h).toBeGreaterThanOrEqual(FLOOR - 0.5)
        expect(Math.abs(g.svgs[i]! - h)).toBeLessThanOrEqual(1)
      }
      if (viewport.width === PHONE.width) {
        // 3:2 of the 284 px left in a 288 px box would be 170 and 114: both are held at the floor.
        expect(g.box).toBeCloseTo(2 * FLOOR + GAP, 0)
      } else {
        // A 420 px box: 3:2 is 250 and 166, both above the floor, so the weight split is unchanged.
        expect(g.box).toBeCloseTo(420, 0)
        expect(Math.abs(g.panes[0]! / g.panes[1]! - 1.5)).toBeLessThanOrEqual(0.02)
      }
    })
  })
}
