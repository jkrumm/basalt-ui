/**
 * Expression cycle 13 kit fixes, the zone caption group (`v3-expr-13-kit-fixes` 3): a zone caption
 * sits inside its own zone or beside it, never over a neighbouring zone, and a reference rule never
 * strikes it. Fixture: `fixture/kit-expr13-captions-fixture.tsx` (n57's moon and usable zones, n62's
 * three wind zones, n59's silent zone under a Limit rule, and a pegged forge in a short chart).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, meet } from './expr13-support'
import type { Box, Chart } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const IDS = ['x13-n57', 'x13-n62', 'x13-n59', 'x13-pegged'] as const

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('captions', 'expr13')
})
afterAll(() => doc?.cleanup())

const measured = new Map<number, Promise<Chart[]>>()

/** The fixture's charts at one viewport: one page per width, shared by the cases of that width. */
function measure(viewport: Viewport): Promise<Chart[]> {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x13-n57"] svg.ts-chart')
    await page.settle()
    return charts(page, IDS)
  })()
  measured.set(viewport.width, found)
  return found
}

type Zone = { chart: string; i: number; box: Box }
type Caption = Zone & { text: string }

const zonesOf = (c: Chart): Zone[] =>
  c.marks.flatMap((m) => {
    const z = /^xzone-(\d+):/.exec(m.key)
    return z !== null && m.tag === 'rect' ? [{ chart: c.id, i: Number(z[1]), box: m.box }] : []
  })

const captionsOf = (c: Chart): Caption[] =>
  c.marks.flatMap((m) => {
    const z = /^xzone-(\d+)-label:/.exec(m.key)
    return z !== null && m.tag === 'text'
      ? [{ chart: c.id, i: Number(z[1]), box: m.box, text: m.text }]
      : []
  })

layout('a zone caption stays in or beside its own zone, and no rule strikes it', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`a zone caption never lies over another zone at ${viewport.width}`, async () => {
      const found = await measure(viewport)
      const over = found.flatMap((c) => {
        const zones = zonesOf(c)
        return captionsOf(c).flatMap((cap) =>
          zones
            .filter((z) => z.i !== cap.i && meet(cap.box, z.box))
            .map((z) => `${cap.text} (${cap.chart}) over zone ${z.i}`),
        )
      })
      expect(over).toEqual([])
    })

    test(`a zone caption is inside its zone or wholly beside it at ${viewport.width}`, async () => {
      const found = await measure(viewport)
      const outside = found.flatMap((c) => {
        const zones = zonesOf(c)
        return captionsOf(c).flatMap((cap) => {
          const own = zones.find((z) => z.i === cap.i)
          if (own === undefined) return []
          const inside = cap.box.l >= own.box.l && cap.box.r <= own.box.r
          const beside = cap.box.r <= own.box.l || cap.box.l >= own.box.r
          return inside || beside ? [] : [`${cap.text} (${cap.chart}) straddles its zone`]
        })
      })
      expect(outside).toEqual([])
    })

    test(`no reference rule strikes a zone caption at ${viewport.width}`, async () => {
      const found = await measure(viewport)
      const struck = found.flatMap((c) => {
        const rules = c.marks
          .filter((m) => m.tag === 'line' && /^ref-\d+:/.test(m.key))
          .map((m) => ({ key: m.key, y: m.box.t }))
        return captionsOf(c).flatMap((cap) =>
          rules
            .filter((r) => cap.box.t < r.y && r.y < cap.box.b)
            .map((r) => `${cap.text} (${cap.chart}) struck by ${r.key}`),
        )
      })
      expect(struck).toEqual([])
    })
  }
})
