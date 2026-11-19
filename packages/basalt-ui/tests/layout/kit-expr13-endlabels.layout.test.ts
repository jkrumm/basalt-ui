/**
 * Expression cycle 13 kit fixes, the end label group (`v3-expr-13-kit-fixes` 4): an end label stays
 * by its line's end, or a leader joins the two, so a label never floats off the line it names. Fixture:
 * `fixture/kit-expr13-endlabels-fixture.tsx` (a research pool and a two-point batch stub, and four
 * lines that all end near the baseline).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts } from './expr13-support'
import type { Box, Chart } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const IDS = ['x13-stub', 'x13-cluster'] as const
/** The top of each chart's left axis, and where each series ends (its last value). */
const AXIS_TOP = { 'x13-stub': 100, 'x13-cluster': 60 } as const
const ENDS: Record<string, Record<string, number>> = {
  'x13-stub': { a: 62, e: 2 },
  'x13-cluster': { a: 3, b: 2, c: 4, d: 1.5 },
}
/** A label whose centre is this close to its line's end reads as the line's own, px. */
const NEAR_PX = 14

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('endlabels', 'expr13')
})
afterAll(() => doc?.cleanup())

const measured = new Map<number, Promise<Chart[]>>()

function measure(viewport: Viewport): Promise<Chart[]> {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x13-stub"] svg.ts-chart')
    await page.settle()
    return charts(page, IDS)
  })()
  measured.set(viewport.width, found)
  return found
}

/** A value's y in a chart's px: the x axis is the bottom of the plot, the top grid line the top. */
function yOf(c: Chart, value: number): number {
  const top = c.marks.find(
    (m) => m.key === `y-grid:number:${AXIS_TOP[c.id as keyof typeof AXIS_TOP]}`,
  )
  const bottom = c.marks.find((m) => m.key === 'x-axis')
  if (top === undefined || bottom === undefined) throw new Error(`${c.id}: the axis is not drawn`)
  const max = AXIS_TOP[c.id as keyof typeof AXIS_TOP]
  return bottom.box.t - (value / max) * (bottom.box.t - top.box.t)
}

const centre = (box: Box): number => (box.t + box.b) / 2

layout('an end label stays by its line end, or a leader joins them', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`each end label is by its line's end or joined to it by a leader at ${viewport.width}`, async () => {
      const found = await measure(viewport)
      const off = found.flatMap((c) =>
        Object.entries(ENDS[c.id] ?? {}).flatMap(([key, value]) => {
          const label = c.marks.find((m) => m.key.startsWith(`${key}-end-label:`))
          if (label === undefined) return [`${c.id} ${key}: no end label`]
          const distance = Math.abs(centre(label.box) - yOf(c, value))
          if (distance <= NEAR_PX) return []
          const leader = c.marks.some((m) => m.key.startsWith(`${key}-end-leader:`))
          return leader
            ? []
            : [`${c.id} ${key}: ${Math.round(distance)} px from its end, no leader`]
        }),
      )
      expect(off).toEqual([])
    })
  }
})
