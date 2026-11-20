/**
 * Expression cycle 16 kit fixes, chart labels (`v3-expr-16-kit-fixes` 3 and 4), in real Chrome at 1800 and 390:
 * the stack total of the tallest day is kept and the zone caption steps aside (n64); a zone caption never lies
 * over a bar (n68); a bar at its limit keeps its value (n70); no dot overlaps another and a zone caption keeps
 * off the dots (n72); a dozen hourly values are kept, apart, at 390 (n76).
 * Fixture: `fixture/kit-expr16l-labels-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, meet } from './expr13-support'
import type { Chart } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const IDS = ['x16-picks', 'x16-months', 'x16-share', 'x16-dots', 'x16-hours'] as const

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('labels', 'expr16l')
})
afterAll(() => doc?.cleanup())

type Dots = { x: number; y: number; r: number }[]
const measured = new Map<number, Promise<{ all: Map<string, Chart>; dots: Dots }>>()
function measure(viewport: Viewport) {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x16-hours"] svg.ts-chart')
    await page.settle()
    const all = new Map((await charts(page, IDS)).map((c) => [c.id, c] as const))
    const dots = (await page.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="x16-dots"] svg.ts-chart circle')].map((c) => {
        const r = c.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }
      }),
    )) as Dots
    return { all, dots }
  })()
  measured.set(viewport.width, found)
  return found
}
const values = (c: Chart) =>
  c.marks.filter((m) => m.tag === 'text' && m.key.startsWith('bar-values-'))
const captions = (c: Chart) =>
  c.marks.filter((m) => m.tag === 'text' && /^xzone-\d+-label/.test(m.key))
/** The bars' rects: every rect that is not a zone's fill. */
const bars = (c: Chart) =>
  c.marks.filter((m) => m.tag === 'rect' && !m.key.startsWith('xzone-') && m.box.r - m.box.l > 2)

layout('chart labels', () => {
  for (const viewport of [WIDE, PHONE]) {
    describe(viewport.name, () => {
      test('the tallest stack keeps its total and the caption beside the gap day steps aside (n64)', async () => {
        const { all } = await measure(viewport)
        const picks = all.get('x16-picks')!
        const total = values(picks).filter((m) => m.text === '92')
        expect(total).toHaveLength(1)
        for (const caption of captions(picks))
          expect(meet(caption.box, total[0]!.box), 'caption over the total').toBe(false)
      })

      test('a zone caption never lies over a bar or a value (n68)', async () => {
        const { all } = await measure(viewport)
        for (const id of ['x16-picks', 'x16-months'] as const) {
          const chart = all.get(id)!
          for (const caption of captions(chart)) {
            for (const bar of bars(chart))
              expect(meet(caption.box, bar.box), `${id}: caption over a bar`).toBe(false)
            for (const value of values(chart))
              expect(meet(caption.box, value.box), `${id}: caption over ${value.text}`).toBe(false)
          }
        }
      })

      test('a bar at its limit keeps its value (n70 Garden party)', async () => {
        const { all } = await measure(viewport)
        expect(values(all.get('x16-share')!).map((m) => m.text)).toContain('100 %')
      })

      test('no two dots overlap and no zone caption lies on one (n72)', async () => {
        const { all, dots } = await measure(viewport)
        // A ring and its dot share a centre; two dots of the series never do once spread.
        const apart = dots.filter((d, i) => dots.findIndex((o) => o.x === d.x && o.y === d.y) === i)
        let overlapping = 0
        for (const [i, a] of apart.entries())
          for (const b of apart.slice(i + 1))
            if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 1) overlapping += 1
        expect(overlapping).toBe(0)
        const chart = all.get('x16-dots')!
        const svgLeft = chart.marks.length === 0 ? 0 : 0
        for (const caption of captions(chart)) {
          const covered = dots.some(
            (d) =>
              d.x + svgLeft > 0 &&
              meet(caption.box, { l: d.x - d.r, r: d.x + d.r, t: d.y - d.r, b: d.y + d.r }),
          )
          expect(covered, 'zone caption over a dot').toBe(false)
        }
      })
    })
  }

  describe('390', () => {
    test('twelve or more hourly values are kept, apart, and the highlighted hour keeps its own (n76)', async () => {
      const { all } = await measure(PHONE)
      const hours = values(all.get('x16-hours')!)
      expect(hours.length).toBeGreaterThanOrEqual(12)
      expect(hours.map((m) => m.text)).toContain('300')
      for (const [i, a] of hours.entries())
        for (const b of hours.slice(i + 1))
          expect(meet(a.box, b.box), `${a.text} over ${b.text}`).toBe(false)
    })
  })
})
