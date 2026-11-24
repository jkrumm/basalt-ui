/**
 * Issue 2911 kit gaps in real Chrome at 1800 and 390: n79's end labels keep clear of the lines (a gutter
 * right of the last points when they would sit in the plot) and n72's page labels are tied to their dots:
 * a clear box a ring away with a leader, or a surface plate over the dots where none is clear.
 * Fixture: `fixture/kit-expr19-gaps-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, paths, strikes } from './expr13-support'
import type { Box } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('gaps', 'expr19')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport) {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x19-stars"] svg.ts-chart')
  await page.settle()
  return page
}

layout('n79: the end labels sit beside their lines, never over one', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`no end label meets a line and none is cut by the plot's edge at ${viewport.width}`, async () => {
      const page = await open(viewport)
      const [chart] = await charts(page, ['x19-surge'])
      const lines = await paths(page, 'x19-surge')
      const labels = chart!.marks.filter((m) => m.key.includes('-end-label'))
      expect(labels).toHaveLength(8)
      const plot = await page.raw.evaluate(() => {
        const svg = document.querySelector('[data-testid="x19-surge"] svg.ts-chart')!
        const clip = svg.querySelector('clipPath rect')!
        return { right: Number(clip.getAttribute('x')) + Number(clip.getAttribute('width')) }
      })
      const struck = labels.flatMap((l) =>
        lines.filter((p) => strikes(p, l.box)).map((p) => `${l.text} by ${p.key.split(':')[0]}`),
      )
      expect(struck).toEqual([])
      // The table measures the shipped face; the harness draws a fallback that runs up to a tenth wider.
      expect(
        labels.filter((l) => l.box.r > plot.right + (l.box.r - l.box.l) * 0.1).map((l) => l.text),
      ).toEqual([])
    })
  }
})

layout('n72: a label that cannot sit beside its dot is tied to it', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`each named label lies over no dot it does not cover with a plate at ${viewport.width}`, async () => {
      const page = await open(viewport)
      const found = await page.raw.evaluate(() => {
        const svg = document.querySelector('[data-testid="x19-agree"] svg.ts-chart')!
        const o = svg.getBoundingClientRect()
        const box = (e: Element): Box => {
          const r = e.getBoundingClientRect()
          return { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top }
        }
        return {
          labels: [...svg.querySelectorAll('text')]
            .filter((t) => t.getAttribute('data-ts-key')?.startsWith('x19-named'))
            .map((t) => ({ text: t.textContent ?? '', box: box(t) })),
          dots: [...svg.querySelectorAll('circle')].map((c) => box(c)),
          plates: [...svg.querySelectorAll('[data-ts-key^="label-plate"]')].map((p) => box(p)),
        }
      })
      // The phone plot reaches the card edge (y ticks inside), which moves two labels of the dense cluster
      // onto each other, and the engine drops the one it cannot place.
      expect(found.labels).toHaveLength(viewport === PHONE ? 4 : 5)
      const inside = (p: { x: number; y: number }, b: Box): boolean =>
        p.x >= b.l && p.x <= b.r && p.y >= b.t && p.y <= b.b
      const bare = found.labels.flatMap((label) => {
        // The table measures the shipped face and the harness draws a fallback, and a text box is taller
        // than its glyphs: a few px of slack, so a dot that only grazes the box is not counted; the plate
        // gets a pixel of it vertically, since a dot whose centre sits a tenth of a pixel above the plate's edge is under it.
        const b = { l: label.box.l + 9, r: label.box.r - 9, t: label.box.t + 3, b: label.box.b - 3 }
        return found.dots
          .filter((d) => d.l < b.r && b.l < d.r && d.t < b.b && b.t < d.b)
          .filter(
            (d) =>
              !found.plates.some((p) =>
                inside(
                  { x: (d.l + d.r) / 2, y: (d.t + d.b) / 2 },
                  { l: p.l - 9, r: p.r + 9, t: p.t - 1, b: p.b + 1 },
                ),
              ),
          )
          .map(() => label.text)
      })
      expect(bare).toEqual([])
    })
  }
})
