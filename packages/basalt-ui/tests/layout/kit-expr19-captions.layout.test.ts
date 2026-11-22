/**
 * Issue 2889 kit fixes in real Chrome at 1800 and 390: a zone caption whose zone is full of bars slides
 * along the zone to a gap instead of dropping (n96's aperture card), and the y hover chip never lies on a
 * tick (n97).
 * Fixture: `fixture/kit-expr19-captions-fixture.tsx`.
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
const IDS = ['x19-focal', 'x19-aperture', 'x19-stack'] as const

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('captions', 'expr19')
})
afterAll(() => doc?.cleanup())

const measured = new Map<number, Promise<Map<string, Chart>>>()
function measure(viewport: Viewport): Promise<Map<string, Chart>> {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x19-stack"] svg.ts-chart')
    await page.settle()
    return new Map((await charts(page, IDS)).map((c) => [c.id, c] as const))
  })()
  measured.set(viewport.width, found)
  return found
}

const caption = (c: Chart) =>
  c.marks.find((m) => m.tag === 'text' && m.key.startsWith('xzone-0-label'))
/** The bar bodies: rects that are neither a zone nor a clip. */
const bars = (c: Chart) =>
  c.marks.filter((m) => m.tag === 'rect' && !m.key.startsWith('xzone-') && m.box.b - m.box.t > 1)

layout('a zone caption full of bars slides along its zone', () => {
  for (const viewport of [WIDE, PHONE]) {
    describe(viewport.name, () => {
      test('the corner is free on the focal card: the caption keeps its start', async () => {
        const focal = (await measure(viewport)).get('x19-focal')!
        expect(caption(focal)).toBeDefined()
      })

      test('a first bar that fills the corner no longer drops the caption (n96 aperture)', async () => {
        const aperture = (await measure(viewport)).get('x19-aperture')!
        const cap = caption(aperture)
        // At 390 the aperture buckets are narrower than the caption, so a gap may not exist; where the
        // caption is drawn it lies over no bar.
        if (viewport.width >= 1000) expect(cap, 'the caption is drawn at 1800').toBeDefined()
        if (cap === undefined) return
        const struck = bars(aperture).filter((b) => meet(cap.box, b.box))
        expect(struck.map((b) => b.key)).toEqual([])
      })
    })
  }
})

layout('the y hover chip never lies on a tick (n97)', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`no drawn tick label meets the chip over any bar at ${viewport.width}`, async () => {
      const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
      await page.raw.waitForSelector('[data-testid="x19-stack"] svg.ts-chart')
      await page.settle()
      const plot = await page.raw.evaluate(() => {
        const r = document
          .querySelector('[data-testid="x19-stack"] svg.ts-chart')!
          .getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      const struck: string[] = []
      for (const fx of [0.2, 0.5, 0.8]) {
        for (let dy = 12; dy < plot.h - 40; dy += 10) {
          await page.raw.mouse.move(2, 2)
          await page.raw.mouse.move(plot.x + plot.w * fx, plot.y + dy)
          await page.raw.waitForTimeout(30)
          const hit = await page.raw.evaluate(() => {
            const texts = [
              ...document.querySelectorAll('[data-testid="x19-stack"] svg.ts-chart text'),
            ]
              .map((t) => ({
                t: t.textContent ?? '',
                b: t.getBoundingClientRect(),
                o: Number(getComputedStyle(t).opacity),
                fw: getComputedStyle(t).fontWeight,
              }))
              .filter((x) => x.o > 0.05 && x.b.width > 0 && /^[\d.,]+k?$/.test(x.t))
            const chips = texts.filter((x) => x.fw === '500' || x.fw === '600')
            const ticks = texts.filter((x) => x.fw !== '500' && x.fw !== '600')
            return chips.flatMap((c) =>
              ticks
                .filter(
                  (t) =>
                    Math.min(c.b.right, t.b.right) > Math.max(c.b.left, t.b.left) &&
                    Math.min(c.b.bottom, t.b.bottom) > Math.max(c.b.top, t.b.top),
                )
                .map((t) => `${c.t} over ${t.t}`),
            )
          })
          for (const h of hit) struck.push(`${h} at ${fx}/${dy}`)
        }
      }
      expect(struck).toEqual([])
    })
  }
})
